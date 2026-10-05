# MemoAI 🎬🇯🇵🇻🇳

> **Ứng dụng Desktop thông minh hỗ trợ học tiếng Nhật qua video với phụ đề song ngữ AI, Furigana tương tác, tra từ điển tức thì và xuất thẻ Anki.**

[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue?style=flat-square)]()
[![Tauri](https://img.shields.io/badge/Tauri-v2-orange?style=flat-square&logo=tauri)]()
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)]()
[![Python](https://img.shields.io/badge/Python-3.12%2B%20(uv)-3776ab?style=flat-square&logo=python)]()
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?style=flat-square&logo=fastapi)]()
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)]()

---

## 🌟 Tính năng nổi bật

### 1. 🎙️ Nhận dạng giọng nói (ASR) không cần GPU cục bộ
* **Google Gemini Cloud**: Hỗ trợ `gemini-2.5-flash`, `gemini-2.5-pro`... với cơ chế tự động thử lại khi quá tải (HTTP 503/429) và tự động fallback sang các model dự phòng.
* **Server nội bộ tương thích OpenAI**: Hỗ trợ kết nối tới server local hoặc trong mạng LAN (Ollama, LM Studio, vLLM, Speaches, Whisper-compatible).

### 2. 🌐 Dịch song ngữ chuyên sâu cho học tập
* **2 Chế độ dịch linh hoạt**:
  * **Học tập (Learning)**: Dịch bám sát cấu trúc ngữ pháp và trật tự từ vựng, giúp người học hiểu rõ bản chất câu.
  * **Tự nhiên (Natural)**: Dịch thoát ý, văn phong trôi chảy tự nhiên như người bản xứ.
* Hỗ trợ model dịch mạnh mẽ: Google Gemini, Qwen 2.5/3.8, v.v.

### 3. ⚙️ Cài đặt kết nối AI trực tiếp trên giao diện (In-App Settings)
* Không cần chỉnh sửa file cấu hình `.env` thủ công.
* Quản lý nhiều hồ sơ kết nối AI (AI Profiles) cùng lúc: thêm, sửa, xóa, phân quyền ASR / MT.
* **Thử kết nối (Live Ping Test)**: Kiểm tra trực tiếp tính hợp lệ của API Key / Server URL và hiển thị độ trễ (latency ms).

### 4. 🈸 Furigana thông minh & Phân tích hình thái tiếng Nhật
* Tích hợp **Fugashi (MeCab) + UniDic-Lite + PyKakasi** chạy hoàn toàn trên backend.
* Tự động hiển thị cách đọc Hiragana ngay trên đầu chữ Hán (Kanji) bằng thẻ `<ruby>` chuẩn xác.
* Hiển thị đồng thời phiên âm Romaji cho người mới bắt đầu.

### 5. 🔍 Tra từ điển tức thì (Click-to-lookup)
* Bấm trực tiếp vào bất kỳ từ tiếng Nhật nào trên video hoặc danh sách lời thoại để xem:
  * Cách đọc Kanji / Hiragana / Katakana / Romaji.
  * Cấp độ JLPT tương ứng (N5 -> N1).
  * Từ loại (Danh từ, Động từ, Tính từ,...).
  * Định nghĩa chi tiết bằng tiếng Việt.

### 6. 🔁 Công cụ luyện phát âm & Shadowing
* **Lặp câu (A-B Loop)**: Lặp đi lặp lại một câu thoại đang chọn để luyện nghe bắt âm.
* **Chế độ Shadowing**: Video tự động tạm dừng ở cuối mỗi câu thoại để bạn đọc nhại theo trước khi chuyển sang câu kế tiếp.
* **Tùy biến hiển thị phụ đề**: Ẩn/hiện linh hoạt Furigana, Romaji, tiếng Nhật, tiếng Việt theo trình độ của người học.

### 7. 🗂️ Sổ từ vựng & Xuất thẻ Anki (.apkg)
* Lưu nhanh các từ mới kèm câu ngữ cảnh vào **Sổ từ vựng**.
* Xuất file **Anki Deck (`.apkg`)** chuẩn hóa chỉ với 1 cú click chuột, có sẵn giao diện thẻ flashcard đẹp mắt để ôn tập ngắt quãng (SRS).

---

## 🏗️ Cấu trúc dự án

```
MemoAI/
├── backend/                  # Python 3.12 + FastAPI + SQLite + Google GenAI + Japanese NLP
│   ├── memoai/
│   │   ├── api/server.py     # FastAPI REST Server, Range streaming, Anki export, Profile settings
│   │   ├── services/         # Tra cứu từ điển (dictionary.py) & Đóng gói thẻ Anki (anki.py)
│   │   ├── providers/        # ASR (Gemini/OpenAI) & MT (Gemini/Qwen)
│   │   ├── languages/        # Bộ bóc tách hình thái tiếng Nhật (fugashi + unidic-lite + pykakasi)
│   │   ├── models.py         # SQLModel database schema (Project, Segment, Vocab, AIProfile, AppSettings)
│   │   └── cli.py            # Giao diện dòng lệnh CLI độc lập
│   └── tests/                # Bộ kiểm thử tự động (pytest)
├── apps/
│   └── desktop/              # Ứng dụng Desktop: Tauri v2 + React 19 + TypeScript + TailwindCSS
│       ├── src/
│       │   ├── components/   # VideoPlayer, SubtitleOverlay, TranscriptList, WordPopup, SettingsModal, AnkiModal
│       │   ├── api/client.ts # API Client kết nối với Backend
│       │   └── types.ts      # TypeScript definitions
│       └── src-tauri/        # Cấu hình Desktop Native Window (Rust + WebView2)
└── README.md
```

---

## 🛠️ Yêu cầu môi trường

1. **Python**: Phiên bản `>= 3.12`
   * Khuyến nghị dùng trình quản lý gói siêu tốc [`uv`](https://docs.astral.sh/uv/):
     ```powershell
     powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
     ```
2. **Node.js**: Phiên bản `>= 18.x` và `npm`
3. **FFmpeg**: Cần có trong `PATH` hệ thống để trích xuất âm thanh từ video.
4. *(Tùy chọn cho Desktop Native)*: **Rust** toolchain (nếu muốn build binary Tauri).

---

## 🚀 Hướng dẫn cài đặt & Khởi chạy

### Bước 1: Clone dự án
```bash
git clone https://github.com/DuyHuynhSC/MemoAI.git
cd MemoAI
```

### Bước 2: Cài đặt & Khởi động Backend API Server
```powershell
cd backend
uv sync
uv run memoai server
```
> Server API sẽ sẵn sàng tại: `http://127.0.0.1:8000` (Tài liệu API Swagger tại `http://127.0.0.1:8000/docs`).

### Bước 3: Khởi động Giao diện Desktop

Mở một cửa sổ terminal mới:

#### 👉 Cách A: Chạy cửa sổ Desktop Native (Tauri v2)
```powershell
cd apps/desktop
npm install
npx tauri dev
```
*(Cửa sổ ứng dụng Desktop native sẽ tự động mở lên)*

#### 👉 Cách B: Chạy nhanh trên Trình duyệt Web (Phát triển / Preview)
```powershell
cd apps/desktop
npm install
npm run dev
```
*(Mở trình duyệt tại: `http://localhost:5173`)*

---

## 💻 Sử dụng qua Giao diện Dòng lệnh (CLI)

Nếu không muốn mở giao diện đồ họa, bạn có thể xử lý video hoàn toàn bằng dòng lệnh:

```powershell
cd backend

# Xử lý video từ URL YouTube
uv run memoai process "https://www.youtube.com/watch?v=..." --asr gemini --mt gemini --mode learning

# Xử lý video file local trên máy
uv run memoai process "C:\path\to\video.mp4" --output-dir "D:\Subtitles"

# Xem danh sách các tham số hỗ trợ
uv run memoai --help
```

---

## ⚙️ Cấu hình AI Provider

Bạn có thể cấu hình AI trực tiếp trong giao diện ứng dụng (nút **"Cài đặt AI"** góc trên bên phải):

1. **Google Gemini**:
   * Đăng ký lấy API Key miễn phí tại [Google AI Studio](https://aistudio.google.com/).
   * Nhập API Key vào mục Cài đặt AI và chọn model (`gemini-2.5-flash` được khuyến nghị).
   * Bấm **"Thử kết nối"** để kiểm tra ping và độ trễ.
2. **Server nội bộ (Qwen 3.8 / Ollama / LM Studio)**:
   * Nếu dùng Ollama: Chạy `ollama run qwen2.5:latest`.
   * Trong MemoAI, thêm kết nối mới:
     * **Loại**: `OpenAI Compatible`
     * **Base URL**: `http://localhost:11434/v1` (hoặc IP máy chủ LAN)
     * **Model**: `qwen2.5:latest` hoặc model bạn đã triển khai.
     * Bấm **"Thử kết nối"**.

---

## 🤝 Đóng góp & Phát triển

Mọi ý kiến đóng góp, báo lỗi hoặc yêu cầu tính năng mới đều rất được hoan nghênh! Hãy mở một [Issue](https://github.com/DuyHuynhSC/MemoAI/issues) hoặc gửi [Pull Request](https://github.com/DuyHuynhSC/MemoAI/pulls).

---

## 📝 Giấy phép (License)

Dự án được phát hành theo giấy phép [MIT License](LICENSE).
