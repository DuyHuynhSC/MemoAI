from abc import ABC, abstractmethod
from pathlib import Path
from pydantic import BaseModel, Field


class WordTimestamp(BaseModel):
    word: str
    start: float
    end: float
    probability: float | None = None


class Segment(BaseModel):
    id: int | None = None
    start: float = Field(..., description="Start time in seconds")
    end: float = Field(..., description="End time in seconds")
    text: str = Field(..., description="Recognized text")
    words: list[WordTimestamp] = Field(default_factory=list)


class ASRProvider(ABC):
    """Abstract Base Class for ASR (Speech-to-Text) providers."""

    @abstractmethod
    def transcribe(self, audio_path: Path, language: str = "ja") -> list[Segment]:
        """Transcribe an audio file and return a list of timed segments."""
        pass
