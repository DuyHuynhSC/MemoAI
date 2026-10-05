import json
from sqlmodel import Session, select
from memoai.db import engine
from memoai.models import Vocab
from memoai.languages.ja import JapaneseLanguagePack
from memoai.config import settings

_ja_pack = JapaneseLanguagePack()


def lookup_word(word: str, context: str | None = None) -> dict:
    """Look up a Japanese word, returning reading, romaji, ruby, pos, meaning, and JLPT level."""
    clean_word = word.strip()
    if not clean_word:
        return {}

    tokens = _ja_pack.tokenize(clean_word)
    main_token = tokens[0] if tokens else None

    reading = main_token.reading if main_token else ""
    romanized = _ja_pack.romanize(clean_word)
    ruby_html = _ja_pack.to_ruby_html(clean_word)
    pos = main_token.pos if main_token else ""

    # Check if word is already saved in Vocab
    with Session(engine) as session:
        statement = select(Vocab).where(Vocab.word == clean_word)
        existing = session.exec(statement).first()
        if existing:
            return {
                "word": existing.word,
                "reading": existing.reading or reading,
                "romanized": existing.romanized or romanized,
                "ruby_html": ruby_html,
                "meaning": existing.meaning,
                "jlpt": existing.jlpt,
                "pos": existing.pos or pos,
                "context_sentence": existing.context_sentence,
                "saved": True,
            }

    # Fetch definition via Gemini
    meaning = ""
    jlpt = None
    g_key = settings.gemini_api_key
    if g_key:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=g_key)
            prompt = (
                f"Hãy giải thích ngắn gọn từ vựng tiếng Nhật: '{clean_word}' "
                f"(ngữ cảnh trong câu: '{context or ''}').\n"
                f"Trả về đúng định dạng JSON:\n"
                f"{{\n"
                f'  "meaning": "nghĩa tiếng Việt súc tích, dễ hiểu",\n'
                f'  "jlpt": "N5" hoặc "N4" hoặc "N3" hoặc "N2" hoặc "N1" hoặc null,\n'
                f'  "pos": "từ loại (danh từ, động từ,...)"\n'
                f"}}"
            )
            res = client.models.generate_content(
                model=settings.gemini_mt_model,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1,
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                ),
            )
            raw = res.text or "{}"
            data = json.loads(raw)
            meaning = data.get("meaning", "")
            jlpt = data.get("jlpt")
            if not pos:
                pos = data.get("pos", "")
        except Exception:
            meaning = "Chưa có định nghĩa"

    return {
        "word": clean_word,
        "reading": reading,
        "romanized": romanized,
        "ruby_html": ruby_html,
        "meaning": meaning or "Chưa có định nghĩa",
        "jlpt": jlpt,
        "pos": pos,
        "context_sentence": context,
        "saved": False,
    }
