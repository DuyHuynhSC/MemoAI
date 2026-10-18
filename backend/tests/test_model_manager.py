import time
from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from memoai.api.server import app
from memoai.services.model_manager import (
    OfflineModelManager,
    DownloadJob,
    OFFLINE_MODELS_CATALOG,
)


def test_download_job_state_flow():
    job = DownloadJob(model_id="test_model", total_bytes=10 * 1024 * 1024)
    assert job.status == "idle"
    assert job.progress == 0.0

    job.start()
    assert job.status == "downloading"
    assert job.started_at > 0

    # Advance bytes
    job.update_bytes(5 * 1024 * 1024)
    assert job.downloaded_bytes == 5 * 1024 * 1024
    assert job.progress == 0.5

    job.complete()
    assert job.status == "completed"
    assert job.progress == 1.0
    assert job.finished_at is not None

    d = job.to_dict()
    assert d["model_id"] == "test_model"
    assert d["status"] == "completed"
    assert d["progress"] == 1.0


def test_download_job_cancellation():
    job = DownloadJob(model_id="test_model", total_bytes=1000)
    job.start()
    job.cancel()
    assert job.status == "cancelled"
    assert job.cancel_requested is True

    # Calling update_bytes on cancelled job should raise InterruptedError
    with pytest.raises(InterruptedError):
        job.update_bytes(100)


def test_model_manager_list_models():
    mgr = OfflineModelManager()
    data = mgr.list_models()
    assert data["engine"] == "faster_whisper"
    assert "hardware" in data
    assert "models" in data
    assert len(data["models"]) == len(OFFLINE_MODELS_CATALOG)

    m_ids = [m["id"] for m in data["models"]]
    assert "tiny" in m_ids
    assert "base" in m_ids
    assert "small" in m_ids
    assert "large-v3-turbo" in m_ids


def test_model_manager_invalid_download():
    mgr = OfflineModelManager()
    with pytest.raises(ValueError, match="không hợp lệ"):
        mgr.start_download("invalid_model_id")


def test_model_manager_download_flow_with_mock():
    mgr = OfflineModelManager()

    with patch("huggingface_hub.snapshot_download") as mock_snap:
        # Simulate download calling tqdm update
        def fake_download(*args, **kwargs):
            tqdm_cls = kwargs.get("tqdm_class")
            if tqdm_cls:
                bar = tqdm_cls(total=1000)
                bar.update(500)
                bar.update(500)
            return "/path/to/downloaded"

        mock_snap.side_effect = fake_download

        res = mgr.start_download("tiny")
        assert res["ok"] is True
        assert res["status"] == "downloading"

        # Give background thread up to 1 second to finish
        for _ in range(20):
            prog = mgr.get_progress("tiny")
            if prog["status"] == "completed":
                break
            time.sleep(0.05)

        prog = mgr.get_progress("tiny")
        assert prog["status"] == "completed"
        assert prog["progress"] == 1.0


def test_model_manager_delete_model(tmp_path: Path):
    mgr = OfflineModelManager()
    models_dir = tmp_path / "models" / "whisper"
    models_dir.mkdir(parents=True, exist_ok=True)

    with patch.object(mgr, "get_models_dir", return_value=models_dir):
        # Create a fake model folder with weights
        fake_model_dir = models_dir / "models--Systran--faster-whisper-tiny"
        fake_model_dir.mkdir(parents=True, exist_ok=True)
        (fake_model_dir / "model.bin").write_bytes(b"WEIGHTS" * 1000)

        is_dl, local_path, size_mb = mgr.is_model_downloaded("tiny")
        assert is_dl is True
        assert local_path is not None
        assert size_mb > 0

        # Delete it
        res = mgr.delete_model("tiny")
        assert res["ok"] is True
        assert res["freed_mb"] > 0
        assert not fake_model_dir.exists()

        is_dl_after, _, _ = mgr.is_model_downloaded("tiny")
        assert is_dl_after is False


def test_api_offline_models_endpoints():
    client = TestClient(app)

    # 1. List models
    res1 = client.get("/api/asr/offline/models")
    assert res1.status_code == 200
    d1 = res1.json()
    assert d1["engine"] == "faster_whisper"
    assert len(d1["models"]) >= 4

    # 2. Get progress of a model
    res2 = client.get("/api/asr/offline/models/base/progress")
    assert res2.status_code == 200
    d2 = res2.json()
    assert d2["model_id"] == "base"
    assert "status" in d2

    # 3. Invalid model download
    res3 = client.post("/api/asr/offline/models/unknown_model/download")
    assert res3.status_code == 400

    # 4. Cancel download endpoint
    res4 = client.post("/api/asr/offline/models/base/cancel")
    assert res4.status_code == 200

    # 5. Delete model endpoint (mocked to avoid deleting user downloaded models)
    with patch("memoai.api.server.model_manager.delete_model", return_value={"ok": True, "freed_mb": 10.0}):
        res5 = client.delete("/api/asr/offline/models/base")
        assert res5.status_code == 200
        assert res5.json()["ok"] is True

