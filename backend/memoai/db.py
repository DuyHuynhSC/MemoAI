from pathlib import Path
from sqlalchemy import text
from sqlmodel import SQLModel, create_engine, Session
from memoai.config import settings

DB_PATH = settings.get_data_dir() / "memoai.db"
engine = create_engine(f"sqlite:///{DB_PATH}", echo=False, connect_args={"check_same_thread": False})


def init_db():
    SQLModel.metadata.create_all(engine)
    
    # Auto-migrate AppSettings columns for existing SQLite databases
    with engine.connect() as conn:
        try:
            cursor = conn.execute(text("PRAGMA table_info(app_settings)"))
            existing_cols = {row[1] for row in cursor.fetchall()}
            
            columns_to_add = {
                "proxy_enabled": "BOOLEAN DEFAULT 0",
                "http_proxy": "VARCHAR DEFAULT NULL",
                "https_proxy": "VARCHAR DEFAULT NULL",
                "no_proxy": "VARCHAR DEFAULT 'localhost,127.0.0.1'",
                "ca_cert_path": "VARCHAR DEFAULT NULL",
                "insecure_skip_verify": "BOOLEAN DEFAULT 0",
            }
            
            for col_name, col_def in columns_to_add.items():
                if col_name not in existing_cols:
                    conn.execute(text(f"ALTER TABLE app_settings ADD COLUMN {col_name} {col_def}"))
            conn.commit()
        except Exception:
            pass


def get_session():
    with Session(engine) as session:
        yield session

