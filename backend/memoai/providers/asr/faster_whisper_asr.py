import os
import threading
from pathlib import Path
from typing import Any
from memoai.config import settings
from memoai.logger import logger
from memoai.providers.asr.base import ASRProvider, Segment, WordTimestamp
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


class FasterWhisperASR(ASRProvider):
    """Offline ASR Provider powered by Faster-Whisper (CTranslate2).
    Runs completely on-device without cloud APIs or network access.
    Supports GPU acceleration (CUDA float16) and optimized CPU inference (int8).
    Includes automatic hardware detection, Silero VAD silence filtering, and CUDA-to-CPU fallback.
    """

    SUPPORTED_MODELS = [
        "tiny",
        "tiny.en",
        "base",
        "base.en",
        "small",
        "small.en",
        "medium",
        "medium.en",
        "large-v1",
        "large-v2",
        "large-v3",
        "large-v3-turbo",
    ]

    def __init__(
        self,
        model_size_or_path: str = "base",
        device: str = "auto",
        compute_type: str = "auto",
        download_root: Path | str | None = None,
        cpu_threads: int | None = None,
        vad_filter: bool = True,
        vad_parameters: dict | None = None,
        lazy_load: bool = False,
    ):
        self.model_size_or_path = model_size_or_path
        self.vad_filter = vad_filter
        self.vad_parameters = vad_parameters or {"min_silence_duration_ms": 500}
        self.cpu_threads = cpu_threads or min(4, os.cpu_count() or 4)

        # Configure download cache directory
        if download_root:
            self.download_root = Path(download_root)
        else:
            self.download_root = settings.get_data_dir() / "models" / "whisper"
        self.download_root.mkdir(parents=True, exist_ok=True)

        # Hardware and device resolution
        hw = get_hardware_info()
        if device == "auto":
            self.device = hw["recommended_device"]
        else:
            self.device = device.lower()

        if compute_type == "auto":
            self.compute_type = hw["recommended_compute_type"] if self.device == hw["recommended_device"] else (
                "float16" if self.device == "cuda" else "int8"
            )
        else:
            self.compute_type = compute_type

        self._model = None
        self._lock = threading.Lock()

        if not lazy_load:
            self._ensure_model_loaded()

    def _ensure_model_loaded(self):
        """Load Faster-Whisper model with thread safety and automatic CUDA fallback."""
        if self._model is not None:
            return self._model

        with self._lock:
            if self._model is not None:
                return self._model

            try:
                from faster_whisper import WhisperModel
            except ImportError as e:
                raise RuntimeError(
                    "Thư viện 'faster-whisper' chưa được cài đặt trong môi trường. "
                    "Vui lòng cài đặt: uv pip install faster-whisper"
                ) from e

            # Attempt 1: Load with chosen device (CUDA or CPU)
            try:
                logger.info(
                    f"Khởi tạo FasterWhisper: model='{self.model_size_or_path}', "
                    f"device='{self.device}', compute_type='{self.compute_type}', "
                    f"threads={self.cpu_threads}, cache='{self.download_root}'"
                )
                self._model = WhisperModel(
                    self.model_size_or_path,
                    device=self.device,
                    compute_type=self.compute_type,
                    download_root=str(self.download_root),
                    cpu_threads=self.cpu_threads,
                )
                return self._model
            except Exception as e:
                # If CUDA failed (missing cuDNN dll, OOM, driver mismatch), fall back to CPU safely
                if self.device == "cuda":
                    logger.warning(
                        f"Không thể khởi tạo FasterWhisper trên CUDA ({e}). "
                        f"Tự động chuyển sang chế độ dự phòng CPU (compute_type='int8')."
                    )
                    self.device = "cpu"
                    self.compute_type = "int8"
                    self._model = WhisperModel(
                        self.model_size_or_path,
                        device="cpu",
                        compute_type="int8",
                        download_root=str(self.download_root),
                        cpu_threads=self.cpu_threads,
                    )
                    return self._model
                else:
                    logger.error(f"Lỗi khởi tạo mô hình FasterWhisper: {e}", exc=e)
                    raise

    @property
    def model(self):
        return self._ensure_model_loaded()

    def transcribe(
        self,
        audio_path: Path,
        language: str = "ja",
        progress_cb: Any | None = None,
    ) -> list[Segment]:
        """Transcribe an audio file and return a list of timed segments with word timestamps."""
        audio_file = Path(audio_path)
        if not audio_file.exists():
            raise FileNotFoundError(f"Tệp âm thanh không tồn tại: {audio_file}")

        logger.info(
            f"Bắt đầu nhận dạng FasterWhisper: file={audio_file.name}, "
            f"lang={language}, model={self.model_size_or_path}, device={self.device}"
        )

        model = self.model
        segments_raw, info = model.transcribe(
            str(audio_file),
            language=language if language and language != "auto" else None,
            word_timestamps=True,
            beam_size=5,
            vad_filter=self.vad_filter,
            vad_parameters=self.vad_parameters,
        )

        total_duration = getattr(info, "duration", 0.0) or 0.0
        logger.info(
            f"FasterWhisper đã mở stream giải mã. Ngôn ngữ: '{info.language}' "
            f"(xác suất: {info.language_probability:.2f}), thời lượng: {total_duration:.2f}s"
        )

        segments: list[Segment] = []
        seg_idx = 1
        last_reported_time = 0.0

        for seg in segments_raw:
            clean_text = seg.text.strip()
            if not clean_text:
                continue

            words: list[WordTimestamp] = []
            if getattr(seg, "words", None):
                for w in seg.words:
                    word_clean = w.word.strip()
                    if word_clean:
                        words.append(
                            WordTimestamp(
                                word=w.word,
                                start=round(w.start, 2),
                                end=round(w.end, 2),
                                probability=round(getattr(w, "probability", 1.0) or 1.0, 2),
                            )
                        )

            segments.append(
                Segment(
                    id=seg_idx,
                    start=round(seg.start, 2),
                    end=round(seg.end, 2),
                    text=clean_text,
                    words=words,
                )
            )
            seg_idx += 1

            # Cập nhật tiến độ giải mã theo thời gian thực (từ 40% đến 70%)
            if progress_cb and total_duration > 0:
                cur_end = seg.end
                if cur_end - last_reported_time >= 5.0 or cur_end >= total_duration:
                    last_reported_time = cur_end
                    ratio = min(1.0, cur_end / total_duration)
                    current_pct = round(0.40 + ratio * 0.30, 2)
                    mins_cur, secs_cur = divmod(int(cur_end), 60)
                    mins_tot, secs_tot = divmod(int(total_duration), 60)
                    time_str = f"{mins_cur:02d}:{secs_cur:02d} / {mins_tot:02d}:{secs_tot:02d}"
                    progress_cb(
                        f"Nhận dạng giọng nói ({language}): {time_str} ({int(current_pct * 100)}%)...",
                        current_pct,
                    )

        logger.info(f"Tổng hợp thành công {len(segments)} đoạn phụ đề từ FasterWhisper.")
        return segments

    def get_info(self) -> dict[str, Any]:
        """Return runtime configuration information of the provider."""
        return {
            "provider": "faster_whisper",
            "model": self.model_size_or_path,
            "device": self.device,
            "compute_type": self.compute_type,
            "cpu_threads": self.cpu_threads,
            "vad_filter": self.vad_filter,
            "download_root": str(self.download_root),
        }
