import json
import os
import time
from typing import Optional
from pydantic import BaseModel
from sqlmodel import Session, select, or_

from memoai.db import engine
from memoai.models import Vocab, Grammar, SegmentRecord, AIProfile, AppSettings
from memoai.languages.ja import JapaneseLanguagePack
from memoai.config import settings
from memoai.logger import get_logger

logger = get_logger("memoai.analyzer")
_ja_pack = JapaneseLanguagePack()

FALLBACK_GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
]


class LLMAIConfigVocabItem(BaseModel):
    word: str
    reading: str
    romanized: str
    meaning: str
    pos: str
    jlpt: Optional[str] = None


class LLMAIConfigGrammarItem(BaseModel):
    pattern: str
    meaning: str
    explanation: str
    jlpt: Optional[str] = None


class LLMAIConfigAnalysisOutput(BaseModel):
    translation: str
    breakdown_notes: str
    vocabs: list[LLMAIConfigVocabItem]
    grammars: list[LLMAIConfigGrammarItem]


def _normalize_pattern(p: str) -> str:
    return p.strip().replace("~", "〜").lower()


def _get_user_saved_sets(session: Session, user_id: int) -> tuple[set[str], set[str]]:
    existing_vocabs = session.exec(select(Vocab.word).where(Vocab.user_id == user_id)).all()
    existing_grammars = session.exec(select(Grammar.pattern).where(Grammar.user_id == user_id)).all()
    vocab_set = {w.strip() for w in existing_vocabs if w}
    grammar_set = {_normalize_pattern(p) for p in existing_grammars if p}
    return vocab_set, grammar_set


def _resolve_ai_profile(session: Session, user_id: int) -> Optional[AIProfile]:
    app_set = session.exec(select(AppSettings).where(AppSettings.user_id == user_id)).first()
    if not app_set:
        app_set = session.exec(select(AppSettings).where(AppSettings.id == 1)).first()
    if app_set and app_set.default_mt_profile_id:
        cand = session.get(AIProfile, app_set.default_mt_profile_id)
        if cand and cand.can_translate and (cand.user_id is None or cand.user_id == user_id):
            return cand

    return session.exec(
        select(AIProfile)
        .where(
            AIProfile.can_translate == True,
            or_(AIProfile.user_id == user_id, AIProfile.user_id == None),
        )
        .order_by((AIProfile.provider_type == "gemini").desc(), AIProfile.id)
    ).first()


def _decorate_with_saved_flags(
    raw_data: dict,
    vocab_set: set[str],
    grammar_set: set[str],
    sentence: str,
    translation: str,
    user_level: str,
    cached: bool = False,
) -> dict:
    vocabs_out = []
    seen_words = set()
    for v in raw_data.get("vocabs", []):
        w = (v.get("word") or "").strip()
        if not w or w in seen_words:
            continue
        seen_words.add(w)
        reading = (v.get("reading") or "").strip()
        romanized = (v.get("romanized") or "").strip()
        if not reading:
            tokens = _ja_pack.tokenize(w)
            reading = tokens[0].reading if tokens else w
        if not romanized:
            romanized = _ja_pack.romanize(w)

        vocabs_out.append({
            "word": w,
            "reading": reading,
            "romanized": romanized,
            "meaning": v.get("meaning") or "",
            "pos": v.get("pos") or "",
            "jlpt": v.get("jlpt") or "N5",
            "is_saved": w in vocab_set,
        })

    grammars_out = []
    seen_patterns = set()
    for g in raw_data.get("grammars", []):
        pat = (g.get("pattern") or "").strip()
        if not pat:
            continue
        norm_pat = _normalize_pattern(pat)
        if norm_pat in seen_patterns:
            continue
        seen_patterns.add(norm_pat)
        grammars_out.append({
            "pattern": pat,
            "meaning": g.get("meaning") or "",
            "explanation": g.get("explanation") or "",
            "jlpt": g.get("jlpt") or user_level,
            "is_saved": norm_pat in grammar_set,
        })

    return {
        "sentence": sentence,
        "translation": raw_data.get("translation") or translation or "",
        "breakdown_notes": raw_data.get("breakdown_notes") or "",
        "user_level": user_level,
        "vocabs": vocabs_out,
        "grammars": grammars_out,
        "cached": cached,
    }


def analyze_sentence(
    sentence: str,
    translation: Optional[str] = None,
    user_id: int = 1,
    user_level: str = "N5",
    segment_id: Optional[int] = None,
    force_refresh: bool = False,
    auto_save: bool = False,
) -> dict:
    """Analyze a Japanese sentence using LLM to extract vocabulary and grammar tailored to user's JLPT level."""
    clean_sentence = sentence.strip()
    if not clean_sentence:
        return {
            "sentence": "",
            "translation": "",
            "breakdown_notes": "",
            "user_level": user_level,
            "vocabs": [],
            "grammars": [],
            "cached": False,
        }

    with Session(engine) as session:
        vocab_set, grammar_set = _get_user_saved_sets(session, user_id)

        # 1. Check segment cache if available and not force_refresh
        if segment_id and not force_refresh:
            seg = session.get(SegmentRecord, segment_id)
            if seg and seg.analysis_json:
                try:
                    cached_data = json.loads(seg.analysis_json)
                    if cached_data and isinstance(cached_data, dict) and ("vocabs" in cached_data or "grammars" in cached_data):
                        result = _decorate_with_saved_flags(
                            cached_data,
                            vocab_set,
                            grammar_set,
                            clean_sentence,
                            translation or seg.translation or "",
                            user_level,
                            cached=True,
                        )
                        if auto_save:
                            save_stats = save_analysis_items(
                                user_id=user_id,
                                vocabs=result["vocabs"],
                                grammars=result["grammars"],
                                context_sentence=clean_sentence,
                                context_translation=result["translation"],
                            )
                            result["save_stats"] = save_stats
                            # Re-mark saved
                            vocab_set, grammar_set = _get_user_saved_sets(session, user_id)
                            result = _decorate_with_saved_flags(
                                cached_data,
                                vocab_set,
                                grammar_set,
                                clean_sentence,
                                translation or seg.translation or "",
                                user_level,
                                cached=True,
                            )
                            result["save_stats"] = save_stats
                        return result
                except Exception:
                    pass

        mt_profile = _resolve_ai_profile(session, user_id)

    # 2. Build LLM prompt tailored to user's JLPT level
    level_guidance = {
        "N5": "Người học đang ở trình độ sơ cấp N5. Hãy giải thích thật chi tiết, dễ hiểu, bóc tách cả các từ vựng cơ bản và cấu trúc câu nền tảng.",
        "N4": "Người học đang ở trình độ sơ trung cấp N4. Hãy giải thích rõ các thể chia động từ, tính từ và các mẫu câu giao tiếp thông dụng.",
        "N3": "Người học đang ở trình độ trung cấp N3. Hãy tập trung vào từ vựng trung cấp, thành ngữ ngắn và các cấu trúc ngữ pháp nối câu, biểu đạt cảm xúc.",
        "N2": "Người học đang ở trình độ trung cao cấp N2. Hãy tập trung vào các từ vựng phức tạp, kính ngữ, văn viết và sắc thái ngữ pháp N3-N2-N1.",
        "N1": "Người học đang ở trình độ cao cấp N1. Hãy phân tích sâu sắc thái biểu cảm, cách dùng từ nâng cao, cấu trúc ngữ pháp N2-N1 và ngữ cảnh ẩn dụ.",
    }.get(user_level, "Hãy giải thích chi tiết từ vựng và ngữ pháp trong câu.")

    prompt = (
        f"Bạn là chuyên gia giảng dạy tiếng Nhật JLPT cho người Việt.\n"
        f"Câu tiếng Nhật cần phân tích: \"{clean_sentence}\"\n"
        f"Nghĩa tham khảo: \"{translation or ''}\"\n"
        f"Trình độ người học hiện tại: JLPT {user_level}. {level_guidance}\n\n"
        f"Yêu cầu:\n"
        f"1. Đưa các từ vựng quan trọng trong câu về dạng nguyên thể từ điển (辞書形) trong trường `word`, kèm cách đọc Hiragana (`reading`), `romanized`, nghĩa tiếng Việt phù hợp ngữ cảnh (`meaning`), từ loại (`pos`: Danh từ, Động từ nhóm I/II/III, Tính từ đuôi い/な, Phó từ,...) và cấp độ `jlpt` (N5, N4, N3, N2, N1).\n"
        f"2. Trích xuất các mẫu ngữ pháp / cấu trúc câu xuất hiện trong câu vào danh sách `grammars` (trường `pattern` ghi rõ mẫu như '〜てしまう', '〜ことがある',..., trường `meaning` ghi nghĩa ngắn gọn, trường `explanation` giải thích cách kết hợp/cách chia và vai trò trong câu, trường `jlpt` ghi N5..N1).\n"
        f"3. Trường `breakdown_notes` tóm tắt ngắn gọn cấu trúc tổng thể và sắc thái câu (1-2 câu).\n"
        f"4. Trả về đúng định dạng JSON hợp lệ."
    )

    raw_data = None
    gemini_key = (
        (mt_profile.api_key if mt_profile and mt_profile.provider_type == "gemini" else None)
        or settings.gemini_api_key
        or os.getenv("GEMINI_API_KEY")
    )
    gemini_model = (
        (mt_profile.model if mt_profile and mt_profile.provider_type == "gemini" and mt_profile.model else None)
        or settings.gemini_mt_model
        or "gemini-2.5-flash"
    )

    # 3A. Try Gemini Provider
    if gemini_key and (not mt_profile or mt_profile.provider_type == "gemini"):
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
            http_options = types.HttpOptions(client_args=client_args, timeout=25.0) if client_args else types.HttpOptions(timeout=25.0)
            client = genai.Client(api_key=gemini_key, http_options=http_options)

            models_to_try = [gemini_model] + [m for m in FALLBACK_GEMINI_MODELS if m != gemini_model]
            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=LLMAIConfigAnalysisOutput,
                temperature=0.2,
                automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
            )

            for m_name in models_to_try:
                for attempt in range(1, 3):
                    try:
                        res = client.models.generate_content(
                            model=m_name,
                            contents=[prompt],
                            config=config,
                        )
                        raw_data = json.loads(res.text or "{}")
                        if raw_data and ("vocabs" in raw_data or "grammars" in raw_data):
                            break
                    except Exception as e:
                        logger.warning(f"Gemini Analyzer lỗi (model={m_name}, attempt={attempt}): {e}")
                        if "503" in str(e) or "429" in str(e):
                            time.sleep(1.5 * attempt)
                            continue
                        break
                if raw_data and ("vocabs" in raw_data or "grammars" in raw_data):
                    break
        except Exception as e:
            logger.warning(f"Không thể gọi Gemini Analyzer: {e}")

    # 3B. Try OpenAI-Compatible Provider if Gemini wasn't used or failed
    if not raw_data and mt_profile and mt_profile.provider_type in ("openai", "openai_compat"):
        try:
            from openai import OpenAI
            from memoai.network import get_httpx_client

            client = OpenAI(
                base_url=mt_profile.base_url or settings.openai_base_url or "http://localhost:11434/v1",
                api_key=mt_profile.api_key or settings.openai_api_key or "dummy_key",
                http_client=get_httpx_client(
                    target_url=mt_profile.base_url,
                    proxy_mode=getattr(mt_profile, "proxy_mode", "auto"),
                    timeout=25.0,
                ),
            )
            schema_hint = (
                '{"translation": "...", "breakdown_notes": "...", '
                '"vocabs": [{"word": "...", "reading": "...", "romanized": "...", "meaning": "...", "pos": "...", "jlpt": "N5"}], '
                '"grammars": [{"pattern": "...", "meaning": "...", "explanation": "...", "jlpt": "N5"}]}'
            )
            res = client.chat.completions.create(
                model=mt_profile.model or "qwen2.5:latest",
                messages=[
                    {
                        "role": "system",
                        "content": f"You are a Japanese-Vietnamese JLPT analyzer. Output valid JSON matching this schema: {schema_hint}",
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
            )
            raw_text = res.choices[0].message.content or "{}"
            raw_data = json.loads(raw_text)
        except Exception as e:
            logger.warning(f"Không thể gọi OpenAI-compat Analyzer: {e}")

    # 3C. Local morphological fallback if offline / no LLM key configured
    if not raw_data or ("vocabs" not in raw_data and "grammars" not in raw_data):
        tokens = _ja_pack.tokenize(clean_sentence)
        fallback_vocabs = []
        seen_t = set()
        for t in tokens:
            surf = t.surface.strip()
            if len(surf) < 1 or surf in seen_t or surf in ("。", "、", "！", "？", "「", "」", "…"):
                continue
            seen_t.add(surf)
            fallback_vocabs.append({
                "word": surf,
                "reading": t.reading or surf,
                "romanized": t.romanized or _ja_pack.romanize(surf),
                "meaning": "Tra cứu thêm bằng từ điển (chế độ Offline)",
                "pos": t.pos or "Từ vựng",
                "jlpt": user_level,
            })
        raw_data = {
            "translation": translation or "",
            "breakdown_notes": "Phân tích hình thái học cục bộ (MeCab Offline). Hãy cấu hình API Key Gemini hoặc Server LLM trong Cài đặt AI để phân tích chuyên sâu ngữ pháp và nghĩa từ vựng.",
            "vocabs": fallback_vocabs,
            "grammars": [],
        }

    # 4. Save cache into segment and compute deduplication flags
    with Session(engine) as session:
        if segment_id and raw_data.get("grammars"):
            seg = session.get(SegmentRecord, segment_id)
            if seg:
                seg.analysis_json = json.dumps(raw_data, ensure_ascii=False)
                session.add(seg)
                session.commit()

        vocab_set, grammar_set = _get_user_saved_sets(session, user_id)
        result = _decorate_with_saved_flags(
            raw_data,
            vocab_set,
            grammar_set,
            clean_sentence,
            translation or "",
            user_level,
            cached=False,
        )

        if auto_save:
            save_stats = save_analysis_items(
                user_id=user_id,
                vocabs=result["vocabs"],
                grammars=result["grammars"],
                context_sentence=clean_sentence,
                context_translation=result["translation"],
            )
            vocab_set, grammar_set = _get_user_saved_sets(session, user_id)
            result = _decorate_with_saved_flags(
                raw_data,
                vocab_set,
                grammar_set,
                clean_sentence,
                translation or "",
                user_level,
                cached=False,
            )
            result["save_stats"] = save_stats

        return result


def save_analysis_items(
    user_id: int,
    vocabs: list[dict],
    grammars: list[dict],
    context_sentence: Optional[str] = None,
    context_translation: Optional[str] = None,
) -> dict:
    """Save new vocabulary and grammar items for a user, automatically skipping existing ones."""
    saved_vocabs = 0
    skipped_vocabs = 0
    saved_grammars = 0
    skipped_grammars = 0

    with Session(engine) as session:
        vocab_set, grammar_set = _get_user_saved_sets(session, user_id)

        for v in vocabs:
            word = (v.get("word") or "").strip()
            if not word:
                continue
            if word in vocab_set:
                skipped_vocabs += 1
                continue

            new_v = Vocab(
                user_id=user_id,
                word=word,
                reading=v.get("reading") or "",
                romanized=v.get("romanized") or _ja_pack.romanize(word),
                meaning=v.get("meaning") or "",
                jlpt=v.get("jlpt") or "N5",
                pos=v.get("pos") or "",
                context_sentence=context_sentence or v.get("context_sentence"),
                context_translation=context_translation or v.get("context_translation"),
            )
            session.add(new_v)
            vocab_set.add(word)
            saved_vocabs += 1

        for g in grammars:
            pattern = (g.get("pattern") or "").strip()
            if not pattern:
                continue
            norm_pat = _normalize_pattern(pattern)
            if norm_pat in grammar_set:
                skipped_grammars += 1
                continue

            new_g = Grammar(
                user_id=user_id,
                pattern=pattern,
                meaning=g.get("meaning") or "",
                explanation=g.get("explanation") or "",
                jlpt=g.get("jlpt") or "N5",
                context_sentence=context_sentence or g.get("context_sentence"),
                context_translation=context_translation or g.get("context_translation"),
            )
            session.add(new_g)
            grammar_set.add(norm_pat)
            saved_grammars += 1

        session.commit()

    return {
        "saved_vocabs": saved_vocabs,
        "skipped_vocabs": skipped_vocabs,
        "saved_grammars": saved_grammars,
        "skipped_grammars": skipped_grammars,
    }
