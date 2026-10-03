import re
from memoai.languages.base import LanguagePack, Token


class GenericLanguagePack(LanguagePack):
    """Fallback LanguagePack for languages without specific morphological analyzers."""

    def __init__(self, code: str = "generic", name: str = "Generic"):
        self._code = code
        self._name = name

    @property
    def code(self) -> str:
        return self._code

    @property
    def name(self) -> str:
        return self._name

    def tokenize(self, text: str) -> list[Token]:
        words = re.findall(r"\w+|[^\w\s]", text, re.UNICODE)
        return [Token(surface=w, lemma=w) for w in words]

    def romanize(self, text: str) -> str:
        return text

    def to_ruby_html(self, text: str) -> str:
        return text
