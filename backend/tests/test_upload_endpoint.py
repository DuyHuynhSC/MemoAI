import io
from fastapi.testclient import TestClient
from memoai.api.server import app


def test_upload_project_media(monkeypatch):
    # Mock background run_pipeline_task so background tasks don't run real ffmpeg/ASR
    monkeypatch.setattr("memoai.api.server.run_pipeline_task", lambda pid, req: None)

    client = TestClient(app)
    fake_video = io.BytesIO(b"fake video binary content")
    response = client.post(
        "/api/projects/upload",
        files={"file": ("mobile_test_video.mp4", fake_video, "video/mp4")},
        data={
            "title": "Bài học từ Mobile",
            "source_lang": "ja",
            "target_lang": "vi",
            "mode": "learning",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Bài học từ Mobile"
    assert data["source_type"] == "file"
    assert "mobile_test_video.mp4" in data["source_uri"]
    assert data["status"] == "processing"
