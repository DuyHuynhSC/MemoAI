from memoai.languages.base import LanguagePack
from memoai.languages.generic import GenericLanguagePack

_REGISTRY: dict[str, LanguagePack] = {}


def get_language_pack(code: str) -> LanguagePack:
    """Retrieve LanguagePack for a given language code (e.g. 'ja', 'en')."""
    norm_code = code.lower().strip()
    if norm_code in _REGISTRY:
        return _REGISTRY[norm_code]

    if norm_code == "ja":
        try:
            from memoai.languages.ja import JapaneseLanguagePack
            pack = JapaneseLanguagePack()
            _REGISTRY["ja"] = pack
            return pack
        except Exception:
            pass

    # Fallback to generic
    pack = GenericLanguagePack(code=norm_code, name=norm_code.upper())
    _REGISTRY[norm_code] = pack
    return pack
