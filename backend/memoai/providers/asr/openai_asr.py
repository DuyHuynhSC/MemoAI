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
        model: str = "whisper-1",
        proxy_mode: str = "auto",
    ):
        from memoai.network import get_httpx_client
        self.base_url = base_url
        self.api_key = api_key
        self.model = model
        self.proxy_mode = proxy_mode
        self.client = OpenAI(
            base_url=base_url,
            api_key=api_key or "dummy_key",
            http_client=get_httpx_client(target_url=base_url, proxy_mode=proxy_mode),
        )


    def transcribe(self, audio_path: Path, language: str = "ja") -> list[Segment]:
        import time
        response = None
        last_error = None

        for attempt in range(1, 4):
            try:
                with open(audio_path, "rb") as f:
                    try:
                        response = self.client.audio.transcriptions.create(
                            file=f,
                            model=self.model,
                            language=language,
                            response_format="verbose_json",
                            timestamp_granularities=["segment"]
                        )
                    except Exception as first_e:
                        first_err_str = str(first_e).lower()
                        if "granularities" in first_err_str or "verbose_json" in first_err_str or "400" in first_err_str:
                            f.seek(0)
                            response = self.client.audio.transcriptions.create(
                                file=f,
                                model=self.model,
                                language=language,
                            )
                        else:
                            raise first_e
                break
            except Exception as e:
                last_error = e
                if attempt == 3:
                    err_str = str(e)
                    hint = ""
                    if "404" in err_str or "not found" in err_str.lower():
                        hint = (
                            f"\n[Nguyên nhân]: Cổng máy chủ nội bộ không có endpoint '/v1/audio/transcriptions'. "
                            f"Mô hình '{self.model}' là mô hình ngôn ngữ văn bản (Chat/MT), không phải mô hình Whisper/ASR. "
                            f"Vui lòng vào Cài đặt -> AI Profile, sửa cấu hình '{self.model}' và BỎ CHỌN 'Nhận dạng giọng nói (ASR)'."
                        )
                    elif "model" in err_str.lower() and ("support" in err_str.lower() or "not exist" in err_str.lower()):
                        hint = (
                            f"\n[Nguyên nhân]: Mô hình '{self.model}' không hỗ trợ xử lý âm thanh. "
                            f"Vui lòng sử dụng mô hình Whisper hoặc bỏ chọn tính năng ASR cho mô hình này."
                        )
                    elif "Connection error" in err_str or "APIConnectionError" in err_str or "connect" in err_str.lower():
                        hint = (
                            "\n[Gợi ý khắc phục]: Mạng công ty có thể đang chặn upload file lên OpenAI (/v1/audio/transcriptions). "
                            "Nếu đây là server nội bộ, hãy chọn Chế độ kết nối 'Không qua Proxy'. "
                            "Hoặc chuyển sang dùng bộ nhận dạng 'Google Gemini Flash' (truyền âm thanh Inline không bị chặn upload file)."
                        )
                    raise RuntimeError(f"Nhận dạng giọng nói OpenAI thất bại sau 3 lần thử: {e}{hint}") from e
                time.sleep(attempt * 2)


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
