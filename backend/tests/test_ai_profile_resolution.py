from pathlib import Path
from fastapi.testclient import TestClient
from sqlmodel import Session, select
from memoai.api.server import app, seed_default_profiles
from memoai.db import engine
from memoai.models import Project, AIProfile, AppSettings


def test_seed_default_profiles_auto_heal():
    with Session(engine) as session:
        # Create a non-ASR profile
        non_asr = AIProfile(
            name="Dummy MT Only Profile",
            provider_type="openai_compat",
            model="dummy-model",
            can_asr=False,
            can_translate=True,
        )
        session.add(non_asr)
        session.commit()
        session.refresh(non_asr)

        # Set default_asr_profile_id to this non-ASR profile
        app_set = session.exec(select(AppSettings).where(AppSettings.id == 1)).first()
        if not app_set:
            app_set = AppSettings(id=1, default_asr_profile_id=non_asr.id)
        else:
            app_set.default_asr_profile_id = non_asr.id
        session.add(app_set)
        session.commit()

        # Run seed_default_profiles
        seed_default_profiles()

        # Verify default_asr_profile_id was healed to Gemini
        session.refresh(app_set)
        healed_profile = session.get(AIProfile, app_set.default_asr_profile_id)
        assert healed_profile is not None
        assert healed_profile.can_asr is True
        assert healed_profile.provider_type == "gemini"

        # Cleanup dummy profile
        session.delete(non_asr)
        session.commit()


def test_create_project_stores_profiles():
    client = TestClient(app)
    res = client.post("/api/projects", json={
        "url_or_path": "test_video.mp4",
        "title": "Test AI Selection Project",
        "asr_profile_id": 1,
        "asr_provider": "gemini",
        "mt_profile_id": 1,
        "mt_provider": "gemini",
    })
    assert res.status_code == 200
    data = res.json()
    pid = data["id"]
    assert data["asr_profile_id"] == 1
    assert data["asr_provider"] == "gemini"

    # Test retry with profile override
    res_retry = client.post(f"/api/projects/{pid}/retry", json={
        "asr_profile_id": 1,
        "mt_profile_id": 1,
    })
    assert res_retry.status_code == 200
    data_retry = res_retry.json()
    assert data_retry["asr_profile_id"] == 1

    # Cleanup
    with Session(engine) as session:
        p = session.get(Project, pid)
        if p:
            session.delete(p)
            session.commit()


def test_test_profile_endpoint_openai_chat_and_asr():
    from unittest.mock import MagicMock, patch
    client = TestClient(app)

    with patch("openai.OpenAI") as mock_openai_cls:
        mock_instance = MagicMock()
        mock_openai_cls.return_value = mock_instance

        # Mock chat completion
        mock_chat_choice = MagicMock()
        mock_chat_choice.message.content = "OK"
        mock_instance.chat.completions.create.return_value = MagicMock(choices=[mock_chat_choice])

        # Mock models list
        mock_model_1 = MagicMock(id="translator")
        mock_model_2 = MagicMock(id="whisper-large-v3")
        mock_instance.models.list.return_value = MagicMock(data=[mock_model_1, mock_model_2])

        # 1. Test when can_asr is False
        res1 = client.post("/api/settings/profiles/test", json={
            "provider_type": "openai_compat",
            "base_url": "https://models-gateway.fujinet.net/v1",
            "model": "translator",
            "can_asr": False,
        })
        assert res1.status_code == 200
        d1 = res1.json()
        assert d1["success"] is True
        assert d1["chat_ok"] is True
        assert d1["discovered_models"] == ["translator", "whisper-large-v3"]
        assert d1["asr_tested"] is False

        # 2. Test when can_asr is True but gateway does not support ASR (e.g. 404 or model not supported)
        mock_instance.audio.transcriptions.create.side_effect = Exception("404 Not Found: /v1/audio/transcriptions")
        res2 = client.post("/api/settings/profiles/test", json={
            "provider_type": "openai_compat",
            "base_url": "https://models-gateway.fujinet.net/v1",
            "model": "translator",
            "can_asr": True,
        })
        assert res2.status_code == 200
        d2 = res2.json()
        assert d2["chat_ok"] is True
        assert d2["asr_tested"] is True
        assert d2["asr_supported"] is False
        assert "404" in d2["asr_message"]

        # 3. Test when can_asr is True and ASR succeeds
        mock_instance.audio.transcriptions.create.side_effect = None
        mock_instance.audio.transcriptions.create.return_value = MagicMock(text="test")
        res3 = client.post("/api/settings/profiles/test", json={
            "provider_type": "openai_compat",
            "base_url": "https://models-gateway.fujinet.net/v1",
            "model": "whisper-large-v3",
            "can_asr": True,
        })
        assert res3.status_code == 200
        d3 = res3.json()
        assert d3["asr_supported"] is True

