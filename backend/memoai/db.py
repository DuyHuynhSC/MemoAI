from pathlib import Path
from sqlalchemy import text
from sqlmodel import SQLModel, create_engine, Session, select
from memoai.config import settings
from memoai.models import User
from memoai.services.auth import hash_password

DB_PATH = settings.get_data_dir() / "memoai.db"
engine = create_engine(f"sqlite:///{DB_PATH}", echo=False, connect_args={"check_same_thread": False})


def init_db():
    SQLModel.metadata.create_all(engine)
    
    # 1. Ensure a default user exists for backwards compatibility
    with Session(engine) as session:
        default_user = session.exec(select(User).where(User.username == "default")).first()
        if not default_user:
            default_user = User(
                username="default",
                hashed_password=hash_password("memoai123"),
                full_name="Default User",
                is_active=True,
            )
            session.add(default_user)
            session.commit()
            session.refresh(default_user)
        default_uid = default_user.id or 1

    # 2. Auto-migrate SQLite schema
    with engine.connect() as conn:
        try:
            # Auto-migrate AppSettings columns
            cursor = conn.execute(text("PRAGMA table_info(app_settings)"))
            existing_cols = {row[1] for row in cursor.fetchall()}
            
            columns_to_add = {
                "user_id": "INTEGER DEFAULT NULL",
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

            # Auto-migrate Projects columns
            cursor_p = conn.execute(text("PRAGMA table_info(projects)"))
            existing_p_cols = {row[1] for row in cursor_p.fetchall()}
            p_cols_to_add = {
                "user_id": "INTEGER DEFAULT NULL",
                "asr_profile_id": "INTEGER DEFAULT NULL",
                "mt_profile_id": "INTEGER DEFAULT NULL",
                "asr_provider": "VARCHAR DEFAULT NULL",
                "mt_provider": "VARCHAR DEFAULT NULL",
                "asr_model": "VARCHAR DEFAULT NULL",
                "mt_model": "VARCHAR DEFAULT NULL",
            }
            for col_name, col_def in p_cols_to_add.items():
                if col_name not in existing_p_cols:
                    conn.execute(text(f"ALTER TABLE projects ADD COLUMN {col_name} {col_def}"))

            # Auto-migrate AIProfile columns
            cursor_ai = conn.execute(text("PRAGMA table_info(ai_profiles)"))
            existing_ai_cols = {row[1] for row in cursor_ai.fetchall()}
            if "proxy_mode" not in existing_ai_cols:
                conn.execute(text("ALTER TABLE ai_profiles ADD COLUMN proxy_mode VARCHAR DEFAULT 'auto'"))
            if "user_id" not in existing_ai_cols:
                conn.execute(text("ALTER TABLE ai_profiles ADD COLUMN user_id INTEGER DEFAULT NULL"))

            # Auto-migrate Vocabs columns
            cursor_v = conn.execute(text("PRAGMA table_info(vocabs)"))
            existing_v_cols = {row[1] for row in cursor_v.fetchall()}
            if "user_id" not in existing_v_cols:
                conn.execute(text("ALTER TABLE vocabs ADD COLUMN user_id INTEGER DEFAULT NULL"))

            # Backfill existing unassigned records to default user
            conn.execute(text(f"UPDATE projects SET user_id = {default_uid} WHERE user_id IS NULL"))
            conn.execute(text(f"UPDATE vocabs SET user_id = {default_uid} WHERE user_id IS NULL"))
            conn.execute(text(f"UPDATE ai_profiles SET user_id = {default_uid} WHERE user_id IS NULL"))
            conn.execute(text(f"UPDATE app_settings SET user_id = {default_uid} WHERE user_id IS NULL"))

            conn.commit()
        except Exception:
            pass


def get_session():
    with Session(engine) as session:
        yield session
