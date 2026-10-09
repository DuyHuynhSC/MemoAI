import json
import time
import shutil
import subprocess
import tempfile
from pathlib import Path
from pydantic import BaseModel
from google import genai
from google.genai import types
from google.genai import errors
from memoai.providers.asr.base import ASRProvider, Segment
from memoai.media import get_media_duration


class GeminiSegmentOutput(BaseModel):
    start: float
    end: float
    text: str


class GeminiASROutput(BaseModel):
    segments: list[GeminiSegmentOutput]


FALLBACK_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-flash-latest",
]


class GeminiASR(ASRProvider):
    """ASR using Google Gemini Multimodal Audio capability.
    Uses Inline Audio (types.Part.from_bytes) by default to prevent blocking by corporate firewalls
    that restrict file uploads. Includes automatic retry with exponential backoff on 503/429 and fallback models.
    """

    def __init__(self, api_key: str | None = None, model: str = "gemini-2.5-flash"):
        self.api_key = api_key
        self.model = model
        from memoai.network import get_ssl_verify, get_proxy_url
        verify = get_ssl_verify()
        proxy = get_proxy_url()
        client_args = {}
        if verify is not True:
            client_args["verify"] = verify
        if proxy:
            client_args["proxy"] = proxy
        http_options = types.HttpOptions(client_args=client_args) if client_args else None
        self.client = genai.Client(api_key=self.api_key, http_options=http_options)

    def _convert_to_mp3(
        self,
        audio_path: Path,
        start_sec: float | None = None,
        duration_sec: float | None = None
    ) -> Path:
        """Compress audio to highly compact 16kHz mono MP3 (32kbps) using ffmpeg."""
        ffmpeg_cmd = shutil.which("ffmpeg") or "ffmpeg"
        temp_file = Path(tempfile.NamedTemporaryFile(suffix=".mp3", delete=False).name)

        cmd = [ffmpeg_cmd, "-y"]
        if start_sec is not None and start_sec > 0:
            cmd.extend(["-ss", f"{start_sec:.2f}"])
        cmd.extend(["-i", str(audio_path)])
        if duration_sec is not None and duration_sec > 0:
            cmd.extend(["-t", f"{duration_sec:.2f}"])
        cmd.extend(["-vn", "-ar", "16000", "-ac", "1", "-b:a", "32k", "-f", "mp3", str(temp_file)])

        subprocess.run(cmd, capture_output=True, check=True)
        return temp_file

    def _call_generate_with_retry(self, audio_part, prompt: str) -> str:
        from memoai.logger import get_logger
        logger = get_logger("memoai.asr.gemini")

        models_to_try = [self.model] + [m for m in FALLBACK_MODELS if m != self.model]
        last_error = None

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=GeminiASROutput,
            temperature=0.0,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )

        for model_name in models_to_try:
            logger.info(f"Gửi yêu cầu nhận dạng âm thanh Inline tới Gemini model: {model_name}")
            for attempt in range(1, 4):
                try:
                    response = self.client.models.generate_content(
                        model=model_name,
                        contents=[audio_part, prompt],
                        config=config,
                    )
                    logger.info(f"Gemini ASR Inline ({model_name}) phản hồi thành công (attempt {attempt})")
                    return response.text or "{}"
                except (errors.APIError, Exception) as e:
                    err_msg = str(e)
                    last_error = e
                    logger.warning(f"Lỗi Gemini ASR Inline (model={model_name}, attempt={attempt}/3): {e}")
                    is_transient = (
                        "503" in err_msg
                        or "429" in err_msg
                        or "UNAVAILABLE" in err_msg
                        or "RESOURCE_EXHAUSTED" in err_msg
                        or "timeout" in err_msg.lower()
                        or "connect" in err_msg.lower()
                        or "ssl" in err_msg.lower()
                    )
                    if is_transient:
                        wait_sec = attempt * 3
                        logger.info(f"Chờ {wait_sec}s rồi thử lại Gemini ASR Inline...")
                        time.sleep(wait_sec)
                        continue
                    else:
                        break

        err_final = f"Nhận dạng giọng nói Inline thất bại trên tất cả model Gemini ({', '.join(models_to_try)}): {last_error}"
        logger.error(err_final)
        raise RuntimeError(err_final) from last_error

    def _transcribe_single_part(
        self,
        audio_part,
        language: str,
        time_offset: float = 0.0
    ) -> list[Segment]:
        from memoai.logger import get_logger
        logger = get_logger("memoai.asr.gemini")

        lang_name = "Japanese" if language == "ja" else language
        prompt = (
            f"You are a professional audio transcriber. Listen carefully to the audio and transcribe "
            f"every spoken sentence in {lang_name} with accurate timestamps in seconds.\n"
            f"Break down sentences at natural pauses (about 2-7 seconds per segment).\n"
            f"Do not hallucinate, do not summarize, transcribe exactly what is said. "
            f"If no speech is detected in the audio, return an empty segments list."
        )

        raw_text = self._call_generate_with_retry(audio_part, prompt)
        clean_text = raw_text.strip()
        if clean_text.startswith("```"):
            lines = clean_text.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            clean_text = "\n".join(lines).strip()

        try:
            data = json.loads(clean_text)
        except json.JSONDecodeError as jde:
            logger.error(f"Lỗi phân tích JSON kết quả Gemini ASR: {jde}. Raw: {clean_text[:500]}")
            raise RuntimeError(f"Lỗi phân tích cú pháp JSON từ Gemini ASR: {jde}") from jde

        segments_data = data.get("segments", [])
        segments: list[Segment] = []
        for item in segments_data:
            s_start = float(item.get("start", 0.0)) + time_offset
            s_end = float(item.get("end", 0.0)) + time_offset
            s_text = str(item.get("text", "")).strip()
            if s_text:
                segments.append(Segment(start=s_start, end=s_end, text=s_text))
        return segments

    def transcribe(self, audio_path: Path, language: str = "ja") -> list[Segment]:
        from memoai.logger import get_logger
        logger = get_logger("memoai.asr.gemini")

        audio_size = audio_path.stat().st_size if audio_path.exists() else 0
        logger.info(f"Bắt đầu ASR với Gemini Inline: audio={audio_path} ({audio_size} bytes), lang={language}")

        # Get total media duration
        try:
            total_duration = get_media_duration(audio_path)
        except Exception as e:
            logger.warning(f"Không thể đo thời lượng audio qua ffprobe: {e}. Coi như tệp ngắn.")
            total_duration = 0.0

        CHUNK_DURATION = 120.0  # 2 minutes per chunk (approx 480 KB MP3) to pass through corporate proxies safely
        all_segments: list[Segment] = []

        if total_duration > CHUNK_DURATION:
            num_chunks = int(total_duration // CHUNK_DURATION) + (1 if total_duration % CHUNK_DURATION > 0 else 0)
            logger.info(f"Thời lượng audio ({total_duration:.1f}s) vượt quá 2 phút. Chia làm {num_chunks} đoạn nhỏ để truyền qua Proxy an toàn.")

            for i in range(num_chunks):
                chunk_start = i * CHUNK_DURATION
                chunk_dur = min(CHUNK_DURATION, total_duration - chunk_start)
                logger.info(f"Xử lý đoạn {i + 1}/{num_chunks}: từ {chunk_start:.1f}s đến {chunk_start + chunk_dur:.1f}s...")

                mp3_temp = None
                try:
                    mp3_temp = self._convert_to_mp3(audio_path, start_sec=chunk_start, duration_sec=chunk_dur)
                    mp3_bytes = mp3_temp.read_bytes()
                    audio_part = types.Part.from_bytes(data=mp3_bytes, mime_type="audio/mp3")
                    chunk_segs = self._transcribe_single_part(audio_part, language=language, time_offset=chunk_start)
                    all_segments.extend(chunk_segs)
                finally:
                    if mp3_temp and mp3_temp.exists():
                        mp3_temp.unlink(missing_ok=True)
        else:
            mp3_temp = None
            try:
                logger.info("Nén audio sang mono 16kHz 32kbps MP3 để truyền Inline qua JSON...")
                mp3_temp = self._convert_to_mp3(audio_path)
                mp3_bytes = mp3_temp.read_bytes()
                logger.info(f"Kích thước audio Inline sau nén: {len(mp3_bytes)} bytes (không dùng Files API upload).")
                audio_part = types.Part.from_bytes(data=mp3_bytes, mime_type="audio/mp3")
                all_segments = self._transcribe_single_part(audio_part, language=language, time_offset=0.0)
            finally:
                if mp3_temp and mp3_temp.exists():
                    mp3_temp.unlink(missing_ok=True)

        logger.info(f"Hoàn thành Gemini ASR Inline: {len(all_segments)} segments được nhận diện.")
        return all_segments

