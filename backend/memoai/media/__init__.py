"""Media helpers for downloading and processing audio/video."""
import os
import shutil
import subprocess
from pathlib import Path
import yt_dlp


def is_url(path_or_url: str) -> bool:
    """Check if input string is a URL."""
    return path_or_url.startswith("http://") or path_or_url.startswith("https://")


from typing import Callable


def get_yt_dlp_options(extra_opts: dict | None = None) -> dict:
    """Build yt-dlp options incorporating active Proxy and CA certificate settings."""
    from memoai.network import get_active_network_settings, ensure_combined_ca_bundle

    app_set = get_active_network_settings()
    # Ensure combined bundle is generated and patched
    ensure_combined_ca_bundle(app_set)

    opts: dict = {
        "quiet": True,
        "no_warnings": True,
        "retries": 10,
        "fragment_retries": 10,
        "file_access_retries": 5,
        "extractor_retries": 5,
        "retry_sleep": 2,
        "socket_timeout": 30,
        "compat_opts": ["no-certifi"],
    }

    if app_set.proxy_enabled and (app_set.https_proxy or app_set.http_proxy):
        opts["proxy"] = app_set.https_proxy or app_set.http_proxy

    if app_set.insecure_skip_verify:
        opts["nocheckcertificate"] = True
        opts["no_check_certificate"] = True
        opts["prefer_insecure"] = True

    if extra_opts:
        opts.update(extra_opts)

    return opts


def download_media(
    url: str,
    output_dir: Path,
    progress_cb: Callable[[str, float], None] | None = None,
    max_retries: int = 3,
) -> tuple[Path, dict]:
    """Download video or audio using yt-dlp with automatic retries and format fallbacks.
    Returns path to downloaded file and info dict.
    """
    import time
    output_dir.mkdir(parents=True, exist_ok=True)
    out_tmpl = str(output_dir / "%(id)s.%(ext)s")

    format_candidates = [
        "bestvideo[height<=720]+bestaudio/best[height<=720]/best",
        "best[height<=720]/best",
        "best",
    ]

    last_error: Exception | None = None

    for attempt in range(1, max_retries + 1):
        fmt = format_candidates[min(attempt - 1, len(format_candidates) - 1)]
        extra: dict = {
            "format": fmt,
            "outtmpl": out_tmpl,
        }

        # On final attempt if SSL error occurred, also try nocheckcertificate as last-resort fallback
        if attempt == max_retries and last_error and ("SSL" in str(last_error) or "CERTIFICATE" in str(last_error)):
            extra["nocheckcertificate"] = True
            extra["no_check_certificate"] = True

        ydl_opts = get_yt_dlp_options(extra)

        try:
            if attempt > 1 and progress_cb:
                progress_cb(f"Tải media thất bại, đang thử lại lần {attempt}/{max_retries}...", 0.08)
                time.sleep(attempt * 2)

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                filename = ydl.prepare_filename(info)
                downloaded_path = Path(filename)
                if downloaded_path.exists():
                    return downloaded_path, info

                # Check if merged or alternative extension exists
                for f in output_dir.glob(f"{info.get('id', '')}.*"):
                    if f.is_file() and f.suffix not in [".part", ".ytdl"]:
                        return f, info

                return downloaded_path, info
        except Exception as e:
            last_error = e
            time.sleep(1)

    raise last_error or RuntimeError(f"Tải media thất bại sau {max_retries} lần thử: {url}")



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
