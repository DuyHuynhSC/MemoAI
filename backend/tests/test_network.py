import os
from pathlib import Path
from fastapi.testclient import TestClient
from memoai.models import AppSettings
from memoai.network import (
    apply_network_settings,
    get_ssl_verify,
    get_proxy_url,
    get_httpx_client,
    test_network_connectivity as run_test_network_connectivity,
)

from memoai.media import get_yt_dlp_options
from memoai.api.server import app

client = TestClient(app)


def test_apply_network_settings_disabled():
    settings = AppSettings(
        id=1,
        proxy_enabled=False,
        http_proxy="http://proxy.test:8080",
        https_proxy="http://proxy.test:8080",
        no_proxy="localhost,127.0.0.1",
        ca_cert_path=None,
    )
    apply_network_settings(settings)

    assert "HTTP_PROXY" not in os.environ
    assert "HTTPS_PROXY" not in os.environ
    assert "localhost,127.0.0.1" in os.environ.get("NO_PROXY", "")


def test_apply_network_settings_enabled(tmp_path):
    cert_file = tmp_path / "test_ca.pem"
    cert_file.write_text("-----BEGIN CERTIFICATE-----\nTEST_CERT_CONTENT\n-----END CERTIFICATE-----", encoding="utf-8")

    settings = AppSettings(
        id=1,
        proxy_enabled=True,
        http_proxy="http://company-proxy.com:8080",
        https_proxy="http://company-proxy.com:8080",
        no_proxy="localhost,127.0.0.1,internal.domain",
        ca_cert_path=str(cert_file),
    )
    apply_network_settings(settings)

    assert os.environ["HTTP_PROXY"] == "http://company-proxy.com:8080"
    assert os.environ["HTTPS_PROXY"] == "http://company-proxy.com:8080"
    assert os.environ["NO_PROXY"] == "localhost,127.0.0.1,internal.domain"
    assert "memoai_combined_ca.pem" in os.environ["SSL_CERT_FILE"]
    bundle_text = Path(os.environ["SSL_CERT_FILE"]).read_text(encoding="utf-8")
    assert "TEST_CERT_CONTENT" in bundle_text

    # Clean up
    apply_network_settings(AppSettings(id=1, proxy_enabled=False, ca_cert_path=None))


def test_get_ssl_verify_and_proxy_url(tmp_path):
    cert_file = tmp_path / "root.ca"
    cert_file.write_text("CERT_CONTENT", encoding="utf-8")

    # Insecure
    s_insecure = AppSettings(id=1, insecure_skip_verify=True)
    assert get_ssl_verify(s_insecure) is False

    # Valid CA or default returns combined bundle path
    s_ca = AppSettings(id=1, insecure_skip_verify=False, ca_cert_path=str(cert_file))
    verify_path = get_ssl_verify(s_ca)
    assert isinstance(verify_path, str)
    assert "memoai_combined_ca.pem" in verify_path

    # Proxy URL
    s_proxy_off = AppSettings(id=1, proxy_enabled=False, http_proxy="http://p:8080")
    assert get_proxy_url(s_proxy_off) is None

    s_proxy_on = AppSettings(id=1, proxy_enabled=True, http_proxy="http://p:8080")
    assert get_proxy_url(s_proxy_on) == "http://p:8080"


def test_get_yt_dlp_options(tmp_path, monkeypatch):
    cert_file = tmp_path / "corp.crt"
    cert_file.write_text("CRT", encoding="utf-8")

    test_settings = AppSettings(
        id=1,
        proxy_enabled=True,
        http_proxy="http://proxy2.fujinet.vn:8080",
        ca_cert_path=str(cert_file),
        insecure_skip_verify=False,
    )
    monkeypatch.setattr("memoai.network.get_active_network_settings", lambda: test_settings)

    opts = get_yt_dlp_options({"skip_download": True})
    assert opts["proxy"] == "http://proxy2.fujinet.vn:8080"
    assert opts["retries"] == 10
    assert opts.get("nocheckcertificate") is None
    assert opts["skip_download"] is True

    # Insecure skip verify
    test_settings_insecure = AppSettings(
        id=1,
        proxy_enabled=True,
        http_proxy="http://proxy2.fujinet.vn:8080",
        insecure_skip_verify=True,
    )
    monkeypatch.setattr("memoai.network.get_active_network_settings", lambda: test_settings_insecure)
    opts2 = get_yt_dlp_options()
    assert opts2["nocheckcertificate"] is True
    assert opts2["no_check_certificate"] is True


def test_download_media_retry(tmp_path, monkeypatch):
    from memoai.media import download_media
    import yt_dlp

    attempts = 0

    class DummyYDL:
        def __init__(self, opts):
            self.opts = opts
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def extract_info(self, url, download=True):
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                raise RuntimeError("Temporary SSL or network glitch")
            out_file = tmp_path / "test_video.mp4"
            out_file.write_text("dummy video")
            return {"id": "test_video", "title": "Test Title"}
        def prepare_filename(self, info):
            return str(tmp_path / "test_video.mp4")

    monkeypatch.setattr(yt_dlp, "YoutubeDL", DummyYDL)

    progress_steps = []
    file_path, info = download_media(
        "https://www.youtube.com/watch?v=dummy",
        tmp_path,
        progress_cb=lambda step, p: progress_steps.append(step),
        max_retries=3,
    )

    assert attempts == 2
    assert file_path.exists()
    assert info["title"] == "Test Title"
    assert any("thử lại" in s.lower() for s in progress_steps)



def test_network_connectivity_missing_ca():
    res = run_test_network_connectivity(
        proxy_enabled=False,
        ca_cert_path="C:\\non_existent_folder\\fake_cert.ca"
    )

    assert res["success"] is False
    assert "không tồn tại" in res["message"]


def test_settings_api_proxy_and_ca():
    # 1. Update settings
    payload = {
        "proxy_enabled": True,
        "http_proxy": "http://proxy2.fujinet.vn:8080",
        "https_proxy": "http://proxy2.fujinet.vn:8080",
        "no_proxy": "localhost,127.0.0.1",
        "ca_cert_path": "C:\\test\\fujinet.ca",
        "insecure_skip_verify": False,
    }
    put_res = client.put("/api/settings", json=payload)
    assert put_res.status_code == 200
    data = put_res.json()
    assert data["proxy_enabled"] is True
    assert data["http_proxy"] == "http://proxy2.fujinet.vn:8080"
    assert data["ca_cert_path"] == "C:\\test\\fujinet.ca"

    # 2. Get settings
    get_res = client.get("/api/settings")
    assert get_res.status_code == 200
    get_data = get_res.json()
    assert get_data["settings"]["proxy_enabled"] is True
    assert get_data["settings"]["http_proxy"] == "http://proxy2.fujinet.vn:8080"

    # 3. Upload CA cert
    cert_payload = {
        "filename": "fujinet_root.ca",
        "content": "-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIU...\n-----END CERTIFICATE-----"
    }
    upload_res = client.post("/api/settings/upload-ca", json=cert_payload)
    assert upload_res.status_code == 200
    upload_data = upload_res.json()
    assert upload_data["filename"] == "fujinet_root.ca"
    assert Path(upload_data["file_path"]).exists()

    # 4. Revert settings to proxy disabled
    client.put("/api/settings", json={"proxy_enabled": False, "ca_cert_path": None})
