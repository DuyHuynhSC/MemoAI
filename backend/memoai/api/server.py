import os
import threading
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from memoai.db import init_db, get_session, engine
from memoai.models import Project, SegmentRecord, Vocab
from memoai.config import settings
from memoai.providers.asr.gemini_asr import GeminiASR
from memoai.providers.asr.openai_asr import OpenAICompatASR
from memoai.providers.mt.gemini_mt import GeminiTranslator
from memoai.providers.mt.openai_mt import OpenAICompatTranslator
from memoai.pipeline.runner import PipelineRunner
from memoai.languages.ja import JapaneseLanguagePack
from memoai.services.dictionary import lookup_word
from memoai.services.anki import export_anki_deck

# Initialize tables
init_db()

app = FastAPI(title="MemoAI Desktop API", version="0.1.0")

# Allow requests from Tauri (tauri://localhost or http://localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_ja_pack = JapaneseLanguagePack()


class CreateProjectRequest(BaseModel):
    url_or_path: str
    source_lang: str = "ja"
    target_lang: str = "vi"
    asr_provider: str = "gemini"
    mt_provider: str = "gemini"
    gemini_key: Optional[str] = None
    openai_base_url: Optional[str] = None
    openai_key: Optional[str] = None
    openai_model: Optional[str] = None
    mode: str = "learning"


class AddVocabRequest(BaseModel):
    word: str
    reading: Optional[str] = None
    romanized: Optional[str] = None
    meaning: str
    jlpt: Optional[str] = None
    pos: Optional[str] = None
    context_sentence: Optional[str] = None
    context_translation: Optional[str] = None


def run_pipeline_task(project_id: int, req: CreateProjectRequest):
    """Background task to run audio extraction, ASR, translation and DB save."""
    with Session(engine) as session:
        project = session.get(Project, project_id)
        if not project:
            return

        def update_progress(step: str, pct: float):
            with Session(engine) as sub_session:
                p = sub_session.get(Project, project_id)
                if p:
                    p.current_step = step
                    p.progress = pct
                    sub_session.add(p)
                    sub_session.commit()

        try:
            update_progress("Đang khởi tạo pipeline...", 0.05)

            # 1. Setup Providers
            g_key = req.gemini_key or settings.gemini_api_key or os.getenv("GEMINI_API_KEY")
            if req.asr_provider == "gemini":
                asr = GeminiASR(api_key=g_key, model=settings.gemini_asr_model)
            else:
                asr = OpenAICompatASR(base_url=req.openai_base_url, api_key=req.openai_key, model=settings.openai_asr_model)

            if req.mt_provider == "gemini":
                mt = GeminiTranslator(api_key=g_key, model=settings.gemini_mt_model)
            else:
                mt = OpenAICompatTranslator(base_url=req.openai_base_url, api_key=req.openai_key, model=req.openai_model or settings.openai_mt_model)

            runner = PipelineRunner(
                asr_provider=asr,
                mt_provider=mt,
                src_lang=req.source_lang,
                tgt_lang=req.target_lang,
                progress_cb=update_progress,
            )

            # 2. Run Pipeline
            project_dir = settings.get_data_dir() / f"project_{project_id}"
            out_files = runner.run(
                input_path_or_url=req.url_or_path,
                output_dir=project_dir,
                translation_mode=req.mode,
            )

            # 3. Read generated SRT to populate DB segments
            from memoai.media import extract_audio
            # Update project info
            media_path = out_files.get("media")
            p = session.get(Project, project_id)
            if p and media_path:
                p.media_path = str(media_path)
                p.status = "completed"
                p.progress = 1.0
                p.current_step = "Hoàn thành!"
                session.add(p)
                session.commit()

            # Read back segments
            from memoai.exporters.srt import export_srt
            # Re-read the generated segments from runner by parsing .ja.srt and .vi.srt
            ja_srt_path = out_files.get("src_srt")
            vi_srt_path = out_files.get("tgt_srt")

            if ja_srt_path and ja_srt_path.exists():
                import re
                content = ja_srt_path.read_text(encoding="utf-8")
                vi_content = vi_srt_path.read_text(encoding="utf-8") if vi_srt_path and vi_srt_path.exists() else ""

                blocks = [b.strip() for b in content.split("\n\n") if b.strip()]
                vi_blocks = [b.strip() for b in vi_content.split("\n\n") if b.strip()]

                for i, b in enumerate(blocks):
                    lines = b.splitlines()
                    if len(lines) >= 3:
                        idx = int(lines[0])
                        times = lines[1].split(" --> ")
                        def ts_to_sec(ts: str) -> float:
                            pts = ts.strip().replace(",", ".").split(":")
                            return float(pts[0]) * 3600 + float(pts[1]) * 60 + float(pts[2])
                        start = ts_to_sec(times[0])
                        end = ts_to_sec(times[1])
                        text = " ".join(lines[2:]).strip()

                        trans = ""
                        if i < len(vi_blocks):
                            v_lines = vi_blocks[i].splitlines()
                            if len(v_lines) >= 3:
                                trans = " ".join(v_lines[2:]).strip()

                        ruby = _ja_pack.to_ruby_html(text) if req.source_lang == "ja" else text
                        romaji = _ja_pack.romanize(text) if req.source_lang == "ja" else ""

                        seg = SegmentRecord(
                            project_id=project_id,
                            idx=idx,
                            start=start,
                            end=end,
                            text=text,
                            translation=trans,
                            ruby_html=ruby,
                            romanized=romaji,
                        )
                        session.add(seg)
                session.commit()

        except Exception as e:
            p = session.get(Project, project_id)
            if p:
                p.status = "error"
                p.error_msg = str(e)
                session.add(p)
                session.commit()


@app.get("/health")
def health():
    return {"status": "ok", "app": "MemoAI Desktop"}


@app.get("/api/projects")
def list_projects(session: Session = Depends(get_session)):
    return session.exec(select(Project).order_by(Project.created_at.desc())).all()


@app.post("/api/projects")
def create_project(req: CreateProjectRequest, background_tasks: BackgroundTasks, session: Session = Depends(get_session)):
    title = Path(req.url_or_path).stem if not req.url_or_path.startswith("http") else req.url_or_path.split("/")[-1]
    project = Project(
        title=title or "Untitled Video",
        source_type="url" if req.url_or_path.startswith("http") else "file",
        source_uri=req.url_or_path,
        source_lang=req.source_lang,
        target_lang=req.target_lang,
        status="processing",
        progress=0.05,
        current_step="Bắt đầu xử lý...",
    )
    session.add(project)
    session.commit()
    session.refresh(project)

    background_tasks.add_task(run_pipeline_task, project.id, req)
    return project


@app.get("/api/projects/{project_id}")
def get_project(project_id: int, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    segments = session.exec(
        select(SegmentRecord).where(SegmentRecord.project_id == project_id).order_by(SegmentRecord.idx)
    ).all()

    # Split segments into interactive tokens
    seg_list = []
    for s in segments:
        tokens = []
        if project.source_lang == "ja":
            raw_tokens = _ja_pack.tokenize(s.text)
            for t in raw_tokens:
                tokens.append({
                    "surface": t.surface,
                    "reading": t.reading,
                    "pos": t.pos,
                    "romanized": t.romanized,
                })
        seg_list.append({
            "id": s.id,
            "idx": s.idx,
            "start": s.start,
            "end": s.end,
            "text": s.text,
            "translation": s.translation,
            "ruby_html": s.ruby_html,
            "romanized": s.romanized,
            "tokens": tokens,
        })

    return {
        "project": project,
        "segments": seg_list,
    }


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: int, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    session.delete(project)
    session.commit()
    return {"ok": True}


@app.get("/api/media/{project_id}")
def stream_media(project_id: int, request: Request, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project or not project.media_path or not Path(project.media_path).exists():
        raise HTTPException(status_code=404, detail="Media file not found")

    path = Path(project.media_path)
    file_size = path.stat().st_size
    range_header = request.headers.get("range")

    if not range_header:
        return FileResponse(path, media_type="video/mp4")

    # Range handling for video player seeking
    range_match = range_header.replace("bytes=", "").split("-")
    start = int(range_match[0])
    end = int(range_match[1]) if range_match[1] else file_size - 1
    chunk_size = (end - start) + 1

    def send_bytes():
        with open(path, "rb") as f:
            f.seek(start)
            bytes_left = chunk_size
            while bytes_left > 0:
                chunk = f.read(min(bytes_left, 1024 * 1024))
                if not chunk:
                    break
                bytes_left -= len(chunk)
                yield chunk

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(chunk_size),
        "Content-Type": "video/mp4",
    }
    return StreamingResponse(send_bytes(), status_code=206, headers=headers)


@app.get("/api/dictionary/lookup")
def api_lookup_word(q: str = Query(...), context: Optional[str] = Query(None)):
    return lookup_word(q, context)


@app.get("/api/vocab")
def list_vocab(session: Session = Depends(get_session)):
    return session.exec(select(Vocab).order_by(Vocab.created_at.desc())).all()


@app.post("/api/vocab")
def add_vocab(req: AddVocabRequest, session: Session = Depends(get_session)):
    vocab = Vocab(
        word=req.word,
        reading=req.reading,
        romanized=req.romanized,
        meaning=req.meaning,
        jlpt=req.jlpt,
        pos=req.pos,
        context_sentence=req.context_sentence,
        context_translation=req.context_translation,
    )
    session.add(vocab)
    session.commit()
    session.refresh(vocab)
    return vocab


@app.delete("/api/vocab/{vocab_id}")
def delete_vocab(vocab_id: int, session: Session = Depends(get_session)):
    vocab = session.get(Vocab, vocab_id)
    if not vocab:
        raise HTTPException(status_code=404, detail="Vocab not found")
    session.delete(vocab)
    session.commit()
    return {"ok": True}


@app.get("/api/vocab/export/anki")
def export_anki(session: Session = Depends(get_session)):
    vocabs = session.exec(select(Vocab)).all()
    if not vocabs:
        raise HTTPException(status_code=400, detail="Chưa có từ vựng nào trong danh sách.")

    export_path = settings.get_data_dir() / "memoai_japanese_vocab.apkg"
    export_anki_deck(vocabs, output_path=export_path)
    return FileResponse(export_path, filename="memoai_japanese_vocab.apkg", media_type="application/octet-stream")
