import json
from sqlmodel import Session, select, or_
from memoai.db import engine
from memoai.models import Vocab, AIProfile, AppSettings
from memoai.languages.ja import JapaneseLanguagePack
from memoai.config import settings

_ja_pack = JapaneseLanguagePack()


def lookup_word(word: str, context: str | None = None, user_id: int | None = None) -> dict:
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

    # Check if word is already saved in Vocab for this user or find active AI profile
    mt_profile = None
    with Session(engine) as session:
        if user_id:
            statement = select(Vocab).where(Vocab.user_id == user_id, Vocab.word == clean_word)
        else:
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

        if user_id:
            app_set = session.exec(select(AppSettings).where(AppSettings.user_id == user_id)).first()
            if app_set and app_set.default_mt_profile_id:
                cand = session.get(AIProfile, app_set.default_mt_profile_id)
                if cand and cand.can_translate:
                    mt_profile = cand
        if not mt_profile:
            mt_profile = session.exec(
                select(AIProfile)
                .where(
                    AIProfile.can_translate == True,
                    or_(AIProfile.user_id == user_id, AIProfile.user_id == None) if user_id else True,
                )
                .order_by((AIProfile.provider_type == "gemini").desc(), AIProfile.id)
            ).first()

    # Fetch definition via AI (Gemini or OpenAI) with strict timeout & proxy support
    meaning = ""
    jlpt = None

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

    gemini_key = settings.gemini_api_key or (mt_profile.api_key if mt_profile and mt_profile.provider_type == "gemini" else None)
    gemini_model = (mt_profile.model if mt_profile and mt_profile.provider_type == "gemini" and mt_profile.model else settings.gemini_mt_model) or "gemini-2.5-flash"

    if gemini_key:
        try:
            from google import genai
            from google.genai import types
            from memoai.network import get_ssl_verify, get_proxy_url

            verify = get_ssl_verify()
            proxy = get_proxy_url()
            client_args = {}
            if verify is not True:
                client_args["verify"] = verify
            if proxy:
                client_args["proxy"] = proxy
            http_options = types.HttpOptions(client_args=client_args, timeout=8.0) if client_args else types.HttpOptions(timeout=8.0)

            client = genai.Client(api_key=gemini_key, http_options=http_options)
            res = client.models.generate_content(
                model=gemini_model,
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
            pass

    if not meaning and mt_profile and mt_profile.provider_type in ("openai", "openai_compat") and mt_profile.api_key:
        try:
            from openai import OpenAI
            from memoai.network import get_httpx_client

            client = OpenAI(
                base_url=mt_profile.base_url or "https://api.openai.com/v1",
                api_key=mt_profile.api_key,
                http_client=get_httpx_client(target_url=mt_profile.base_url, proxy_mode=getattr(mt_profile, "proxy_mode", "auto"), timeout=8.0),
            )
            res = client.chat.completions.create(
                model=mt_profile.model or "gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a Japanese-Vietnamese dictionary assistant. Output valid JSON only."},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
            )
            raw = res.choices[0].message.content or "{}"
            data = json.loads(raw)
            meaning = data.get("meaning", "")
            jlpt = data.get("jlpt")
            if not pos:
                pos = data.get("pos", "")
        except Exception:
            pass

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
