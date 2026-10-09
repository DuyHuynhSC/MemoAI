import os
import sys
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
from memoai.config import settings

LOG_FORMAT = "%(asctime)s [%(levelname)s] [%(name)s] %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

_configured = False


def setup_logging() -> logging.Logger:
    global _configured
    logger = logging.getLogger("memoai")

    if _configured:
        return logger

    logger.setLevel(logging.INFO)
    formatter = logging.Formatter(LOG_FORMAT, datefmt=DATE_FORMAT)

    # 1. Console handler (sys.stderr)
    console_handler = logging.StreamHandler(sys.stderr)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # 2. Global file handler in ~/.memoai/logs/memoai.log
    try:
        logs_dir = settings.get_data_dir() / "logs"
        logs_dir.mkdir(parents=True, exist_ok=True)
        log_file = logs_dir / "memoai.log"
        file_handler = RotatingFileHandler(
            str(log_file),
            maxBytes=10 * 1024 * 1024,  # 10 MB
            backupCount=5,
            encoding="utf-8"
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    except Exception as e:
        sys.stderr.write(f"Warning: could not initialize file logger: {e}\n")

    _configured = True
    return logger


def get_logger(name: str = "memoai") -> logging.Logger:
    setup_logging()
    return logging.getLogger(name)


class ProjectLogger:
    """Logger that writes both to standard logger and a per-project pipeline.log file."""

    def __init__(self, project_id: int, log_file: Path | None = None):
        self.project_id = project_id
        self.logger = get_logger(f"memoai.project_{project_id}")
        self.log_file = log_file

        if self.log_file:
            self.log_file.parent.mkdir(parents=True, exist_ok=True)

    def _write_file(self, level: str, msg: str):
        if not self.log_file:
            return
        import datetime
        now = datetime.datetime.now().strftime(DATE_FORMAT)
        line = f"[{now}] [{level}] {msg}\n"
        try:
            with open(self.log_file, "a", encoding="utf-8") as f:
                f.write(line)
        except Exception:
            pass

    def info(self, msg: str):
        self.logger.info(f"[Project {self.project_id}] {msg}")
        self._write_file("INFO", msg)

    def warning(self, msg: str):
        self.logger.warning(f"[Project {self.project_id}] {msg}")
        self._write_file("WARNING", msg)

    def error(self, msg: str, exc: Exception | None = None):
        self.logger.error(f"[Project {self.project_id}] {msg}", exc_info=exc is not None)
        self._write_file("ERROR", msg)
        if exc is not None:
            import traceback
            tb = traceback.format_exc()
            self._write_file("TRACEBACK", tb)


def get_project_log_path(project_id: int) -> Path:
    return settings.get_data_dir() / f"project_{project_id}" / "pipeline.log"


def read_project_log(project_id: int) -> str:
    log_path = get_project_log_path(project_id)
    if log_path.is_file():
        try:
            return log_path.read_text(encoding="utf-8")
        except Exception as e:
            return f"Lỗi đọc file log: {e}"
    return ""
