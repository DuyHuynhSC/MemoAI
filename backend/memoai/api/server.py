import os
import time
import threading
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from sqlmodel import Session, select

from memoai.db import init_db, get_session, engine
from memoai.models import Project, SegmentRecord, Vocab, AIProfile, AppSettings
from memoai.config import settings
from memoai.network import (
    apply_network_settings,
    test_network_connectivity,
    get_ssl_verify,
    get_proxy_url,
    get_httpx_client,
)
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


def seed_default_profiles():
    with Session(engine) as session:
        existing = session.exec(select(AIProfile)).first()
        if not existing:
            g_key = settings.gemini_api_key or os.getenv("GEMINI_API_KEY")
            g_profile = AIProfile(
                name="Google Gemini Flash (Mặc định)",
                provider_type="gemini",
                api_key=g_key,
                model=settings.gemini_asr_model or "gemini-2.5-flash",
                can_asr=True,
                can_translate=True,
            )
            session.add(g_profile)
            session.commit()
            session.refresh(g_profile)

            q_profile = AIProfile(
                name="Server Qwen 3.8 / Ollama Nội Bộ",
                provider_type="openai_compat",
                api_key=settings.openai_api_key or "dummy_key",
                base_url=settings.openai_base_url or "http://localhost:11434/v1",
                model=settings.openai_mt_model or "qwen2.5:latest",
                can_asr=False,
                can_translate=True,
            )
            session.add(q_profile)
            session.commit()
            session.refresh(q_profile)

            app_set = session.exec(select(AppSettings).where(AppSettings.id == 1)).first()
            if not app_set:
                app_set = AppSettings(
                    id=1,
                    default_asr_profile_id=g_profile.id,
                    default_mt_profile_id=g_profile.id,
                    default_translation_mode="learning",
                    proxy_enabled=settings.proxy_enabled,
                    http_proxy=settings.http_proxy,
                    https_proxy=settings.https_proxy,
                    no_proxy=settings.no_proxy,
                    ca_cert_path=settings.ca_cert_path or settings.ssl_cert_file or settings.requests_ca_bundle,
                    insecure_skip_verify=settings.insecure_skip_verify,
                )
                session.add(app_set)
                session.commit()


seed_default_profiles()
# Apply proxy and custom CA settings globally at backend startup
apply_network_settings()

app = FastAPI(title="MemoAI Desktop API", version="0.1.0")


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
    title: Optional[str] = None
    source_lang: str = "ja"
    target_lang: str = "vi"
    asr_provider: Optional[str] = "gemini"
    mt_provider: Optional[str] = "gemini"
    asr_profile_id: Optional[int] = None
    mt_profile_id: Optional[int] = None
    gemini_key: Optional[str] = None
    openai_base_url: Optional[str] = None
    openai_key: Optional[str] = None
    openai_model: Optional[str] = None
    mode: str = "learning"


class UpdateProjectRequest(BaseModel):
    title: Optional[str] = None


class AddVocabRequest(BaseModel):
    word: str
    reading: Optional[str] = None
    romanized: Optional[str] = None
    meaning: str
    jlpt: Optional[str] = None
    pos: Optional[str] = None
    context_sentence: Optional[str] = None
    context_translation: Optional[str] = None


class TestProfileRequest(BaseModel):
    provider_type: str
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: str


class UpdateSettingsRequest(BaseModel):
    default_asr_profile_id: Optional[int] = None
    default_mt_profile_id: Optional[int] = None
    default_translation_mode: Optional[str] = "learning"
    proxy_enabled: Optional[bool] = None
    http_proxy: Optional[str] = None
    https_proxy: Optional[str] = None
    no_proxy: Optional[str] = None
    ca_cert_path: Optional[str] = None
    insecure_skip_verify: Optional[bool] = None


class TestNetworkRequest(BaseModel):
    proxy_enabled: bool = False
    http_proxy: Optional[str] = None
    https_proxy: Optional[str] = None
    no_proxy: Optional[str] = "localhost,127.0.0.1"
    ca_cert_path: Optional[str] = None
    insecure_skip_verify: bool = False


class SaveCaCertRequest(BaseModel):
    filename: str
    content: str




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

            # 1. Resolve ASR Provider
            asr_profile = session.get(AIProfile, req.asr_profile_id) if req.asr_profile_id else None
            if asr_profile:
                if asr_profile.provider_type == "gemini":
                    asr = GeminiASR(api_key=asr_profile.api_key or settings.gemini_api_key, model=asr_profile.model)
                else:
                    asr = OpenAICompatASR(base_url=asr_profile.base_url, api_key=asr_profile.api_key, model=asr_profile.model)
            else:
                g_key = req.gemini_key or settings.gemini_api_key or os.getenv("GEMINI_API_KEY")
                if req.asr_provider == "gemini":
                    asr = GeminiASR(api_key=g_key, model=settings.gemini_asr_model)
                else:
                    asr = OpenAICompatASR(base_url=req.openai_base_url, api_key=req.openai_key, model=settings.openai_asr_model)

            # 2. Resolve MT Provider
            mt_profile = session.get(AIProfile, req.mt_profile_id) if req.mt_profile_id else None
            if mt_profile:
                if mt_profile.provider_type == "gemini":
                    mt = GeminiTranslator(api_key=mt_profile.api_key or settings.gemini_api_key, model=mt_profile.model)
                else:
                    mt = OpenAICompatTranslator(base_url=mt_profile.base_url, api_key=mt_profile.api_key, model=mt_profile.model)
            else:
                g_key = req.gemini_key or settings.gemini_api_key or os.getenv("GEMINI_API_KEY")
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

            # 3. Run Pipeline
            project_dir = settings.get_data_dir() / f"project_{project_id}"
            out_files = runner.run(
                input_path_or_url=req.url_or_path,
                output_dir=project_dir,
                translation_mode=req.mode,
            )

            # 4. Save Media Path & Status
            media_path = out_files.get("media")
            detected_title = out_files.get("title")
            p = session.get(Project, project_id)
            if p:
                if media_path:
                    p.media_path = str(media_path)
                if detected_title and (not req.title or not req.title.strip() or p.title == req.url_or_path.split("/")[-1]):
                    p.title = detected_title
                p.status = "completed"
                p.progress = 1.0
                p.current_step = "Hoàn thành!"
                session.add(p)
                session.commit()

            # 5. Populate segments into DB
            ja_srt_path = out_files.get("src_srt")
            vi_srt_path = out_files.get("tgt_srt")

            if ja_srt_path and ja_srt_path.exists():
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


# ==================== SETTINGS & PROFILES ====================

@app.get("/api/settings")
def get_settings(session: Session = Depends(get_session)):
    app_set = session.exec(select(AppSettings).where(AppSettings.id == 1)).first()
    if not app_set:
        app_set = AppSettings(id=1, default_translation_mode="learning")
        session.add(app_set)
        session.commit()
        session.refresh(app_set)
    profiles = session.exec(select(AIProfile).order_by(AIProfile.id)).all()
    return {
        "settings": app_set,
        "profiles": profiles,
    }


@app.put("/api/settings")
def update_settings(req: UpdateSettingsRequest, session: Session = Depends(get_session)):
    app_set = session.exec(select(AppSettings).where(AppSettings.id == 1)).first()
    if not app_set:
        app_set = AppSettings(id=1)
    if req.default_asr_profile_id is not None:
        app_set.default_asr_profile_id = req.default_asr_profile_id
    if req.default_mt_profile_id is not None:
        app_set.default_mt_profile_id = req.default_mt_profile_id
    if req.default_translation_mode:
        app_set.default_translation_mode = req.default_translation_mode
    if req.proxy_enabled is not None:
        app_set.proxy_enabled = req.proxy_enabled
    if req.http_proxy is not None:
        app_set.http_proxy = req.http_proxy.strip() if req.http_proxy.strip() else None
    if req.https_proxy is not None:
        app_set.https_proxy = req.https_proxy.strip() if req.https_proxy.strip() else None
    if req.no_proxy is not None:
        app_set.no_proxy = req.no_proxy.strip() or "localhost,127.0.0.1"
    if req.ca_cert_path is not None:
        app_set.ca_cert_path = req.ca_cert_path.strip() if req.ca_cert_path.strip() else None
    if req.insecure_skip_verify is not None:
        app_set.insecure_skip_verify = req.insecure_skip_verify

    session.add(app_set)
    session.commit()
    session.refresh(app_set)

    # Immediately apply to environment
    apply_network_settings(app_set)

    return app_set


@app.post("/api/settings/test-network")
def test_network_endpoint(req: TestNetworkRequest):
    return test_network_connectivity(
        proxy_enabled=req.proxy_enabled,
        http_proxy=req.http_proxy,
        https_proxy=req.https_proxy,
        ca_cert_path=req.ca_cert_path,
        insecure_skip_verify=req.insecure_skip_verify,
        no_proxy=req.no_proxy,
    )


@app.post("/api/settings/upload-ca")
def upload_ca_cert(req: SaveCaCertRequest):
    ext = Path(req.filename or "").suffix.lower()
    if ext not in [".ca", ".pem", ".crt", ".cer", ".txt"]:
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ tệp chứng chỉ: .ca, .pem, .crt, .cer")

    if not req.content or not req.content.strip():
        raise HTTPException(status_code=400, detail="Nội dung chứng chỉ rỗng")

    certs_dir = settings.get_certs_dir()
    safe_name = Path(req.filename or "custom_root.ca").name
    dest_path = certs_dir / safe_name

    with open(dest_path, "w", encoding="utf-8") as f:
        f.write(req.content.strip())

    return {
        "file_path": str(dest_path.resolve()),
        "filename": safe_name,
        "size": len(req.content),
    }



@app.get("/api/settings/profiles")
def list_profiles(session: Session = Depends(get_session)):
    return session.exec(select(AIProfile).order_by(AIProfile.id)).all()


@app.post("/api/settings/profiles")
def create_profile(profile: AIProfile, session: Session = Depends(get_session)):
    profile.id = None
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


@app.put("/api/settings/profiles/{profile_id}")
def update_profile(profile_id: int, updated: AIProfile, session: Session = Depends(get_session)):
    p = session.get(AIProfile, profile_id)
    if not p:
        raise HTTPException(status_code=404, detail="Profile not found")
    p.name = updated.name
    p.provider_type = updated.provider_type
    p.api_key = updated.api_key
    p.base_url = updated.base_url
    p.model = updated.model
    p.can_asr = updated.can_asr
    p.can_translate = updated.can_translate
    session.add(p)
    session.commit()
    session.refresh(p)
    return p


@app.delete("/api/settings/profiles/{profile_id}")
def delete_profile(profile_id: int, session: Session = Depends(get_session)):
    p = session.get(AIProfile, profile_id)
    if not p:
        raise HTTPException(status_code=404, detail="Profile not found")
    session.delete(p)
    session.commit()
    return {"ok": True}


@app.post("/api/settings/profiles/test")
def test_profile(req: TestProfileRequest):
    """Test connection to an AI provider profile and report latency."""
    t0 = time.time()
    try:
        if req.provider_type == "gemini":
            from google import genai
            from google.genai import types
            g_key = req.api_key or settings.gemini_api_key or os.getenv("GEMINI_API_KEY")
            if not g_key:
                return {"success": False, "message": "Chưa có Gemini API Key."}

            verify = get_ssl_verify()
            proxy = get_proxy_url()
            client_args = {}
            if verify is not True:
                client_args["verify"] = verify
            if proxy:
                client_args["proxy"] = proxy
            http_options = types.HttpOptions(client_args=client_args) if client_args else None
            client = genai.Client(api_key=g_key, http_options=http_options)

            res = client.models.generate_content(
                model=req.model,
                contents="Ping. Say OK",
                config=types.GenerateContentConfig(
                    max_output_tokens=10,
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True)
                )
            )
            elapsed = int((time.time() - t0) * 1000)
            return {
                "success": True,
                "latency_ms": elapsed,
                "message": f"Kết nối Gemini thành công! (Mô hình {req.model}, độ trễ {elapsed}ms)",
            }
        else:
            from openai import OpenAI
            base_url = req.base_url or "http://localhost:11434/v1"
            client = OpenAI(
                base_url=base_url,
                api_key=req.api_key or "dummy_key",
                http_client=get_httpx_client(),
            )
            res = client.chat.completions.create(
                model=req.model,
                messages=[{"role": "user", "content": "Ping. Say OK"}],
                max_tokens=10,
            )
            elapsed = int((time.time() - t0) * 1000)
            reply = res.choices[0].message.content or "OK"
            return {
                "success": True,
                "latency_ms": elapsed,
                "message": f"Kết nối Server thành công! (Mô hình {req.model}, phản hồi: '{reply.strip()}', độ trễ {elapsed}ms)",
            }
    except Exception as e:
        return {"success": False, "message": f"Lỗi kết nối: {str(e)}"}


# ==================== PROJECTS ====================

@app.get("/api/projects")
def list_projects(session: Session = Depends(get_session)):
    return session.exec(select(Project).order_by(Project.created_at.desc())).all()


@app.post("/api/projects")
def create_project(req: CreateProjectRequest, background_tasks: BackgroundTasks, session: Session = Depends(get_session)):
    init_title = (
        req.title.strip()
        if req.title and req.title.strip()
        else (Path(req.url_or_path).stem if not req.url_or_path.startswith("http") else req.url_or_path.split("/")[-1])
    )
    project = Project(
        title=init_title or "Untitled Video",
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


@app.patch("/api/projects/{project_id}")
def update_project(project_id: int, req: UpdateProjectRequest, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if req.title is not None and req.title.strip():
        project.title = req.title.strip()
        session.add(project)
        session.commit()
        session.refresh(project)
    return project


@app.get("/api/media/fetch-info")
def fetch_media_info_api(url: str = Query(...)):
    from memoai.media import is_url, get_yt_dlp_options
    if not is_url(url):
        return {"title": Path(url).stem}
    import yt_dlp
    import time

    last_err = None
    for attempt in range(1, 4):
        try:
            extra = {"skip_download": True}
            if attempt == 3 and last_err and ("SSL" in str(last_err) or "CERTIFICATE" in str(last_err)):
                extra["nocheckcertificate"] = True
                extra["no_check_certificate"] = True
            ydl_opts = get_yt_dlp_options(extra)
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                return {
                    "title": info.get("title") or url.split("/")[-1],
                    "duration": info.get("duration") or 0.0,
                }
        except Exception as e:
            last_err = e
            time.sleep(1)

    return {"title": url.split("/")[-1], "error": str(last_err)}




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
