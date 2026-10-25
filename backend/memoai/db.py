from pathlib import Path
from sqlalchemy import text
from sqlmodel import SQLModel, create_engine, Session, select
from memoai.config import settings
from memoai.models import User, Grammar  # noqa: F401
from memoai.services.auth import hash_password

DB_PATH = settings.get_data_dir() / "memoai.db"
engine = create_engine(f"sqlite:///{DB_PATH}", echo=False, connect_args={"check_same_thread": False})


def init_db():
    SQLModel.metadata.create_all(engine)

    # 1. Auto-migrate SQLite schema columns
    with engine.connect() as conn:
        try:
            # Auto-migrate User columns (role, jlpt_level)
            cursor_u = conn.execute(text("PRAGMA table_info(users)"))
            existing_u_cols = {row[1] for row in cursor_u.fetchall()}
            if "role" not in existing_u_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'user'"))
            if "jlpt_level" not in existing_u_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN jlpt_level VARCHAR DEFAULT 'N5'"))

            # Auto-migrate Segments columns (analysis_json)
            cursor_seg = conn.execute(text("PRAGMA table_info(segments)"))
            existing_seg_cols = {row[1] for row in cursor_seg.fetchall()}
            if "analysis_json" not in existing_seg_cols:
                conn.execute(text("ALTER TABLE segments ADD COLUMN analysis_json TEXT DEFAULT NULL"))

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

            conn.commit()
        except Exception:
            pass

    # 2. Ensure default user and admin user exist
    with Session(engine) as session:
        default_user = session.exec(select(User).where(User.username == "default")).first()
        if not default_user:
            default_user = User(
                username="default",
                hashed_password=hash_password("memoai123"),
                full_name="Default User",
                role="user",
                jlpt_level="N5",
                is_active=True,
            )
            session.add(default_user)
            session.commit()
            session.refresh(default_user)
        default_uid = default_user.id or 1

        admin_user = session.exec(select(User).where(User.username == "admin")).first()
        if not admin_user:
            admin_user = User(
                username="admin",
                hashed_password=hash_password("admin123"),
                full_name="System Administrator",
                role="admin",
                jlpt_level="N5",
                is_active=True,
            )
            session.add(admin_user)
            session.commit()
            session.refresh(admin_user)
        elif admin_user.role != "admin":
            admin_user.role = "admin"
            session.add(admin_user)
            session.commit()

        # Ensure Faster-Whisper Offline profile exists as a shared system profile (user_id = None)
        from memoai.models import AIProfile
        w_profile = session.exec(select(AIProfile).where(AIProfile.provider_type == "faster_whisper")).first()
        if not w_profile:
            w_profile = AIProfile(
                name="Faster-Whisper Offline (Cục bộ)",
                provider_type="faster_whisper",
                model="base",
                can_asr=True,
                can_translate=False,
                user_id=None,
            )
            session.add(w_profile)
            session.commit()
        elif w_profile.user_id is not None or not w_profile.can_asr:
            w_profile.user_id = None
            w_profile.can_asr = True
            session.add(w_profile)
            session.commit()

    # 3. Backfill existing unassigned records to default user (except shared system profiles)
    with engine.connect() as conn:
        try:
            conn.execute(text(f"UPDATE projects SET user_id = {default_uid} WHERE user_id IS NULL"))
            conn.execute(text(f"UPDATE vocabs SET user_id = {default_uid} WHERE user_id IS NULL"))
            conn.execute(text(f"UPDATE grammars SET user_id = {default_uid} WHERE user_id IS NULL"))
            conn.execute(text(f"UPDATE users SET jlpt_level = 'N5' WHERE jlpt_level IS NULL OR jlpt_level = ''"))
            conn.execute(text(f"UPDATE ai_profiles SET user_id = {default_uid} WHERE user_id IS NULL AND provider_type != 'faster_whisper'"))
            conn.execute(text("UPDATE ai_profiles SET user_id = NULL WHERE provider_type = 'faster_whisper'"))
            conn.execute(text(f"UPDATE app_settings SET user_id = {default_uid} WHERE user_id IS NULL"))
            conn.commit()
        except Exception:
            pass


def get_session():
    with Session(engine) as session:
        yield session
