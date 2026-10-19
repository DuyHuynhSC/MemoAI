import os
import shutil
import tempfile
import threading
import time
import wave
from pathlib import Path
from typing import Any, Optional

try:
    from tqdm.auto import tqdm
except ImportError:
    class tqdm:  # type: ignore[no-redef]
        """Lightweight fallback progress tracker when tqdm is not installed."""
        def __init__(self, *args, **kwargs):
            self.total = kwargs.get("total", 0)
            self.n = 0

        def update(self, n=1):
            self.n += n

        def close(self):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            self.close()

from memoai.config import settings
from memoai.logger import logger
from memoai.services.hardware import get_hardware_info

# Fix compatibility between faster-whisper and newer PyAV versions (av >= 14 removed 'metadata_errors' parameter)
try:
    import av
    _orig_av_open = av.open

    def _safe_av_open(*args, **kwargs):
        if "metadata_errors" in kwargs:
            try:
                return _orig_av_open(*args, **kwargs)
            except TypeError as e:
                if "metadata_errors" in str(e):
                    kwargs.pop("metadata_errors", None)
                    return _orig_av_open(*args, **kwargs)
                raise e
        return _orig_av_open(*args, **kwargs)

    av.open = _safe_av_open
except ImportError:
    pass


OFFLINE_MODELS_CATALOG: list[dict[str, Any]] = [
    {
        "id": "tiny",
        "name": "Whisper Tiny",
        "repo_id": "Systran/faster-whisper-tiny",
        "size_mb": 75,
        "recommended_for": "low_spec",
        "description": "Siêu nhẹ, tốc độ cao nhất, thích hợp máy cấu hình thấp hoặc thử nghiệm nhanh.",
    },
    {
        "id": "base",
        "name": "Whisper Base",
        "repo_id": "Systran/faster-whisper-base",
        "size_mb": 145,
        "recommended_for": "cpu",
        "description": "Tiêu chuẩn cân bằng, chạy tốt trên CPU máy tính thông thường (8GB RAM).",
    },
    {
        "id": "small",
        "name": "Whisper Small",
        "repo_id": "Systran/faster-whisper-small",
        "size_mb": 480,
        "recommended_for": "cpu",
        "description": "Độ chính xác cao cho từ vựng và hội thoại hàng ngày, khuyến nghị máy 16GB RAM.",
    },
    {
        "id": "medium",
        "name": "Whisper Medium",
        "repo_id": "Systran/faster-whisper-medium",
        "size_mb": 1500,
        "recommended_for": "cpu_high",
        "description": "Độ chính xác rất cao, nhận diện chuẩn tiếng Nhật có ngữ cảnh phức tạp.",
    },
    {
        "id": "large-v3-turbo",
        "name": "Whisper Large v3 Turbo",
        "repo_id": "mobiuslabsgmbh/faster-whisper-large-v3-turbo",
        "size_mb": 1600,
        "recommended_for": "gpu",
        "description": "Phiên bản tối ưu cao nhất hiện nay, độ chuẩn xác vượt trội cho video, phim ảnh.",
    },
    {
        "id": "large-v3",
        "name": "Whisper Large v3",
        "repo_id": "Systran/faster-whisper-large-v3",
        "size_mb": 3100,
        "recommended_for": "gpu",
        "description": "Mô hình đầy đủ lớn nhất, xử lý âm thanh nhiễu và từ vựng chuyên ngành.",
    },
]

MODEL_REPOS: dict[str, str] = {
    m["id"]: m["repo_id"] for m in OFFLINE_MODELS_CATALOG
}


class DownloadJob:
    """Tracks state and progress of an offline model download."""

    def __init__(self, model_id: str, total_bytes: int = 0):
        self.model_id = model_id
        self.status = "idle"  # idle, downloading, completed, error, cancelled
        self.progress = 0.0
        self.downloaded_bytes = 0
        self.total_bytes = total_bytes
        self.speed_mb_s = 0.0
        self.eta_seconds: Optional[int] = None
        self.error_msg: Optional[str] = None
        self.started_at: float = 0.0
        self.finished_at: Optional[float] = None
        self.cancel_requested = False
        self._lock = threading.Lock()
        self._last_time = 0.0
        self._last_bytes = 0

    def start(self):
        with self._lock:
            self.status = "downloading"
            self.started_at = time.time()
            self._last_time = self.started_at
            self._last_bytes = 0
            self.progress = 0.0
            self.downloaded_bytes = 0
            self.error_msg = None
            self.cancel_requested = False

    def update_bytes(self, n: int):
        with self._lock:
            if self.cancel_requested:
                raise InterruptedError(f"Tải mô hình '{self.model_id}' đã bị hủy.")

            self.downloaded_bytes += n
            now = time.time()

            if self.total_bytes > 0:
                self.progress = min(1.0, round(self.downloaded_bytes / self.total_bytes, 4))
                remaining = max(0, self.total_bytes - self.downloaded_bytes)
            else:
                self.progress = 0.0
                remaining = 0

            dt = now - self._last_time
            if dt >= 0.5:
                bytes_diff = self.downloaded_bytes - self._last_bytes
                speed = bytes_diff / dt
                self.speed_mb_s = round(speed / (1024 * 1024), 2)
                if speed > 0 and remaining > 0:
                    self.eta_seconds = max(0, int(remaining / speed))
                self._last_time = now
                self._last_bytes = self.downloaded_bytes

    def complete(self):
        with self._lock:
            self.status = "completed"
            self.progress = 1.0
            self.speed_mb_s = 0.0
            self.eta_seconds = 0
            self.finished_at = time.time()

    def fail(self, err: str):
        with self._lock:
            self.status = "error"
            self.error_msg = err
            self.finished_at = time.time()

    def cancel(self):
        with self._lock:
            self.cancel_requested = True
            self.status = "cancelled"
            self.error_msg = "Tiến trình tải bị hủy bởi người dùng."
            self.finished_at = time.time()

    def to_dict(self) -> dict[str, Any]:
        with self._lock:
            return {
                "model_id": self.model_id,
                "status": self.status,
                "progress": self.progress,
                "downloaded_bytes": self.downloaded_bytes,
                "total_bytes": self.total_bytes,
                "speed_mb_s": self.speed_mb_s,
                "eta_seconds": self.eta_seconds,
                "error_msg": self.error_msg,
                "started_at": self.started_at,
                "finished_at": self.finished_at,
            }


class OfflineModelManager:
    """Manages local Faster-Whisper models: catalog, background download, cancellation, disk deletion, and testing."""

    def __init__(self):
        self.jobs: dict[str, DownloadJob] = {}
        self._lock = threading.Lock()

    def get_models_dir(self) -> Path:
        whisper_dir = settings.get_data_dir() / "models" / "whisper"
        whisper_dir.mkdir(parents=True, exist_ok=True)
        return whisper_dir

    def _get_candidate_dirs(self, model_id: str) -> list[Path]:
        whisper_dir = self.get_models_dir()
        repo_id = MODEL_REPOS.get(model_id, f"Systran/faster-whisper-{model_id}")
        slug = repo_id.replace("/", "--")
        hf_cache_dir = Path.home() / ".cache" / "huggingface" / "hub"

        return [
            whisper_dir / f"models--{slug}",
            whisper_dir / model_id,
            hf_cache_dir / f"models--{slug}",
        ]

    def is_model_downloaded(self, model_id: str) -> tuple[bool, Optional[str], float]:
        """Check if a model exists on disk.
        Returns: (is_downloaded, local_path_str, disk_size_mb)
        """
        for cand in self._get_candidate_dirs(model_id):
            if not cand.exists() or not cand.is_dir():
                continue

            # Check if model weight files exist
            has_weights = False
            for f in cand.rglob("*"):
                if f.is_file() and (
                    f.name in ("model.bin", "model.safetensors")
                    or f.suffix in (".bin", ".safetensors")
                ):
                    has_weights = True
                    break

            if has_weights:
                try:
                    total_bytes = sum(f.stat().st_size for f in cand.rglob("*") if f.is_file())
                    disk_size_mb = max(0.01, round(total_bytes / (1024 * 1024), 2)) if total_bytes > 0 else 0.0
                    return True, str(cand), disk_size_mb
                except Exception:
                    return True, str(cand), 0.0

        return False, None, 0.0

    def list_models(self) -> dict[str, Any]:
        """List all models in the catalog along with download progress and hardware recommendations."""
        hw = get_hardware_info()
        items = []

        for m in OFFLINE_MODELS_CATALOG:
            mid = m["id"]
            is_downloaded, local_path, disk_size_mb = self.is_model_downloaded(mid)
            job = self.jobs.get(mid)
            job_dict = job.to_dict() if job else None

            # Determine download status
            if job and job.status == "downloading":
                status = "downloading"
            elif is_downloaded:
                status = "completed"
            elif job and job.status in ("error", "cancelled"):
                status = job.status
            else:
                status = "not_downloaded"

            items.append({
                "id": mid,
                "name": m["name"],
                "repo_id": m["repo_id"],
                "size_mb": m["size_mb"],
                "recommended_for": m["recommended_for"],
                "description": m["description"],
                "is_recommended": (mid == hw.get("recommended_model")),
                "is_downloaded": is_downloaded,
                "local_path": local_path,
                "disk_size_mb": disk_size_mb,
                "status": status,
                "progress": job_dict["progress"] if job_dict else (1.0 if is_downloaded else 0.0),
                "downloaded_bytes": job_dict["downloaded_bytes"] if job_dict else (int(disk_size_mb * 1024 * 1024)),
                "total_bytes": job_dict["total_bytes"] if job_dict and job_dict["total_bytes"] > 0 else (m["size_mb"] * 1024 * 1024),
                "speed_mb_s": job_dict["speed_mb_s"] if job_dict else 0.0,
                "eta_seconds": job_dict["eta_seconds"] if job_dict else None,
                "error_msg": job_dict["error_msg"] if job_dict else None,
            })

        return {
            "engine": "faster_whisper",
            "models": items,
            "hardware": hw,
        }

    def get_progress(self, model_id: str) -> dict[str, Any]:
        """Get live download progress for a specific model."""
        is_downloaded, local_path, disk_size_mb = self.is_model_downloaded(model_id)
        job = self.jobs.get(model_id)

        if job:
            d = job.to_dict()
            d["is_downloaded"] = is_downloaded
            d["local_path"] = local_path
            d["disk_size_mb"] = disk_size_mb
            return d

        return {
            "model_id": model_id,
            "status": "completed" if is_downloaded else "not_downloaded",
            "progress": 1.0 if is_downloaded else 0.0,
            "downloaded_bytes": int(disk_size_mb * 1024 * 1024),
            "total_bytes": int(disk_size_mb * 1024 * 1024),
            "speed_mb_s": 0.0,
            "eta_seconds": None,
            "error_msg": None,
            "is_downloaded": is_downloaded,
            "local_path": local_path,
            "disk_size_mb": disk_size_mb,
        }

    def start_download(self, model_id: str) -> dict[str, Any]:
        """Start downloading a model in the background."""
        if model_id not in MODEL_REPOS:
            raise ValueError(f"Mô hình '{model_id}' không hợp lệ. Chọn một trong: {list(MODEL_REPOS.keys())}")

        with self._lock:
            # Check if currently downloading
            existing_job = self.jobs.get(model_id)
            if existing_job and existing_job.status == "downloading":
                return {
                    "ok": True,
                    "message": f"Mô hình '{model_id}' đang trong tiến trình tải.",
                    "status": "downloading",
                    "progress": existing_job.progress,
                }

            # Find size from catalog
            cat = next((m for m in OFFLINE_MODELS_CATALOG if m["id"] == model_id), None)
            total_bytes = (cat["size_mb"] * 1024 * 1024) if cat else 0

            job = DownloadJob(model_id=model_id, total_bytes=total_bytes)
            job.start()
            self.jobs[model_id] = job

        # Launch background thread
        thread = threading.Thread(
            target=self._download_worker,
            args=(model_id, job),
            daemon=True,
            name=f"DownloadWorker-{model_id}",
        )
        thread.start()

        return {
            "ok": True,
            "message": f"Đã bắt đầu tải mô hình '{model_id}'.",
            "status": "downloading",
            "model_id": model_id,
        }

    def _download_worker(self, model_id: str, job: DownloadJob):
        """Worker executing HuggingFace snapshot download with progress hooks and proxy support."""
        try:
            logger.info(f"Bắt đầu tải mô hình Faster-Whisper: {model_id}")
            # 1. Apply global proxy & CA certificates if configured
            try:
                from memoai.network import apply_network_settings
                apply_network_settings()
            except Exception as e:
                logger.warning(f"Không thể áp dụng cấu hình network/proxy: {e}")

            try:
                import huggingface_hub
            except ImportError:
                raise RuntimeError(
                    "Thư viện 'huggingface_hub' chưa được cài đặt trong môi trường. "
                    "Vui lòng cài đặt: uv pip install huggingface-hub"
                )

            repo_id = MODEL_REPOS[model_id]
            whisper_dir = self.get_models_dir()

            # 2. Build custom Tqdm progress tracker
            class ProgressTqdm(tqdm):
                def __init__(self, *args, **kwargs):
                    super().__init__(*args, **kwargs)

                def update(self, n=1):
                    super().update(n)
                    job.update_bytes(n)

            allow_patterns = [
                "config.json",
                "preprocessor_config.json",
                "model.bin",
                "model.safetensors",
                "tokenizer.json",
                "vocabulary.*",
            ]

            huggingface_hub.snapshot_download(
                repo_id=repo_id,
                cache_dir=str(whisper_dir),
                allow_patterns=allow_patterns,
                tqdm_class=ProgressTqdm,
                max_workers=4,
            )

            job.complete()
            logger.info(f"Tải thành công mô hình Faster-Whisper '{model_id}' vào '{whisper_dir}'")
        except InterruptedError:
            logger.info(f"Tiến trình tải mô hình '{model_id}' đã bị hủy thành công.")
            job.cancel()
        except Exception as e:
            err_str = str(e)
            logger.error(f"Lỗi khi tải mô hình '{model_id}': {err_str}", exc=e)
            job.fail(err_str)

    def cancel_download(self, model_id: str) -> dict[str, Any]:
        """Cancel an ongoing model download."""
        with self._lock:
            job = self.jobs.get(model_id)
            if not job or job.status != "downloading":
                return {
                    "ok": False,
                    "message": f"Mô hình '{model_id}' hiện không có tiến trình tải nào đang chạy.",
                }
            job.cancel()

        return {
            "ok": True,
            "message": f"Đã gửi yêu cầu hủy tải mô hình '{model_id}'.",
        }

    def delete_model(self, model_id: str) -> dict[str, Any]:
        """Delete model directories from disk to free up space."""
        # Cancel any active download first
        self.cancel_download(model_id)

        candidates = self._get_candidate_dirs(model_id)
        deleted_count = 0
        freed_mb = 0.0

        for cand in candidates:
            if cand.exists() and cand.is_dir():
                try:
                    size_bytes = sum(f.stat().st_size for f in cand.rglob("*") if f.is_file())
                    freed_mb += max(0.01, round(size_bytes / (1024 * 1024), 2)) if size_bytes > 0 else 0.0
                    shutil.rmtree(cand)
                    deleted_count += 1
                    logger.info(f"Đã xóa thư mục mô hình: {cand}")
                except Exception as e:
                    logger.warning(f"Không thể xóa thư mục {cand}: {e}")

        # Clear job history
        with self._lock:
            if model_id in self.jobs:
                del self.jobs[model_id]

        if deleted_count > 0:
            return {
                "ok": True,
                "message": f"Đã xóa mô hình '{model_id}' khỏi ổ đĩa (giải phóng ~{freed_mb}MB).",
                "freed_mb": freed_mb,
            }
        else:
            return {
                "ok": True,
                "message": f"Mô hình '{model_id}' không tồn tại trên ổ đĩa.",
                "freed_mb": 0.0,
            }

    def quick_test_model(self, model_id: str) -> dict[str, Any]:
        """Perform a rapid transcription inference test on the downloaded model."""
        is_downloaded, local_path, _ = self.is_model_downloaded(model_id)
        if not is_downloaded:
            return {
                "ok": False,
                "message": f"Mô hình '{model_id}' chưa được tải về máy. Hãy tải xuống trước khi thử nghiệm.",
            }

        from memoai.providers.asr.faster_whisper_asr import FasterWhisperASR

        t0 = time.time()
        try:
            provider = FasterWhisperASR(model_size_or_path=model_id, lazy_load=False)

            # Generate 0.2s synthetic 16kHz silent audio WAV
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp_path = Path(tmp.name)

            with wave.open(str(tmp_path), "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(16000)
                wf.writeframes(b"\x00\x00" * 3200)

            try:
                _ = provider.transcribe(tmp_path, language="ja")
            finally:
                if tmp_path.exists():
                    tmp_path.unlink()

            elapsed_ms = int((time.time() - t0) * 1000)
            return {
                "ok": True,
                "latency_ms": elapsed_ms,
                "device": provider.device,
                "compute_type": provider.compute_type,
                "message": f"Kiểm tra mô hình '{model_id}' thành công! Thiết bị: {provider.device.upper()} ({elapsed_ms}ms).",
            }
        except Exception as e:
            return {
                "ok": False,
                "latency_ms": int((time.time() - t0) * 1000),
                "message": f"Lỗi thử nghiệm mô hình '{model_id}': {e}",
            }


# Singleton model manager instance
model_manager = OfflineModelManager()
