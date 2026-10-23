import os
import hmac
import hashlib
import secrets
import datetime
from pathlib import Path
from typing import Optional
import jwt
from memoai.config import settings

ALGORITHM = "HS256"
DEFAULT_EXPIRATION_DAYS = 30


def get_secret_key() -> str:
    """Get secret key from env or persistent file in data dir."""
    env_secret = os.getenv("MEMOAI_SECRET_KEY")
    if env_secret:
        return env_secret
    
    secret_file = settings.get_data_dir() / ".jwt_secret"
    try:
        if secret_file.exists():
            return secret_file.read_text(encoding="utf-8").strip()
        else:
            secret_file.parent.mkdir(parents=True, exist_ok=True)
            key = secrets.token_hex(32)
            secret_file.write_text(key, encoding="utf-8")
            return key
    except Exception:
        return "memoai-desktop-default-fallback-secret-key-32chars"


SECRET_KEY = get_secret_key()


def hash_password(password: str) -> str:
    """Hash password using PBKDF2-HMAC-SHA256 with a unique random salt."""
    salt = secrets.token_hex(16)
    iterations = 100_000
    pwd_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations
    ).hex()
    return f"pbkdf2:sha256:{iterations}${salt}${pwd_hash}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against hashed password."""
    try:
        algorithm_part, salt, original_hash = hashed_password.split("$")
        iterations = int(algorithm_part.split(":")[-1])
        calculated_hash = hashlib.pbkdf2_hmac(
            "sha256",
            plain_password.encode("utf-8"),
            salt.encode("utf-8"),
            iterations
        ).hex()
        return hmac.compare_digest(calculated_hash, original_hash)
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    """Create signed JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.now(datetime.timezone.utc) + expires_delta
    else:
        expire = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=DEFAULT_EXPIRATION_DAYS)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and verify JWT access token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except Exception:
        return None
