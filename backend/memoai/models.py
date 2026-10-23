import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Relationship


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    hashed_password: str
    full_name: Optional[str] = None
    is_active: bool = Field(default=True)
    created_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc)
    )

    projects: list["Project"] = Relationship(back_populates="user", cascade_delete=True)
    ai_profiles: list["AIProfile"] = Relationship(back_populates="user", cascade_delete=True)
    vocabs: list["Vocab"] = Relationship(back_populates="user", cascade_delete=True)
    settings: list["AppSettings"] = Relationship(back_populates="user", cascade_delete=True)


class Project(SQLModel, table=True):
    __tablename__ = "projects"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
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
    asr_profile_id: Optional[int] = Field(default=None)
    mt_profile_id: Optional[int] = Field(default=None)
    asr_provider: Optional[str] = Field(default=None)
    mt_provider: Optional[str] = Field(default=None)
    asr_model: Optional[str] = Field(default=None)
    mt_model: Optional[str] = Field(default=None)
    created_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc)
    )

    user: Optional[User] = Relationship(back_populates="projects")
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
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
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

    user: Optional[User] = Relationship(back_populates="vocabs")


class AIProfile(SQLModel, table=True):
    __tablename__ = "ai_profiles"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    name: str = Field(index=True)
    provider_type: str = Field(default="gemini")  # "gemini", "openai_compat", "faster_whisper"
    api_key: Optional[str] = None
    base_url: Optional[str] = None  # e.g. http://localhost:11434/v1
    model: str = Field(default="gemini-2.5-flash")
    can_asr: bool = Field(default=True)
    can_translate: bool = Field(default=True)
    proxy_mode: str = Field(default="auto")  # "auto", "always", "never"
    created_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc)
    )

    user: Optional[User] = Relationship(back_populates="ai_profiles")


class AppSettings(SQLModel, table=True):
    __tablename__ = "app_settings"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    default_asr_profile_id: Optional[int] = None
    default_mt_profile_id: Optional[int] = None
    default_translation_mode: str = Field(default="learning")

    # Corporate Proxy & Custom CA Certificate
    proxy_enabled: bool = Field(default=False)
    http_proxy: Optional[str] = Field(default=None)
    https_proxy: Optional[str] = Field(default=None)
    no_proxy: str = Field(default="localhost,127.0.0.1")
    ca_cert_path: Optional[str] = Field(default=None)
    insecure_skip_verify: bool = Field(default=False)

    user: Optional[User] = Relationship(back_populates="settings")
