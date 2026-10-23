from pathlib import Path
from memoai.providers.asr.base import Segment
from memoai.exporters.common import format_timestamp, render_cues, save_cues


def format_timestamp_vtt(seconds: float) -> str:
    """Format seconds into WebVTT timestamp: HH:MM:SS.mmm"""
    return format_timestamp(seconds, sep=".")


def export_vtt(
    segments: list[Segment],
    translations: list[str] | None = None,
    mode: str = "dual",
    output_path: Path | None = None,
) -> str:
    """Generate WebVTT formatted string and optionally write to output_path."""
    lines = ["WEBVTT", ""] + render_cues(segments, translations, mode=mode, sep=".")
    return save_cues(lines, output_path)
