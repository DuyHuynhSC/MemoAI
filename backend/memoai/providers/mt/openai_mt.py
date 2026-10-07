import json
import re
from openai import OpenAI
from memoai.providers.mt.base import TranslatorProvider, TranslationBatch, TranslationItem


class OpenAICompatTranslator(TranslatorProvider):
    """Machine Translation using OpenAI-compatible endpoints (Qwen, Ollama, LM Studio, etc.)."""

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        model: str = "qwen2.5:latest"
    ):
        from memoai.network import get_httpx_client
        self.client = OpenAI(
            base_url=base_url,
            api_key=api_key or "dummy_key",
            http_client=get_httpx_client(),
        )
        self.model = model


    def _translate_chunk(
        self,
        texts: list[str],
        start_id: int,
        src_lang: str,
        tgt_lang: str,
        mode: str
    ) -> list[str]:
        items_payload = [{"id": start_id + i, "text": t} for i, t in enumerate(texts)]

        style_instruction = (
            "Dịch chính xác, tự nhiên nhưng sát nghĩa để người học ngoại ngữ đối chiếu được từ vựng và ngữ pháp."
            if mode == "learning"
            else "Dịch tự nhiên, lưu loát, phù hợp với văn phong phụ đề phim/video."
        )

        prompt = (
            f"Bạn là chuyên gia dịch thuật phụ đề từ {src_lang} sang {tgt_lang}.\n"
            f"Yêu cầu:\n"
            f"1. {style_instruction}\n"
            f"2. Giữ nguyên số lượng dòng ({len(texts)} dòng). Mỗi mục phải có đúng id tương ứng.\n"
            f"3. Chỉ trả về duy nhất một JSON object với format: {{\"items\": [{{\"id\": number, \"translation\": string}}]}}.\n"
            f"Không thêm bất kỳ lời dẫn hay ghi chú nào ngoài JSON.\n\n"
            f"Dữ liệu cần dịch:\n"
            f"{json.dumps(items_payload, ensure_ascii=False, indent=2)}"
        )

        raw_text = "{}"
        for attempt in range(1, 4):
            try:
                # Try with response_format json_object
                try:
                    response = self.client.chat.completions.create(
                        model=self.model,
                        messages=[
                            {"role": "system", "content": "You are a professional subtitle translator that outputs valid JSON."},
                            {"role": "user", "content": prompt}
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.2
                    )
                    raw_text = response.choices[0].message.content or "{}"
                except Exception:
                    # Fallback for models that don't support response_format
                    response = self.client.chat.completions.create(
                        model=self.model,
                        messages=[
                            {"role": "system", "content": "You are a professional subtitle translator that outputs valid JSON."},
                            {"role": "user", "content": prompt}
                        ],
                        temperature=0.2
                    )
                    raw_text = response.choices[0].message.content or "{}"
                break
            except Exception as e:
                if attempt == 3:
                    raise RuntimeError(f"Dịch OpenAI thất bại sau 3 lần thử: {e}") from e
                import time
                time.sleep(attempt * 2)


        # Clean JSON from markdown code fences if present
        raw_text = re.sub(r"^```json\s*", "", raw_text.strip(), flags=re.MULTILINE)
        raw_text = re.sub(r"^```\s*$", "", raw_text.strip(), flags=re.MULTILINE)

        try:
            data = json.loads(raw_text)
        except Exception:
            # If JSON parsing fails, attempt regex extraction
            match = re.search(r"\{.*\}", raw_text, re.DOTALL)
            if match:
                data = json.loads(match.group(0))
            else:
                data = {}

        item_list = data.get("items", [])
        id_map = {item.get("id"): item.get("translation", "") for item in item_list}
        return [id_map.get(start_id + i, "") for i in range(len(texts))]

    def translate(
        self,
        texts: list[str],
        src_lang: str = "ja",
        tgt_lang: str = "vi",
        mode: str = "learning"
    ) -> list[str]:
        if not texts:
            return []

        batch_size = 25
        results: list[str] = []

        for i in range(0, len(texts), batch_size):
            chunk = texts[i : i + batch_size]
            translated_chunk = self._translate_chunk(
                chunk, start_id=i, src_lang=src_lang, tgt_lang=tgt_lang, mode=mode
            )
            results.extend(translated_chunk)

        return results
