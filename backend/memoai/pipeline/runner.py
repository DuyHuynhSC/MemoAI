from pathlib import Path
from typing import Callable, Any
from memoai.config import settings
from memoai.media import is_url, download_media, extract_audio
from memoai.providers.asr.base import ASRProvider, Segment
from memoai.providers.asr.gemini_asr import GeminiASR
from memoai.providers.asr.openai_asr import OpenAICompatASR
from memoai.providers.mt.base import TranslatorProvider
from memoai.providers.mt.gemini_mt import GeminiTranslator
from memoai.providers.mt.openai_mt import OpenAICompatTranslator
from memoai.languages.registry import get_language_pack
from memoai.pipeline.segmenter import normalize_segments
from memoai.exporters.srt import export_srt
from memoai.exporters.vtt import export_vtt


class PipelineRunner:
    """End-to-end video/audio to bilingual subtitle pipeline runner."""

    def __init__(
        self,
        asr_provider: ASRProvider,
        mt_provider: TranslatorProvider,
        src_lang: str = "ja",
        tgt_lang: str = "vi",
        progress_cb: Callable[[str, float], None] | None = None
    ):
        self.asr_provider = asr_provider
        self.mt_provider = mt_provider
        self.src_lang = src_lang
        self.tgt_lang = tgt_lang
        self.progress_cb = progress_cb or (lambda step, p: None)

    def run(
        self,
        input_path_or_url: str,
        output_dir: Path | None = None,
        translation_mode: str = "learning"
    ) -> dict[str, Any]:
        self.progress_cb("Khởi tạo và tải media...", 0.05)

        # 1. Resolve Media
        if is_url(input_path_or_url):
            work_dir = output_dir or (settings.get_data_dir() / "downloads")
            media_path, info = download_media(input_path_or_url, work_dir, progress_cb=self.progress_cb)
            base_name = media_path.stem
            media_title = info.get("title") or base_name
        else:
            media_path = Path(input_path_or_url)
            if not media_path.exists():
                raise FileNotFoundError(f"Media file not found: {media_path}")
            base_name = media_path.stem
            media_title = base_name
            work_dir = output_dir or media_path.parent

        work_dir.mkdir(parents=True, exist_ok=True)

        # 2. Extract Audio
        self.progress_cb("Trích xuất âm thanh 16kHz mono qua ffmpeg...", 0.20)
        audio_path = work_dir / f"{base_name}.audio.wav"
        extract_audio(media_path, audio_path)

        # 3. Speech Recognition (ASR) with automatic retries
        self.progress_cb(f"Nhận dạng giọng nói ({self.src_lang})...", 0.40)
        import time
        raw_segments = None
        last_asr_err = None
        for asr_attempt in range(1, 4):
            try:
                if asr_attempt > 1:
                    self.progress_cb(f"Nhận dạng giọng nói gặp lỗi, đang thử lại (lần {asr_attempt}/3)...", 0.40)
                    time.sleep(asr_attempt * 2)
                raw_segments = self.asr_provider.transcribe(audio_path, language=self.src_lang)
                if raw_segments:
                    break
            except Exception as e:
                last_asr_err = e
                if asr_attempt == 3:
                    raise RuntimeError(f"Nhận dạng giọng nói thất bại sau 3 lần thử: {e}") from e

        segments = normalize_segments(raw_segments or [])

        if not segments:
            raise ValueError("Không nhận diện được giọng nói trong tệp âm thanh này.")

        # 4. LanguagePack NLP (Furigana, Romaji for Japanese)
        self.progress_cb(f"Phân tích ngôn ngữ ({self.src_lang})...", 0.65)
        lang_pack = get_language_pack(self.src_lang)
        # Pre-generate romanization / ruby if needed
        for s in segments:
            s.text = s.text.strip()

        # 5. Translation with automatic retries
        self.progress_cb(f"Dịch song ngữ sang {self.tgt_lang}...", 0.75)
        texts_to_translate = [s.text for s in segments]
        translations = None
        last_mt_err = None
        for mt_attempt in range(1, 4):
            try:
                if mt_attempt > 1:
                    self.progress_cb(f"Dịch song ngữ gặp lỗi, đang thử lại (lần {mt_attempt}/3)...", 0.75)
                    time.sleep(mt_attempt * 2)
                translations = self.mt_provider.translate(
                    texts=texts_to_translate,
                    src_lang=self.src_lang,
                    tgt_lang=self.tgt_lang,
                    mode=translation_mode
                )
                if translations:
                    break
            except Exception as e:
                last_mt_err = e
                if mt_attempt == 3:
                    raise RuntimeError(f"Dịch phụ đề thất bại sau 3 lần thử: {e}") from e

        translations = translations or []


        # 6. Export subtitle files
        self.progress_cb("Xuất các định dạng phụ đề (SRT, VTT)...", 0.90)
        src_srt = work_dir / f"{base_name}.{self.src_lang}.srt"
        tgt_srt = work_dir / f"{base_name}.{self.tgt_lang}.srt"
        dual_srt = work_dir / f"{base_name}.dual.srt"
        dual_vtt = work_dir / f"{base_name}.dual.vtt"

        export_srt(segments, translations, mode="src", output_path=src_srt)
        export_srt(segments, translations, mode="tgt", output_path=tgt_srt)
        export_srt(segments, translations, mode="dual", output_path=dual_srt)
        export_vtt(segments, translations, mode="dual", output_path=dual_vtt)

        self.progress_cb("Hoàn thành!", 1.0)

        return {
            "media": media_path,
            "title": media_title,
            "src_srt": src_srt,
            "tgt_srt": tgt_srt,
            "dual_srt": dual_srt,
            "dual_vtt": dual_vtt,
        }
