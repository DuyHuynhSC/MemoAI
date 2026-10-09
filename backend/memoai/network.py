import os
import sys
import ssl
import time
import base64
import ipaddress
from urllib.parse import urlparse
from pathlib import Path
from typing import Optional, Union
import certifi
import httpx
from sqlmodel import Session, select

from memoai.config import settings
from memoai.models import AppSettings

# Keep original references for clean restore
_ORIG_CERTIFI_WHERE = certifi.where
_ORIG_CERTIFI_CONTENTS = getattr(certifi, "contents", None)
_ORIG_SSL_DEFAULT_HTTPS_CONTEXT = getattr(ssl, "_create_default_https_context", ssl.create_default_context)


def get_windows_system_certs_pem() -> str:
    """Extract ROOT and CA certificates from Windows Certificate Store as PEM."""
    if sys.platform != "win32" or not hasattr(ssl, "enum_certificates"):
        return ""

    pem_blocks = []
    for store in ("ROOT", "CA"):
        try:
            for cert_bytes, encoding_type, trust in ssl.enum_certificates(store):
                if cert_bytes:
                    b64 = base64.encodebytes(cert_bytes).decode("ascii")
                    pem_blocks.append(f"-----BEGIN CERTIFICATE-----\n{b64}-----END CERTIFICATE-----\n")
        except Exception:
            pass
    return "".join(pem_blocks)


def ensure_combined_ca_bundle(app_set: Optional[AppSettings] = None) -> Path:
    """Generate or update a unified CA bundle combining:
    1. Standard Mozilla certifi root CAs
    2. Windows system store ROOT and CA certificates (e.g. enterprise group policies)
    3. User-configured custom CA certificate file (.ca, .pem, .crt)
    Returns path to the combined bundle file.
    """
    if app_set is None:
        app_set = get_active_network_settings()

    certs_dir = settings.get_certs_dir()
    combined_path = certs_dir / "memoai_combined_ca.pem"

    parts = []

    # 1. Base certifi bundle
    try:
        base_certifi_path = Path(_ORIG_CERTIFI_WHERE())
        if base_certifi_path.is_file():
            parts.append(base_certifi_path.read_text(encoding="utf-8"))
    except Exception:
        pass

    # 2. Windows System Certificate Store
    try:
        win_certs = get_windows_system_certs_pem()
        if win_certs:
            parts.append("\n# Windows System Certificates\n" + win_certs)
    except Exception:
        pass

    # 3. User Custom CA Certificate
    custom_ca_file = None
    if app_set.ca_cert_path and Path(app_set.ca_cert_path).is_file():
        custom_ca_file = Path(app_set.ca_cert_path)
    elif settings.ca_cert_path and Path(settings.ca_cert_path).is_file():
        custom_ca_file = Path(settings.ca_cert_path)
    elif settings.ssl_cert_file and Path(settings.ssl_cert_file).is_file():
        custom_ca_file = Path(settings.ssl_cert_file)
    elif settings.requests_ca_bundle and Path(settings.requests_ca_bundle).is_file():
        custom_ca_file = Path(settings.requests_ca_bundle)

    if custom_ca_file:
        try:
            custom_content = custom_ca_file.read_text(encoding="utf-8")
            parts.append(f"\n# Custom CA ({custom_ca_file.name})\n" + custom_content)
        except Exception:
            pass

    # Write combined file
    try:
        combined_path.write_text("\n".join(parts), encoding="utf-8")
    except Exception as e:
        print(f"[MemoAI Network] Warning: could not write combined CA bundle: {e}")

    return combined_path


def patch_certifi(bundle_path: Path) -> None:
    """Monkeypatch certifi.where and certifi.contents so any library (like yt-dlp, httpx, requests)
    calling certifi automatically uses our unified CA bundle.
    """
    if bundle_path.is_file():
        bundle_str = str(bundle_path.resolve())
        certifi.where = lambda: bundle_str
        if hasattr(certifi, "contents"):
            certifi.contents = lambda: bundle_path.read_text(encoding="utf-8")


def patch_yt_dlp_ssl(app_set: AppSettings, bundle_path: Path) -> None:
    """Hook yt-dlp networking module to guarantee custom CA and insecure modes work reliably."""
    try:
        import yt_dlp.networking._helper as yt_helper
        if not hasattr(yt_helper, "_memoai_orig_make_ssl_context"):
            yt_helper._memoai_orig_make_ssl_context = yt_helper.make_ssl_context

        orig_fn = yt_helper._memoai_orig_make_ssl_context

        def _memoai_make_ssl_context(verify=True, **kwargs):
            if app_set.insecure_skip_verify:
                verify = False
            ctx = orig_fn(verify=verify, **kwargs)
            if verify and bundle_path.is_file():
                try:
                    ctx.load_verify_locations(cafile=str(bundle_path.resolve()))
                except Exception:
                    pass
            return ctx

        yt_helper.make_ssl_context = _memoai_make_ssl_context
    except Exception:
        pass


def get_active_network_settings(session: Optional[Session] = None) -> AppSettings:
    """Retrieve active network settings from the database, falling back to config.py/.env."""
    from memoai.db import engine

    def _query(s: Session) -> AppSettings | None:
        return s.exec(select(AppSettings).where(AppSettings.id == 1)).first()

    app_set = None
    if session:
        app_set = _query(session)
    else:
        try:
            with Session(engine) as s:
                app_set = _query(s)
        except Exception:
            pass

    if app_set:
        return app_set

    # Fallback to defaults from settings (from .env or environment)
    return AppSettings(
        id=1,
        proxy_enabled=settings.proxy_enabled,
        http_proxy=settings.http_proxy,
        https_proxy=settings.https_proxy,
        no_proxy=settings.no_proxy,
        ca_cert_path=settings.ca_cert_path or settings.ssl_cert_file or settings.requests_ca_bundle,
        insecure_skip_verify=settings.insecure_skip_verify,
    )


def apply_network_settings(app_set: Optional[AppSettings] = None) -> None:
    """Apply proxy and CA certificate environment variables globally.
    Ensures local connections (127.0.0.1, localhost) are always bypassed.
    """
    if app_set is None:
        app_set = get_active_network_settings()

    # 1. Configure Proxy
    if app_set.proxy_enabled and (app_set.http_proxy or app_set.https_proxy):
        proxy_url = app_set.https_proxy or app_set.http_proxy
        http_p = app_set.http_proxy or proxy_url
        https_p = app_set.https_proxy or proxy_url

        os.environ["HTTP_PROXY"] = http_p
        os.environ["http_proxy"] = http_p
        os.environ["HTTPS_PROXY"] = https_p
        os.environ["https_proxy"] = https_p

        no_p = app_set.no_proxy or "localhost,127.0.0.1"
        os.environ["NO_PROXY"] = no_p
        os.environ["no_proxy"] = no_p
    else:
        for var in ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"]:
            os.environ.pop(var, None)
        # Always safeguard local backend traffic
        os.environ["NO_PROXY"] = "localhost,127.0.0.1"
        os.environ["no_proxy"] = "localhost,127.0.0.1"

    # 2. Build unified CA bundle & patch libraries
    bundle_path = ensure_combined_ca_bundle(app_set)
    bundle_str = str(bundle_path.resolve())

    # Set standard SSL environment variables for Python, requests, curl, urllib
    os.environ["SSL_CERT_FILE"] = bundle_str
    os.environ["REQUESTS_CA_BUNDLE"] = bundle_str
    os.environ["CURL_CA_BUNDLE"] = bundle_str

    patch_certifi(bundle_path)
    patch_yt_dlp_ssl(app_set, bundle_path)

    # 3. Handle insecure_skip_verify
    if app_set.insecure_skip_verify:
        try:
            ssl._create_default_https_context = ssl._create_unverified_context
        except Exception:
            pass
    else:
        try:
            ssl._create_default_https_context = _ORIG_SSL_DEFAULT_HTTPS_CONTEXT
        except Exception:
            pass


def get_ssl_verify(app_set: Optional[AppSettings] = None) -> Union[str, bool]:
    """Get the SSL verify parameter for httpx or requests."""
    if app_set is None:
        app_set = get_active_network_settings()

    if app_set.insecure_skip_verify:
        return False

    bundle_path = ensure_combined_ca_bundle(app_set)
    if bundle_path.is_file():
        return str(bundle_path.resolve())

    return True


def get_proxy_url(app_set: Optional[AppSettings] = None) -> Optional[str]:
    """Get the active proxy URL if proxy is enabled."""
    if app_set is None:
        app_set = get_active_network_settings()

    if app_set.proxy_enabled:
        return app_set.https_proxy or app_set.http_proxy or None

    return None


def extract_host_port(url_or_host: str) -> tuple[str, Optional[int]]:
    """Clean and extract lowercase hostname and port from a URL or host string."""
    s = url_or_host.strip()
    if not s:
        return "", None
    if "://" not in s:
        s = "http://" + s
    p = urlparse(s)
    return (p.hostname or "").lower(), p.port


def is_target_bypassed_proxy(target_url: str, app_set: Optional[AppSettings] = None) -> bool:
    """Determine whether target_url should bypass the corporate proxy.
    Checks:
    1. Localhost, 127.0.0.1, ::1, 0.0.0.0, and .local addresses
    2. Private LAN IPs (10.x.x.x, 172.16-31.x.x, 192.168.x.x, 169.254.x.x)
    3. User-defined no_proxy list (supports hostname, full URL with/without port, wildcard *.domain, and CIDRs)
    """
    if not target_url:
        return False
    if app_set is None:
        app_set = get_active_network_settings()

    target_host, target_port = extract_host_port(target_url)
    if not target_host:
        return False

    # 1. Localhost / loopback / local domain
    if target_host in ("localhost", "127.0.0.1", "::1", "0.0.0.0") or target_host.endswith(".local"):
        return True

    # 2. Private LAN IP ranges
    try:
        ip = ipaddress.ip_address(target_host)
        if ip.is_private or ip.is_loopback:
            return True
    except ValueError:
        pass

    # 3. User-configured no_proxy
    no_proxy_str = app_set.no_proxy or "localhost,127.0.0.1"
    for raw_entry in no_proxy_str.replace(";", ",").split(","):
        entry = raw_entry.strip()
        if not entry:
            continue
        e_host, e_port = extract_host_port(entry)
        if not e_host:
            continue

        # If entry specifies a port, target must match both host and port
        if e_port is not None and target_port is not None and e_port != target_port:
            continue

        # Wildcard matching (e.g. *.corp.local)
        if e_host.startswith("*."):
            suffix = e_host[1:]
            if target_host.endswith(suffix):
                return True
        elif e_host.startswith("."):
            if target_host.endswith(e_host) or target_host == e_host[1:]:
                return True

        # CIDR matching
        try:
            net = ipaddress.ip_network(e_host, strict=False)
            t_ip = ipaddress.ip_address(target_host)
            if t_ip in net:
                return True
        except ValueError:
            pass

        # Exact hostname/IP match
        if target_host == e_host:
            return True

    return False


def get_proxy_for_target(
    target_url: Optional[str] = None,
    proxy_mode: Optional[str] = "auto",
    app_set: Optional[AppSettings] = None,
) -> Optional[str]:
    """Resolve whether to use proxy for a specific target URL or AI Profile.
    proxy_mode:
      - 'always': Always force proxy (e.g. Custom OpenAI Cloud)
      - 'never': Force direct connection (e.g. Internal Server / Ollama)
      - 'auto': Use proxy if enabled, unless bypassed by no_proxy / LAN
    """
    if app_set is None:
        app_set = get_active_network_settings()

    if not app_set.proxy_enabled:
        return None

    proxy_url = app_set.https_proxy or app_set.http_proxy or None
    if not proxy_url:
        return None

    mode = (proxy_mode or "auto").lower()
    if mode == "always":
        return proxy_url
    if mode == "never":
        return None

    # mode == 'auto'
    if target_url and is_target_bypassed_proxy(target_url, app_set):
        return None

    return proxy_url


def get_httpx_client(
    app_set: Optional[AppSettings] = None,
    target_url: Optional[str] = None,
    proxy_mode: Optional[str] = "auto",
    **kwargs
) -> httpx.Client:
    """Create an httpx.Client configured with active proxy and SSL certificate settings.
    Respects target_url and proxy_mode:
    - 'always': Always routes through proxy (for Custom OpenAI / Cloud API)
    - 'never': Direct connection (for internal models / Ollama)
    - 'auto': Checks target_url against no_proxy and private IP addresses
    """
    verify = kwargs.pop("verify", None)
    if verify is None:
        verify = get_ssl_verify(app_set)

    proxy = kwargs.pop("proxy", None)
    if proxy is None:
        proxy = get_proxy_for_target(target_url=target_url, proxy_mode=proxy_mode, app_set=app_set)

    timeout = kwargs.pop("timeout", 30.0)

    if proxy:
        return httpx.Client(verify=verify, proxy=proxy, timeout=timeout, **kwargs)
    return httpx.Client(verify=verify, timeout=timeout, **kwargs)


def test_network_connectivity(
    proxy_enabled: bool,
    http_proxy: Optional[str] = None,
    https_proxy: Optional[str] = None,
    ca_cert_path: Optional[str] = None,
    insecure_skip_verify: bool = False,
    no_proxy: Optional[str] = None,
) -> dict:
    """Test network and SSL connectivity to YouTube and Google Gemini API."""
    # Check if custom CA path is given and exists
    if ca_cert_path and not Path(ca_cert_path).is_file():
        return {
            "success": False,
            "message": f"Tệp chứng chỉ CA không tồn tại trên máy: {ca_cert_path}",
            "youtube": {"success": False, "message": "Không tìm thấy file CA"},
            "gemini": {"success": False, "message": "Không tìm thấy file CA"},
        }

    # Temporary AppSettings object for test evaluation
    test_set = AppSettings(
        id=999,
        proxy_enabled=proxy_enabled,
        http_proxy=http_proxy,
        https_proxy=https_proxy,
        no_proxy=no_proxy or "localhost,127.0.0.1",
        ca_cert_path=ca_cert_path,
        insecure_skip_verify=insecure_skip_verify,
    )

    proxy_url = get_proxy_url(test_set)
    verify = get_ssl_verify(test_set)

    results = {}

    # 1. Test YouTube
    t0 = time.time()
    try:
        client_kwargs = {"verify": verify, "timeout": 12.0, "follow_redirects": True}
        if proxy_url:
            client_kwargs["proxy"] = proxy_url

        with httpx.Client(**client_kwargs) as client:
            resp = client.get("https://www.youtube.com")
            yt_elapsed = int((time.time() - t0) * 1000)
            results["youtube"] = {
                "success": True,
                "latency_ms": yt_elapsed,
                "status_code": resp.status_code,
                "message": f"Kết nối YouTube thành công ({yt_elapsed}ms, HTTP {resp.status_code})",
            }
    except Exception as e:
        yt_elapsed = int((time.time() - t0) * 1000)
        err_msg = str(e)
        if "CERTIFICATE_VERIFY_FAILED" in err_msg or "SSLCertVerificationError" in err_msg:
            friendly = "Lỗi xác thực SSL khi kết nối YouTube. Vui lòng cung cấp file CA của công ty hoặc bật Insecure."
        elif "ConnectError" in err_msg or "ProxyError" in err_msg:
            friendly = f"Không thể kết nối qua Proxy tới YouTube ({proxy_url or 'Direct'}). Vui lòng kiểm tra lại địa chỉ Proxy."
        elif "Timeout" in err_msg:
            friendly = "Hết thời gian chờ kết nối tới YouTube (Timeout)."
        else:
            friendly = f"Lỗi kết nối YouTube: {err_msg}"

        results["youtube"] = {
            "success": False,
            "latency_ms": yt_elapsed,
            "error": err_msg,
            "message": friendly,
        }

    # 2. Test Google Gemini API Handshake
    t1 = time.time()
    try:
        client_kwargs = {"verify": verify, "timeout": 12.0, "follow_redirects": True}
        if proxy_url:
            client_kwargs["proxy"] = proxy_url

        with httpx.Client(**client_kwargs) as client:
            resp = client.get("https://generativelanguage.googleapis.com")
            gemini_elapsed = int((time.time() - t1) * 1000)
            results["gemini"] = {
                "success": True,
                "latency_ms": gemini_elapsed,
                "status_code": resp.status_code,
                "message": f"SSL Handshake tới Gemini API thành công ({gemini_elapsed}ms)",
            }
    except Exception as e:
        gemini_elapsed = int((time.time() - t1) * 1000)
        err_msg = str(e)
        if "CERTIFICATE_VERIFY_FAILED" in err_msg or "SSLCertVerificationError" in err_msg:
            friendly = "Lỗi chứng chỉ SSL Gemini API. Cần chỉ định file Root CA của doanh nghiệp (.ca, .pem)."
        elif "ConnectError" in err_msg or "ProxyError" in err_msg:
            friendly = f"Không thể kết nối qua Proxy tới Gemini API ({proxy_url or 'Direct'})."
        elif "Timeout" in err_msg:
            friendly = "Hết thời gian chờ kết nối tới Gemini API (Timeout)."
        else:
            friendly = f"Lỗi kết nối Gemini API: {err_msg}"

        results["gemini"] = {
            "success": False,
            "latency_ms": gemini_elapsed,
            "error": err_msg,
            "message": friendly,
        }

    all_success = results["youtube"]["success"] and results["gemini"]["success"]
    if all_success:
        summary_msg = "Kiểm tra thành công! Cả YouTube và Google Gemini API đều phản hồi tốt."
    else:
        fails = []
        if not results["youtube"]["success"]:
            fails.append("YouTube: " + results["youtube"]["message"])
        if not results["gemini"]["success"]:
            fails.append("Gemini: " + results["gemini"]["message"])
        summary_msg = "Kiểm tra thất bại: " + " | ".join(fails)

    return {
        "success": all_success,
        "message": summary_msg,
        "youtube": results["youtube"],
        "gemini": results["gemini"],
    }
