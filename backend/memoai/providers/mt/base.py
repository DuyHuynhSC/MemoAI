from abc import ABC, abstractmethod
from pydantic import BaseModel, Field


class TranslationItem(BaseModel):
    id: int
    text: str
    translation: str | None = None


class TranslationBatch(BaseModel):
    items: list[TranslationItem]


class TranslatorProvider(ABC):
    """Abstract Base Class for Machine Translation providers."""

    @abstractmethod
    def translate(
        self,
        texts: list[str],
        src_lang: str = "ja",
        tgt_lang: str = "vi",
        mode: str = "learning"  # "learning" (faithful/clear) or "natural" (colloquial)
    ) -> list[str]:
        """Translate a batch of sentences maintaining 1:1 order."""
        pass
