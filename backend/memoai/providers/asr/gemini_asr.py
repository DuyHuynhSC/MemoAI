import json
from pathlib import Path
from pydantic import BaseModel
from google import genai
from google.genai import types
from memoai.providers.asr.base import ASRProvider, Segment


class GeminiSegmentOutput(BaseModel):
    start: float
    end: float
    text: str


class GeminiASROutput(BaseModel):
    segments: list[GeminiSegmentOutput]


class GeminiASR(ASRProvider):
    """ASR using Google Gemini Multimodal Audio capability.
    Suitable for audio transcription without local GPU.
    """

    def __init__(self, api_key: str | None = None, model: str = "gemini-2.5-flash"):
        self.api_key = api_key
        self.model = model
        self.client = genai.Client(api_key=self.api_key)

    def transcribe(self, audio_path: Path, language: str = "ja") -> list[Segment]:
        # Upload the audio file to Gemini Files API
        uploaded_file = self.client.files.upload(file=str(audio_path))

        lang_name = "Japanese" if language == "ja" else language
        prompt = (
            f"You are a professional audio transcriber. Listen carefully to the audio and transcribe "
            f"every spoken sentence in {lang_name} with accurate timestamps in seconds.\n"
            f"Break down sentences at natural pauses (about 2-7 seconds per segment).\n"
            f"Do not hallucinate, do not summarize, transcribe exactly what is said."
        )

        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=[uploaded_file, prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=GeminiASROutput,
                    temperature=0.0
                )
            )

            raw_text = response.text or "{}"
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
            try:
                self.client.files.delete(name=uploaded_file.name)
            except Exception:
                pass
