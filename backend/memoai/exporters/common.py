from pathlib import Path
from memoai.providers.asr.base import Segment


def format_timestamp(seconds: float, sep: str = ",") -> str:
    """Format seconds into HH:MM:SS{sep}mmm timestamp."""
    if seconds < 0:
        seconds = 0
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    msecs = int(round((seconds - int(seconds)) * 1000))
    if msecs >= 1000:
        secs += 1
        msecs -= 1000
    return f"{hrs:02d}:{mins:02d}:{secs:02d}{sep}{msecs:03d}"


def render_cues(
    segments: list[Segment],
    translations: list[str] | None = None,
    mode: str = "dual",
    sep: str = ",",
) -> list[str]:
    """Generate subtitle cue lines for segments."""
    lines = []
    has_trans = bool(translations and len(translations) == len(segments))

    for idx, seg in enumerate(segments, start=1):
        lines.append(str(idx))
        start_ts = format_timestamp(seg.start, sep=sep)
        end_ts = format_timestamp(seg.end, sep=sep)
        lines.append(f"{start_ts} --> {end_ts}")

        src_text = seg.text.strip()
        tgt_text = translations[idx - 1].strip() if has_trans else ""

        if mode == "src":
            lines.append(src_text)
        elif mode == "tgt":
            lines.append(tgt_text or src_text)
        elif mode == "dual":
            lines.append(f"{src_text}\n{tgt_text}" if tgt_text else src_text)

        lines.append("")

    return lines


def save_cues(lines: list[str], output_path: Path | None = None) -> str:
    """Join cue lines and optionally write to output_path."""
    content = "\n".join(lines)
    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(content, encoding="utf-8")
    return content
