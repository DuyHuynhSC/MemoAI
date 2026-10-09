import json
import time
from google import genai
from google.genai import types
from google.genai import errors
from memoai.providers.mt.base import TranslatorProvider, TranslationBatch, TranslationItem

FALLBACK_MODELS = [
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
]


class GeminiTranslator(TranslatorProvider):
    """Machine Translation using Google Gemini API.
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


    def _call_generate_with_retry(self, prompt: str) -> str:
        from memoai.logger import get_logger
        logger = get_logger("memoai.mt.gemini")

        models_to_try = [self.model] + [m for m in FALLBACK_MODELS if m != self.model]
        last_error = None

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=TranslationBatch,
            temperature=0.2,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )

        for model_name in models_to_try:
            logger.info(f"Gửi yêu cầu dịch phụ đề tới Gemini model: {model_name}")
            for attempt in range(1, 4):
                try:
                    response = self.client.models.generate_content(
                        model=model_name,
                        contents=[prompt],
                        config=config,
                    )
                    logger.info(f"Gemini MT ({model_name}) phản hồi thành công (attempt {attempt})")
                    return response.text or "{}"
                except (errors.APIError, Exception) as e:
                    err_msg = str(e)
                    last_error = e
                    logger.warning(f"Lỗi Gemini MT (model={model_name}, attempt={attempt}/3): {e}")
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
                        logger.info(f"Chờ {wait_sec}s rồi thử lại Gemini MT...")
                        time.sleep(wait_sec)
                        continue
                    else:
                        break

        err_final = f"Dịch phụ đề thất bại trên tất cả model Gemini ({', '.join(models_to_try)}): {last_error}"
        logger.error(err_final)
        raise RuntimeError(err_final) from last_error

    def _translate_chunk(
        self,
        texts: list[str],
        start_id: int,
        src_lang: str,
        tgt_lang: str,
        mode: str
    ) -> list[str]:
        from memoai.logger import get_logger
        logger = get_logger("memoai.mt.gemini")

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

        raw_text = self._call_generate_with_retry(prompt)
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
            logger.error(f"Lỗi phân tích JSON kết quả dịch Gemini MT: {jde}. Raw: {clean_text[:500]}")
            raise RuntimeError(f"Lỗi phân tích cú pháp JSON kết quả dịch Gemini MT: {jde}") from jde

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

        from memoai.logger import get_logger
        logger = get_logger("memoai.mt.gemini")
        logger.info(f"Bắt đầu dịch {len(texts)} câu từ {src_lang} sang {tgt_lang} (chế độ {mode})")

        batch_size = 30
        results: list[str] = []

        for i in range(0, len(texts), batch_size):
            chunk = texts[i : i + batch_size]
            logger.info(f"Đang dịch batch {i // batch_size + 1} ({len(chunk)} câu)...")
            translated_chunk = self._translate_chunk(
                chunk, start_id=i, src_lang=src_lang, tgt_lang=tgt_lang, mode=mode
            )
            results.extend(translated_chunk)

        logger.info(f"Hoàn thành dịch {len(results)} câu.")
        return results
