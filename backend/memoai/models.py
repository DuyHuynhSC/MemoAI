import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Relationship


class Project(SQLModel, table=True):
    __tablename__ = "projects"

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(index=True)
    source_type: str = Field(default="url")  # "url" or "file"
    source_uri: str
    media_path: Optional[str] = None
    audio_path: Optional[str] = None
    source_lang: str = Field(default="ja")
    target_lang: str = Field(default="vi")
    duration: float = Field(default=0.0)
    status: str = Field(default="pending")  # pending, processing, completed, error
    progress: float = Field(default=0.0)
    current_step: str = Field(default="")
    error_msg: Optional[str] = None
    created_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc)
    )

    segments: list["SegmentRecord"] = Relationship(back_populates="project", cascade_delete=True)


class SegmentRecord(SQLModel, table=True):
    __tablename__ = "segments"

    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="projects.id", index=True)
    idx: int
    start: float
    end: float
    text: str
    translation: Optional[str] = None
    ruby_html: Optional[str] = None
    romanized: Optional[str] = None

    project: Optional[Project] = Relationship(back_populates="segments")


class Vocab(SQLModel, table=True):
    __tablename__ = "vocabs"

    id: Optional[int] = Field(default=None, primary_key=True)
    word: str = Field(index=True)
    reading: Optional[str] = None
    romanized: Optional[str] = None
    meaning: str
    jlpt: Optional[str] = None
    pos: Optional[str] = None
    context_sentence: Optional[str] = None
    context_translation: Optional[str] = None
    created_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc)
    )
