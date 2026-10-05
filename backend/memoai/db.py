from pathlib import Path
from sqlmodel import SQLModel, create_engine, Session
from memoai.config import settings

DB_PATH = settings.get_data_dir() / "memoai.db"
engine = create_engine(f"sqlite:///{DB_PATH}", echo=False, connect_args={"check_same_thread": False})


def init_db():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
