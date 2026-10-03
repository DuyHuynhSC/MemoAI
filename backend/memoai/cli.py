import os
import sys

# Ensure UTF-8 output encoding on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from pathlib import Path
from typing import Optional
import typer
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TimeElapsedColumn

from memoai.config import settings
from memoai.providers.asr.gemini_asr import GeminiASR
from memoai.providers.asr.openai_asr import OpenAICompatASR
from memoai.providers.mt.gemini_mt import GeminiTranslator
from memoai.providers.mt.openai_mt import OpenAICompatTranslator
from memoai.pipeline.runner import PipelineRunner
from memoai.languages.ja import JapaneseLanguagePack

app = typer.Typer(
    name="memoai",
    help="MemoAI: Trình tạo phụ đề song ngữ và trợ lý học ngoại ngữ từ video.",
    add_completion=False,
)
console = Console()


@app.command()
def test_server(
    base_url: str = typer.Option("http://localhost:11434/v1", "--base-url", "-u", help="URL endpoint tương thích OpenAI"),
    api_key: Optional[str] = typer.Option(None, "--api-key", "-k", help="API key (nếu có)"),
    model: str = typer.Option("qwen2.5:latest", "--model", "-m", help="Tên model (ví dụ qwen3.8, qwen2.5)"),
):
    """Kiểm tra kết nối tới server OpenAI-compatible (Qwen / Ollama / LM Studio)."""
    console.print(f"[bold cyan]Đang kiểm tra kết nối tới:[/bold cyan] {base_url}")
    try:
        from openai import OpenAI
        client = OpenAI(base_url=base_url, api_key=api_key or "dummy_key")
        
        # Test listing models
        try:
            models = client.models.list()
            model_ids = [m.id for m in models.data]
            console.print(f"[green]✓ Kết nối thành công![/green] Danh sách model tìm thấy: {model_ids}")
        except Exception as e:
            console.print(f"[yellow]! Không thể liệt kê model (có thể endpoint /models bị tắt): {e}[/yellow]")

        # Test simple chat completion
        console.print(f"Đang gửi prompt thử nghiệm tới model [magenta]{model}[/magenta]...")
        res = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Xin chào! Bạn có thể dịch từ tiếng Nhật sang tiếng Việt không?"}],
            max_tokens=60
        )
        content = res.choices[0].message.content
        console.print(Panel(content, title=f"Phản hồi từ {model}", border_style="green"))
    except Exception as e:
        console.print(f"[bold red]✗ Lỗi kết nối:[/bold red] {e}")
        sys.exit(1)


@app.command()
def run(
    input_path_or_url: str = typer.Argument(..., help="Đường dẫn file video/audio hoặc link YouTube"),
    src: str = typer.Option("ja", "--src", "-s", help="Ngôn ngữ gốc (mặc định: ja - Nhật)"),
    tgt: str = typer.Option("vi", "--tgt", "-t", help="Ngôn ngữ dịch (mặc định: vi - Việt)"),
    asr: str = typer.Option("gemini", "--asr", help="Bộ nhận dạng giọng nói: 'gemini' hoặc 'openai'"),
    mt: str = typer.Option("openai", "--mt", help="Bộ dịch: 'openai' (cho Qwen/Ollama) hoặc 'gemini'"),
    gemini_key: Optional[str] = typer.Option(None, "--gemini-key", help="API key của Google Gemini"),
    openai_base_url: Optional[str] = typer.Option(None, "--openai-base-url", help="Base URL cho server OpenAI/Qwen"),
    openai_key: Optional[str] = typer.Option(None, "--openai-key", help="API key cho server OpenAI/Qwen"),
    openai_model: Optional[str] = typer.Option(None, "--openai-model", help="Tên model OpenAI/Qwen"),
    output_dir: Optional[Path] = typer.Option(None, "--output-dir", "-o", help="Thư mục lưu phụ đề xuất ra"),
    mode: str = typer.Option("learning", "--mode", help="Phong cách dịch: 'learning' (sát nghĩa) hoặc 'natural' (tự nhiên)")
):
    """Tạo phụ đề song ngữ từ video hoặc URL YouTube."""
    console.print(Panel.fit(
        f"[bold green]MemoAI Subtitle Generator[/bold green]\n"
        f"Đầu vào: [cyan]{input_path_or_url}[/cyan]\n"
        f"Ngôn ngữ: [yellow]{src}[/yellow] ➔ [yellow]{tgt}[/yellow]\n"
        f"ASR Provider: [magenta]{asr}[/magenta] | MT Provider: [magenta]{mt}[/magenta]",
        border_style="cyan"
    ))

    # 1. Setup ASR Provider
    g_key = gemini_key or settings.gemini_api_key or os.getenv("GEMINI_API_KEY")
    oa_base = openai_base_url or settings.openai_base_url or os.getenv("OPENAI_BASE_URL")
    oa_key = openai_key or settings.openai_api_key or os.getenv("OPENAI_API_KEY")
    oa_model = openai_model or settings.openai_mt_model

    if asr.lower() == "gemini":
        if not g_key:
            console.print("[red]Lỗi: Chưa cấu hình GEMINI_API_KEY (dùng flag --gemini-key hoặc set biến môi trường GEMINI_API_KEY).[/red]")
            sys.exit(1)
        asr_provider = GeminiASR(api_key=g_key, model=settings.gemini_asr_model)
    elif asr.lower() == "openai":
        asr_provider = OpenAICompatASR(base_url=oa_base, api_key=oa_key, model=settings.openai_asr_model)
    else:
        console.print(f"[red]ASR provider '{asr}' không được hỗ trợ. Chọn 'gemini' hoặc 'openai'.[/red]")
        sys.exit(1)

    # 2. Setup MT Provider
    if mt.lower() == "gemini":
        if not g_key:
            console.print("[red]Lỗi: Chưa cấu hình GEMINI_API_KEY cho dịch thuật.[/red]")
            sys.exit(1)
        mt_provider = GeminiTranslator(api_key=g_key, model=settings.gemini_mt_model)
    elif mt.lower() == "openai":
        if not oa_base:
            console.print("[yellow]Cảnh báo: OPENAI_BASE_URL chưa được chỉ định, sẽ mặc định sử dụng endpoint OpenAI chuẩn hoặc biến môi trường.[/yellow]")
        mt_provider = OpenAICompatTranslator(base_url=oa_base, api_key=oa_key, model=oa_model)
    else:
        console.print(f"[red]MT provider '{mt}' không được hỗ trợ. Chọn 'openai' hoặc 'gemini'.[/red]")
        sys.exit(1)

    # 3. Run Pipeline with Rich Progress
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("{task.percentage:>3.0f}%"),
        TimeElapsedColumn(),
        console=console
    ) as progress:
        task = progress.add_task("[cyan]Đang bắt đầu...", total=100)

        def on_progress(step_desc: str, pct: float):
            progress.update(task, description=f"[cyan]{step_desc}", completed=int(pct * 100))

        runner = PipelineRunner(
            asr_provider=asr_provider,
            mt_provider=mt_provider,
            src_lang=src,
            tgt_lang=tgt,
            progress_cb=on_progress
        )

        try:
            out_files = runner.run(
                input_path_or_url=input_path_or_url,
                output_dir=output_dir,
                translation_mode=mode
            )
        except Exception as e:
            console.print(f"\n[bold red]✗ Lỗi trong quá trình xử lý:[/bold red] {e}")
            sys.exit(1)

    console.print("\n[bold green]✓ Hoàn tất xuất sắc![/bold green] Các file phụ đề đã tạo:")
    for key, path in out_files.items():
        if key != "media":
            console.print(f"  • [bold]{key}[/bold]: [cyan]{path}[/cyan]")


if __name__ == "__main__":
    app()
