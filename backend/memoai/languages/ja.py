import re
import fugashi
import pykakasi
from memoai.languages.base import LanguagePack, Token

# Helper to check if string contains Kanji
KANJI_REGEX = re.compile(r"[\u4e00-\u9faf]")


def contains_kanji(text: str) -> bool:
    return bool(KANJI_REGEX.search(text))


def katakana_to_hiragana(text: str) -> str:
    """Convert Katakana string to Hiragana."""
    res = []
    for ch in text:
        code = ord(ch)
        if 0x30A1 <= code <= 0x30F6:
            res.append(chr(code - 0x60))
        else:
            res.append(ch)
    return "".join(res)


class JapaneseLanguagePack(LanguagePack):
    """Japanese LanguagePack using fugashi (MeCab) + unidic-lite and pykakasi."""

    def __init__(self):
        self._tagger = fugashi.Tagger()
        self._kks = pykakasi.kakasi()

    @property
    def code(self) -> str:
        return "ja"

    @property
    def name(self) -> str:
        return "Japanese"

    def tokenize(self, text: str) -> list[Token]:
        tokens: list[Token] = []
        for word in self._tagger(text):
            surface = word.surface
            # unidic-lite feature format
            feature = word.feature
            lemma = getattr(feature, "lemma", surface) or surface
            pos = getattr(feature, "pos1", None)
            kana = getattr(feature, "kana", None) or getattr(feature, "pron", None)

            reading_hira = katakana_to_hiragana(kana) if kana else None
            romanized = self.romanize(surface)

            tokens.append(
                Token(
                    surface=surface,
                    reading=reading_hira,
                    lemma=lemma,
                    pos=pos,
                    romanized=romanized,
                )
            )
        return tokens

    def romanize(self, text: str) -> str:
        # Use pronunciation from tagger so particles like は -> wa, へ -> e, こんにちは -> konnichiwa
        parts = []
        for word in self._tagger(text):
            kana = getattr(word.feature, "pron", None) or getattr(word.feature, "kana", None)
            target = katakana_to_hiragana(kana) if kana else word.surface
            converted = self._kks.convert(target)
            parts.append("".join(item["hepburn"] for item in converted))
        return " ".join(p for p in parts if p).strip()

    def to_ruby_html(self, text: str) -> str:
        """Convert Japanese text with Kanji into HTML <ruby> tags."""
        result = []
        for word in self._tagger(text):
            surface = word.surface
            if not contains_kanji(surface):
                result.append(surface)
                continue

            kana = getattr(word.feature, "kana", None) or getattr(word.feature, "pron", None)
            if kana:
                reading = katakana_to_hiragana(kana)
                result.append(f"<ruby>{surface}<rt>{reading}</rt></ruby>")
            else:
                result.append(surface)
        return "".join(result)
