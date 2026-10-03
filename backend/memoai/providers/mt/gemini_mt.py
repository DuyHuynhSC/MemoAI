import json
from google import genai
from google.genai import types
from memoai.providers.mt.base import TranslatorProvider, TranslationBatch, TranslationItem


class GeminiTranslator(TranslatorProvider):
    """Machine Translation using Google Gemini API."""

    def __init__(self, api_key: str | None = None, model: str = "gemini-2.5-flash"):
        self.api_key = api_key
        self.model = model
        self.client = genai.Client(api_key=self.api_key)

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
            f"3. Không thêm giải thích, chỉ trả về đúng danh sách bản dịch theo schema JSON.\n\n"
            f"Dữ liệu cần dịch:\n"
            f"{json.dumps(items_payload, ensure_ascii=False, indent=2)}"
        )

        response = self.client.models.generate_content(
            model=self.model,
            contents=[prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=TranslationBatch,
                temperature=0.2
            )
        )

        raw_text = response.text or "{}"
        data = json.loads(raw_text)
        item_list = data.get("items", [])

        # Map by id to preserve order
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

        # Batch in chunks of 30 lines
        batch_size = 30
        results: list[str] = []

        for i in range(0, len(texts), batch_size):
            chunk = texts[i : i + batch_size]
            translated_chunk = self._translate_chunk(
                chunk, start_id=i, src_lang=src_lang, tgt_lang=tgt_lang, mode=mode
            )
            results.extend(translated_chunk)

        return results
