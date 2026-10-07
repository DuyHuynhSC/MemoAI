import json
import time
from pathlib import Path
from pydantic import BaseModel
from google import genai
from google.genai import types
from google.genai import errors
from memoai.providers.asr.base import ASRProvider, Segment


class GeminiSegmentOutput(BaseModel):
    start: float
    end: float
    text: str


class GeminiASROutput(BaseModel):
    segments: list[GeminiSegmentOutput]


FALLBACK_MODELS = [
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
]


class GeminiASR(ASRProvider):
    """ASR using Google Gemini Multimodal Audio capability.
    Includes automatic retry with exponential backoff on 503/429 and fallback models.
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


    def _call_generate_with_retry(self, uploaded_file, prompt: str) -> str:
        models_to_try = [self.model] + [m for m in FALLBACK_MODELS if m != self.model]
        last_error = None

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=GeminiASROutput,
            temperature=0.0,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )

        for model_name in models_to_try:
            for attempt in range(1, 4):
                try:
                    response = self.client.models.generate_content(
                        model=model_name,
                        contents=[uploaded_file, prompt],
                        config=config,
                    )
                    return response.text or "{}"
                except (errors.APIError, Exception) as e:
                    err_msg = str(e)
                    last_error = e
                    # Check if 503 (high demand) or 429 (rate limit)
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
                        time.sleep(wait_sec)
                        continue
                    else:
                        # Non-transient error, don't retry this model
                        break

        raise last_error or RuntimeError("Gemini ASR request failed across all candidate models.")

    def transcribe(self, audio_path: Path, language: str = "ja") -> list[Segment]:
        # Upload the audio file to Gemini Files API with automatic retry
        uploaded_file = None
        for up_attempt in range(1, 4):
            try:
                uploaded_file = self.client.files.upload(file=str(audio_path))
                break
            except Exception as e:
                if up_attempt == 3:
                    raise RuntimeError(f"Tải tệp âm thanh lên Gemini Files API thất bại sau 3 lần thử: {e}") from e
                time.sleep(up_attempt * 2)

        lang_name = "Japanese" if language == "ja" else language
        prompt = (
            f"You are a professional audio transcriber. Listen carefully to the audio and transcribe "
            f"every spoken sentence in {lang_name} with accurate timestamps in seconds.\n"
            f"Break down sentences at natural pauses (about 2-7 seconds per segment).\n"
            f"Do not hallucinate, do not summarize, transcribe exactly what is said."
        )

        try:
            raw_text = self._call_generate_with_retry(uploaded_file, prompt)
            data = json.loads(raw_text)
            segments_data = data.get("segments", [])
            segments: list[Segment] = []
            for item in segments_data:
                segments.append(Segment(
                    start=float(item.get("start", 0.0)),
                    end=float(item.get("end", 0.0)),
                    text=str(item.get("text", "")).strip()
                ))
            return segments
        finally:
            # Clean up the uploaded file on Gemini server
            if uploaded_file:
                try:
                    self.client.files.delete(name=uploaded_file.name)
                except Exception:
                    pass

