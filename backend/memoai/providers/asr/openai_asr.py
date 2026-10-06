from pathlib import Path
from openai import OpenAI
from memoai.providers.asr.base import ASRProvider, Segment, WordTimestamp


class OpenAICompatASR(ASRProvider):
    """ASR using standard OpenAI /v1/audio/transcriptions endpoint.
    Works with OpenAI, Groq, or self-hosted Faster-Whisper-Server / Speaches / vLLM.
    """

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        model: str = "whisper-1"
    ):
        from memoai.network import get_httpx_client
        self.client = OpenAI(
            base_url=base_url,
            api_key=api_key or "dummy_key",
            http_client=get_httpx_client(),
        )
        self.model = model


    def transcribe(self, audio_path: Path, language: str = "ja") -> list[Segment]:
        with open(audio_path, "rb") as f:
            response = self.client.audio.transcriptions.create(
                file=f,
                model=self.model,
                language=language,
                response_format="verbose_json",
                timestamp_granularities=["segment"]
            )

        segments: list[Segment] = []
        raw_segments = getattr(response, "segments", None)
        if raw_segments:
            for s in raw_segments:
                seg_dict = s if isinstance(s, dict) else s.model_dump() if hasattr(s, "model_dump") else s.__dict__
                segments.append(Segment(
                    start=float(seg_dict.get("start", 0.0)),
                    end=float(seg_dict.get("end", 0.0)),
                    text=str(seg_dict.get("text", "")).strip()
                ))
        else:
            # Fallback if only plain text returned
            text = getattr(response, "text", str(response)).strip()
            segments.append(Segment(
                start=0.0,
                end=0.0,
                text=text
            ))

        return segments
