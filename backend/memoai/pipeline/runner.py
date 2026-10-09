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
        progress_cb: Callable[[str, float], None] | None = None,
        project_id: int | None = None,
    ):
        self.asr_provider = asr_provider
        self.mt_provider = mt_provider
        self.src_lang = src_lang
        self.tgt_lang = tgt_lang
        self.project_id = project_id
        self._raw_progress_cb = progress_cb or (lambda step, p: None)

        from memoai.logger import ProjectLogger, get_project_log_path
        log_path = get_project_log_path(project_id) if project_id else None
        self.logger = ProjectLogger(project_id=project_id or 0, log_file=log_path)

    def progress_cb(self, step: str, pct: float):
        self.logger.info(f"[{int(pct * 100)}%] {step}")
        self._raw_progress_cb(step, pct)

    def run(
        self,
        input_path_or_url: str,
        output_dir: Path | None = None,
        translation_mode: str = "learning"
    ) -> dict[str, Any]:
        self.logger.info(f"=== Bắt đầu chạy pipeline: input={input_path_or_url}, src={self.src_lang}, tgt={self.tgt_lang}, mode={translation_mode} ===")
        self.progress_cb("Khởi tạo và tải media...", 0.05)

        # 1. Resolve Media
        try:
            if is_url(input_path_or_url):
                work_dir = output_dir or (settings.get_data_dir() / "downloads")
                media_path, info = download_media(input_path_or_url, work_dir, progress_cb=self.progress_cb)
                base_name = media_path.stem
                media_title = info.get("title") or base_name
            else:
                media_path = Path(input_path_or_url)
                if not media_path.exists():
                    raise FileNotFoundError(f"Tệp media không tồn tại trên máy: {media_path}")
                base_name = media_path.stem
                media_title = base_name
                work_dir = output_dir or media_path.parent

            work_dir.mkdir(parents=True, exist_ok=True)
            self.logger.info(f"Media đã sẵn sàng: {media_path} (tiêu đề: {media_title})")
        except Exception as e:
            self.logger.error(f"Lỗi tải hoặc xác định tệp media: {e}", exc=e)
            raise RuntimeError(f"Lỗi tải media: {e}") from e

        # 2. Extract Audio
        self.progress_cb("Trích xuất âm thanh 16kHz mono qua ffmpeg...", 0.20)
        audio_path = work_dir / f"{base_name}.audio.wav"
        try:
            extract_audio(media_path, audio_path)
            self.logger.info(f"Trích xuất âm thanh thành công: {audio_path}")
        except Exception as e:
            self.logger.error(f"Lỗi trích xuất âm thanh ffmpeg: {e}", exc=e)
            raise RuntimeError(f"Lỗi trích xuất âm thanh: {e}") from e

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
                self.logger.warning(f"Lần thử ASR {asr_attempt}/3 thất bại: {e}")
                if asr_attempt == 3:
                    self.logger.error(f"ASR thất bại sau 3 lần thử: {e}", exc=e)
                    raise RuntimeError(f"Nhận dạng giọng nói thất bại sau 3 lần thử: {e}") from e

        segments = normalize_segments(raw_segments or [])

        if not segments:
            err = "Không nhận diện được giọng nói trong tệp âm thanh này (kết quả rỗng)."
            self.logger.error(err)
            raise ValueError(err)

        self.logger.info(f"ASR thành công: {len(segments)} segments.")

        # 4. LanguagePack NLP (Furigana, Romaji for Japanese)
        self.progress_cb(f"Phân tích ngôn ngữ ({self.src_lang})...", 0.65)
        try:
            lang_pack = get_language_pack(self.src_lang)
            for s in segments:
                s.text = s.text.strip()
            self.logger.info(f"Phân tích ngôn ngữ hoàn tất cho {len(segments)} câu.")
        except Exception as e:
            self.logger.warning(f"Lỗi nhẹ khi phân tích NLP ngôn ngữ: {e}")

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
                self.logger.warning(f"Lần thử dịch {mt_attempt}/3 thất bại: {e}")
                if mt_attempt == 3:
                    self.logger.error(f"Dịch phụ đề thất bại sau 3 lần thử: {e}", exc=e)
                    raise RuntimeError(f"Dịch phụ đề thất bại sau 3 lần thử: {e}") from e

        translations = translations or []
        self.logger.info(f"Dịch hoàn tất: {len(translations)}/{len(segments)} câu.")


        # 6. Export subtitle files
        self.progress_cb("Xuất các định dạng phụ đề (SRT, VTT)...", 0.90)
        src_srt = work_dir / f"{base_name}.{self.src_lang}.srt"
        tgt_srt = work_dir / f"{base_name}.{self.tgt_lang}.srt"
        dual_srt = work_dir / f"{base_name}.dual.srt"
        dual_vtt = work_dir / f"{base_name}.dual.vtt"

        try:
            export_srt(segments, translations, mode="src", output_path=src_srt)
            export_srt(segments, translations, mode="tgt", output_path=tgt_srt)
            export_srt(segments, translations, mode="dual", output_path=dual_srt)
            export_vtt(segments, translations, mode="dual", output_path=dual_vtt)
            self.logger.info("Xuất file phụ đề thành công (SRT, VTT).")
        except Exception as e:
            self.logger.error(f"Lỗi khi xuất file phụ đề: {e}", exc=e)
            raise RuntimeError(f"Lỗi khi ghi tệp phụ đề: {e}") from e

        self.progress_cb("Hoàn thành!", 1.0)
        self.logger.info("=== Pipeline hoàn thành thành công 100%! ===")

        return {
            "media": media_path,
            "title": media_title,
            "src_srt": src_srt,
            "tgt_srt": tgt_srt,
            "dual_srt": dual_srt,
            "dual_vtt": dual_vtt,
        }
