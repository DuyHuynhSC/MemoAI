from abc import ABC, abstractmethod
from pydantic import BaseModel, Field


class Token(BaseModel):
    surface: str
    reading: str | None = None
    lemma: str | None = None
    pos: str | None = None
    romanized: str | None = None
    level: str | None = None


class LanguagePack(ABC):
    """Abstract Base Class for language-specific NLP tools."""

    @property
    @abstractmethod
    def code(self) -> str:
        """ISO 639-1 language code, e.g., 'ja'."""
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Full language name in English."""
        pass

    @abstractmethod
    def tokenize(self, text: str) -> list[Token]:
        """Tokenize text into morphological tokens with readings/pos."""
        pass

    @abstractmethod
    def romanize(self, text: str) -> str:
        """Romanize text (e.g. Romaji, Pinyin)."""
        pass

    @abstractmethod
    def to_ruby_html(self, text: str) -> str:
        """Format text as HTML <ruby> tags for furigana/readings."""
        pass
