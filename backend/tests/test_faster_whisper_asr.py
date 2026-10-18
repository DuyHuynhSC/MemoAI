from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from memoai.api.server import app
from memoai.providers.asr.base import Segment, WordTimestamp
from memoai.providers.asr.faster_whisper_asr import FasterWhisperASR
from memoai.services.hardware import get_hardware_info, get_system_ram_gb


def test_hardware_detection_info():
    hw = get_hardware_info()
    assert isinstance(hw, dict)
    assert "platform" in hw
    assert "cpu_cores" in hw
    assert hw["cpu_cores"] >= 1
    assert "ram_total_gb" in hw
    assert hw["ram_total_gb"] > 0
    assert hw["recommended_device"] in ("cpu", "cuda")
    assert hw["recommended_compute_type"] in ("int8", "float16", "default", "float32")
    assert hw["recommended_model"] in FasterWhisperASR.SUPPORTED_MODELS
    assert isinstance(hw["recommendation_reason"], str)


def test_system_ram_gb():
    total, avail = get_system_ram_gb()
    assert total > 0
    assert avail >= 0


def test_faster_whisper_provider_init_and_info():
    provider = FasterWhisperASR(model_size_or_path="base", lazy_load=True)
    info = provider.get_info()
    assert info["provider"] == "faster_whisper"
    assert info["model"] == "base"
    assert info["device"] in ("cpu", "cuda")
    assert "download_root" in info
    assert info["vad_filter"] is True


def test_faster_whisper_cuda_fallback():
    """Verify that when CUDA initialization fails, it automatically falls back to CPU."""
    with patch("faster_whisper.WhisperModel") as mock_model_cls:
        call_count = 0

        def side_effect(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if kwargs.get("device") == "cuda":
                raise RuntimeError("CUDA device unavailable or missing cuDNN dlls")
            # CPU succeeds
            mock_inst = MagicMock()
            return mock_inst

        mock_model_cls.side_effect = side_effect

        provider = FasterWhisperASR(model_size_or_path="base", device="cuda", lazy_load=False)
        assert provider.device == "cpu"
        assert provider.compute_type == "int8"
        assert call_count == 2  # 1st failed on CUDA, 2nd succeeded on CPU


def test_faster_whisper_transcription_mapping(tmp_path: Path):
    """Test transcribing audio and mapping raw segments/words to Segment and WordTimestamp."""
    dummy_wav = tmp_path / "test.wav"
    dummy_wav.write_bytes(b"RIFF" + b"\x00" * 100)

    # Create mock Faster-Whisper return structures
    mock_word_1 = MagicMock(word=" こんにちは", start=0.0, end=0.8, probability=0.98)
    mock_word_2 = MagicMock(word="、", start=0.8, end=1.0, probability=0.95)
    mock_word_3 = MagicMock(word="世界", start=1.0, end=1.8, probability=0.99)

    mock_seg_1 = MagicMock()
    mock_seg_1.start = 0.0
    mock_seg_1.end = 1.8
    mock_seg_1.text = " こんにちは、世界"
    mock_seg_1.words = [mock_word_1, mock_word_2, mock_word_3]

    mock_info = MagicMock()
    mock_info.language = "ja"
    mock_info.language_probability = 0.99
    mock_info.duration = 2.0

    with patch("faster_whisper.WhisperModel") as mock_model_cls:
        mock_instance = MagicMock()
        mock_instance.transcribe.return_value = ([mock_seg_1], mock_info)
        mock_model_cls.return_value = mock_instance

        provider = FasterWhisperASR(model_size_or_path="base", device="cpu", lazy_load=False)
        segments = provider.transcribe(dummy_wav, language="ja")

        assert len(segments) == 1
        seg = segments[0]
        assert seg.id == 1
        assert seg.start == 0.0
        assert seg.end == 1.8
        assert seg.text == "こんにちは、世界"
        assert len(seg.words) == 3
        assert seg.words[0].word == " こんにちは"
        assert seg.words[0].start == 0.0
        assert seg.words[0].end == 0.8
        assert seg.words[0].probability == 0.98


def test_api_hardware_status_endpoint():
    client = TestClient(app)
    res = client.get("/api/system/hardware")
    assert res.status_code == 200
    data = res.json()
    assert "cpu_cores" in data
    assert "ram_total_gb" in data
    assert "recommended_model" in data


def test_api_offline_models_catalog_endpoint():
    client = TestClient(app)
    res = client.get("/api/asr/offline/models")
    assert res.status_code == 200
    data = res.json()
    assert data["engine"] == "faster_whisper"
    assert "models" in data
    assert len(data["models"]) >= 4
    model_ids = [m["id"] for m in data["models"]]
    assert "base" in model_ids
    assert "tiny" in model_ids
    assert "small" in model_ids


def test_api_profile_test_faster_whisper():
    client = TestClient(app)
    res = client.post("/api/settings/profiles/test", json={
        "provider_type": "faster_whisper",
        "model": "base",
        "can_asr": True,
        "can_translate": False,
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["asr_tested"] is True
    assert data["asr_supported"] is True
    assert data["chat_ok"] is False  # Faster-Whisper is ASR only
    assert "Faster-Whisper" in data["message"]
    assert "base" in data["discovered_models"]
