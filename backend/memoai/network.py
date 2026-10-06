import os
import time
from pathlib import Path
from typing import Optional, Union
import httpx
from sqlmodel import Session, select

from memoai.config import settings
from memoai.models import AppSettings


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

    # 2. Configure Custom CA Certificate
    ca_path = None
    if app_set.ca_cert_path and Path(app_set.ca_cert_path).is_file():
        ca_path = str(Path(app_set.ca_cert_path).resolve())
    elif settings.ca_cert_path and Path(settings.ca_cert_path).is_file():
        ca_path = str(Path(settings.ca_cert_path).resolve())
    elif settings.ssl_cert_file and Path(settings.ssl_cert_file).is_file():
        ca_path = str(Path(settings.ssl_cert_file).resolve())
    elif settings.requests_ca_bundle and Path(settings.requests_ca_bundle).is_file():
        ca_path = str(Path(settings.requests_ca_bundle).resolve())

    if ca_path:
        os.environ["REQUESTS_CA_BUNDLE"] = ca_path
        os.environ["SSL_CERT_FILE"] = ca_path
        os.environ["CURL_CA_BUNDLE"] = ca_path
    else:
        os.environ.pop("REQUESTS_CA_BUNDLE", None)
        os.environ.pop("SSL_CERT_FILE", None)
        os.environ.pop("CURL_CA_BUNDLE", None)


def get_ssl_verify(app_set: Optional[AppSettings] = None) -> Union[str, bool]:
    """Get the SSL verify parameter for httpx or requests."""
    if app_set is None:
        app_set = get_active_network_settings()

    if app_set.insecure_skip_verify:
        return False

    if app_set.ca_cert_path and Path(app_set.ca_cert_path).is_file():
        return str(Path(app_set.ca_cert_path).resolve())

    if settings.ca_cert_path and Path(settings.ca_cert_path).is_file():
        return str(Path(settings.ca_cert_path).resolve())

    if settings.ssl_cert_file and Path(settings.ssl_cert_file).is_file():
        return str(Path(settings.ssl_cert_file).resolve())

    return True


def get_proxy_url(app_set: Optional[AppSettings] = None) -> Optional[str]:
    """Get the active proxy URL if proxy is enabled."""
    if app_set is None:
        app_set = get_active_network_settings()

    if app_set.proxy_enabled:
        return app_set.https_proxy or app_set.http_proxy or None

    return None


def get_httpx_client(app_set: Optional[AppSettings] = None, **kwargs) -> httpx.Client:
    """Create an httpx.Client configured with active proxy and SSL certificate settings."""
    verify = kwargs.pop("verify", None)
    if verify is None:
        verify = get_ssl_verify(app_set)

    proxy = kwargs.pop("proxy", None)
    if proxy is None:
        proxy = get_proxy_url(app_set)

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
    proxy_url = None
    if proxy_enabled:
        proxy_url = https_proxy or http_proxy

    # Resolve verify target
    if insecure_skip_verify:
        verify: Union[str, bool] = False
    elif ca_cert_path and Path(ca_cert_path).is_file():
        verify = str(Path(ca_cert_path).resolve())
    elif ca_cert_path:
        return {
            "success": False,
            "message": f"Tệp chứng chỉ CA không tồn tại trên máy: {ca_cert_path}",
            "youtube": {"success": False, "message": "Không tìm thấy file CA"},
            "gemini": {"success": False, "message": "Không tìm thấy file CA"},
        }
    else:
        verify = True

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
