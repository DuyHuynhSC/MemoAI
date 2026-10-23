from pathlib import Path
from memoai.providers.asr.base import Segment
from memoai.exporters.common import format_timestamp, render_cues, save_cues


def format_timestamp_srt(seconds: float) -> str:
    """Format seconds into SRT timestamp: HH:MM:SS,mmm"""
    return format_timestamp(seconds, sep=",")


def export_srt(
    segments: list[Segment],
    translations: list[str] | None = None,
    mode: str = "dual",
    output_path: Path | None = None,
) -> str:
    """Generate SRT formatted string and optionally write to output_path."""
    lines = render_cues(segments, translations, mode=mode, sep=",")
    return save_cues(lines, output_path)
