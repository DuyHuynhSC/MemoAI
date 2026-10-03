from pathlib import Path
from memoai.providers.asr.base import Segment


def format_timestamp_srt(seconds: float) -> str:
    """Format seconds into SRT timestamp: HH:MM:SS,mmm"""
    if seconds < 0:
        seconds = 0
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    msecs = int(round((seconds - int(seconds)) * 1000))
    if msecs >= 1000:
        secs += 1
        msecs -= 1000
    return f"{hrs:02d}:{mins:02d}:{secs:02d},{msecs:03d}"


def export_srt(
    segments: list[Segment],
    translations: list[str] | None = None,
    mode: str = "dual",  # "src", "tgt", "dual"
    output_path: Path | None = None
) -> str:
    """Generate SRT formatted string and optionally write to output_path."""
    lines = []
    has_trans = bool(translations and len(translations) == len(segments))

    for idx, seg in enumerate(segments, start=1):
        lines.append(str(idx))
        start_ts = format_timestamp_srt(seg.start)
        end_ts = format_timestamp_srt(seg.end)
        lines.append(f"{start_ts} --> {end_ts}")

        src_text = seg.text.strip()
        tgt_text = translations[idx - 1].strip() if has_trans else ""

        if mode == "src":
            lines.append(src_text)
        elif mode == "tgt":
            lines.append(tgt_text or src_text)
        elif mode == "dual":
            if tgt_text:
                lines.append(f"{src_text}\n{tgt_text}")
            else:
                lines.append(src_text)

        lines.append("")  # empty line between cues

    content = "\n".join(lines)
    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(content, encoding="utf-8")
    return content
