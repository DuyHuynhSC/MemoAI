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
    cert_file.write_text("-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----", encoding="utf-8")

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
    assert os.environ["SSL_CERT_FILE"] == str(cert_file.resolve())
    assert os.environ["REQUESTS_CA_BUNDLE"] == str(cert_file.resolve())

    # Clean up
    apply_network_settings(AppSettings(id=1, proxy_enabled=False, ca_cert_path=None))


def test_get_ssl_verify_and_proxy_url(tmp_path):
    cert_file = tmp_path / "root.ca"
    cert_file.write_text("CERT_CONTENT", encoding="utf-8")

    # Insecure
    s_insecure = AppSettings(id=1, insecure_skip_verify=True)
    assert get_ssl_verify(s_insecure) is False

    # Valid CA
    s_ca = AppSettings(id=1, insecure_skip_verify=False, ca_cert_path=str(cert_file))
    assert get_ssl_verify(s_ca) == str(cert_file.resolve())

    # Default
    s_default = AppSettings(id=1, insecure_skip_verify=False, ca_cert_path=None)
    assert get_ssl_verify(s_default) is True

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
    assert opts["cafile"] == str(cert_file.resolve())
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
