import tempfile
from pathlib import Path
from memoai.providers.asr.base import ASRProvider, Segment
from memoai.providers.mt.base import TranslatorProvider
from memoai.pipeline.runner import PipelineRunner


class DummyASR(ASRProvider):
    def transcribe(self, audio_path: Path, language: str = "ja") -> list[Segment]:
        return [
            Segment(start=0.5, end=2.5, text="初めまして。"),
            Segment(start=3.0, end=5.5, text="私はアンです。"),
        ]


class DummyMT(TranslatorProvider):
    def translate(
        self,
        texts: list[str],
        src_lang: str = "ja",
        tgt_lang: str = "vi",
        mode: str = "learning"
    ) -> list[str]:
        return [
            "Rất vui được làm quen với bạn.",
            "Tôi là An.",
        ]


def test_pipeline_runner(monkeypatch):
    # Mock audio extraction so we don't actually need ffmpeg for this test
    monkeypatch.setattr(
        "memoai.pipeline.runner.extract_audio",
        lambda video_path, audio_path: audio_path.touch()
    )

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        dummy_video = tmp_path / "test.mp4"
        dummy_video.touch()

        runner = PipelineRunner(
            asr_provider=DummyASR(),
            mt_provider=DummyMT(),
            src_lang="ja",
            tgt_lang="vi"
        )

        out = runner.run(
            input_path_or_url=str(dummy_video),
            output_dir=tmp_path
        )

        assert out["src_srt"].exists()
        assert out["tgt_srt"].exists()
        assert out["dual_srt"].exists()
        assert out["dual_vtt"].exists()

        dual_content = out["dual_srt"].read_text(encoding="utf-8")
        assert "初めまして。" in dual_content
        assert "Rất vui được làm quen với bạn." in dual_content
        assert "私はアンです。" in dual_content
        assert "Tôi là An." in dual_content
