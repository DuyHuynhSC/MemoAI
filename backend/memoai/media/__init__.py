"""Media helpers for downloading and processing audio/video."""
import os
import shutil
import subprocess
from pathlib import Path
import yt_dlp


def is_url(path_or_url: str) -> bool:
    """Check if input string is a URL."""
    return path_or_url.startswith("http://") or path_or_url.startswith("https://")


def download_media(url: str, output_dir: Path) -> tuple[Path, dict]:
    """Download video or audio using yt-dlp.
    Returns path to downloaded file and info dict.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    out_tmpl = str(output_dir / "%(id)s.%(ext)s")

    ydl_opts = {
        "format": "bestvideo[height<=720]+bestaudio/best[height<=720]/best",
        "outtmpl": out_tmpl,
        "quiet": True,
        "no_warnings": True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        filename = ydl.prepare_filename(info)
        return Path(filename), info


def get_media_duration(file_path: Path) -> float:
    """Get media duration in seconds using ffprobe."""
    ffprobe_cmd = shutil.which("ffprobe") or "ffprobe"
    cmd = [
        ffprobe_cmd,
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(file_path)
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return float(result.stdout.strip())


def extract_audio(
    video_path: Path,
    output_path: Path | None = None,
    sample_rate: int = 16000,
    channels: int = 1
) -> Path:
    """Extract audio from video file to 16kHz mono WAV using ffmpeg."""
    ffmpeg_cmd = shutil.which("ffmpeg") or "ffmpeg"

    if output_path is None:
        output_path = video_path.with_suffix(".wav")

    cmd = [
        ffmpeg_cmd,
        "-y",
        "-i", str(video_path),
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", str(sample_rate),
        "-ac", str(channels),
        str(output_path)
    ]

    subprocess.run(cmd, capture_output=True, check=True)
    return output_path
