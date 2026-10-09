from pathlib import Path
from memoai.logger import ProjectLogger, read_project_log, get_project_log_path
from memoai.models import Project
from memoai.db import engine
from sqlmodel import Session


def test_project_logger(tmp_path: Path):
    log_file = tmp_path / "pipeline.log"
    logger = ProjectLogger(project_id=999, log_file=log_file)
    logger.info("Starting test pipeline")
    logger.warning("Test warning event")
    try:
        raise ValueError("Simulated pipeline error")
    except Exception as e:
        logger.error("Step failed", exc=e)

    assert log_file.is_file()
    content = log_file.read_text(encoding="utf-8")
    assert "Starting test pipeline" in content
    assert "Test warning event" in content
    assert "Step failed" in content
    assert "ValueError: Simulated pipeline error" in content


def test_project_logs_api(tmp_path: Path):
    from fastapi.testclient import TestClient
    from memoai.api.server import app

    client = TestClient(app)

    # 1. Create a dummy project in DB
    with Session(engine) as session:
        p = Project(
            title="Test Error Project",
            source_type="file",
            source_uri="test.mp4",
            status="error",
            current_step="Lỗi: Trích xuất âm thanh",
            error_msg="FileNotFoundError: ffmpeg not found",
        )
        session.add(p)
        session.commit()
        session.refresh(p)
        pid = p.id

    # Write a test log
    log_path = get_project_log_path(pid)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text("[INFO] Started project\n[ERROR] ffmpeg missing\n", encoding="utf-8")

    # 2. Call GET /api/projects/{pid}/logs
    res = client.get(f"/api/projects/{pid}/logs")
    assert res.status_code == 200
    data = res.json()
    assert data["project_id"] == pid
    assert data["status"] == "error"
    assert "ffmpeg not found" in data["error_msg"]
    assert "ffmpeg missing" in data["logs"]

    # 3. Call POST /api/projects/{pid}/retry
    res_retry = client.post(f"/api/projects/{pid}/retry")
    assert res_retry.status_code == 200
    data_retry = res_retry.json()
    assert data_retry["status"] == "processing"
    assert data_retry["error_msg"] is None

    # Clean up DB
    with Session(engine) as session:
        p_clean = session.get(Project, pid)
        if p_clean:
            session.delete(p_clean)
            session.commit()
