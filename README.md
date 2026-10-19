# MemoAI 🎬🇯🇵🇻🇳

> **Ứng dụng Desktop thông minh hỗ trợ học tiếng Nhật qua video với phụ đề song ngữ AI, nhận dạng giọng nói Offline/Cloud, Furigana tương tác, tra từ điển tức thì và xuất thẻ Anki.**

[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue?style=flat-square)]()
[![Tauri](https://img.shields.io/badge/Tauri-v2-orange?style=flat-square&logo=tauri)]()
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)]()
[![Python](https://img.shields.io/badge/Python-3.12%2B%20(uv)-3776ab?style=flat-square&logo=python)]()
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?style=flat-square&logo=fastapi)]()
[![ASR](https://img.shields.io/badge/ASR-Faster--Whisper%20(Offline)%20%7C%20Gemini%20%7C%20OpenAI-blueviolet?style=flat-square)]()
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)]()

---

## 🌟 Tính năng nổi bật

### 1. 🎙️ Đa dạng hóa phương thức nhận dạng giọng nói (ASR)
* **Mô hình On-Device / Offline (Faster-Whisper)**:
  * Hoạt động **100% offline**, không cần kết nối Internet, không tốn chi phí API, bảo mật dữ liệu tuyệt đối.
  * Tự động nhận diện và tối ưu hóa theo phần cứng: Tăng tốc GPU NVIDIA CUDA (`float16`) hoặc CPU (`int8` đa luồng).
  * Tích hợp **Silero VAD (Voice Activity Detection)** lọc khoảng lặng và tạp âm, bóc tách **Word Timestamps** chính xác cho từng từ vựng.
  * Cơ chế **Auto-Fallback** thông minh: Tự động chuyển đổi an toàn từ GPU sang CPU nếu hệ thống thiếu driver hoặc thư viện cuDNN.
* **Google Gemini Cloud**: Hỗ trợ `gemini-2.5-flash`, `gemini-2.5-pro`... với cơ chế tự động thử lại khi quá tải (HTTP 503/429) và tự động fallback sang các model dự phòng.
* **Server nội bộ tương thích OpenAI**: Kết nối tới server local hoặc trong mạng LAN (Ollama, LM Studio, vLLM, Speaches, Whisper-compatible).

### 2. 📦 Trình quản lý & Tải mô hình Offline trực quan (Model Manager)
* **Kho mô hình phong phú**: Hỗ trợ tải nhanh các model Faster-Whisper tối ưu từ Hugging Face Hub:
  * `tiny` (~75 MB): Siêu nhẹ, tốc độ cao nhất, phù hợp máy cấu hình thấp.
  * `base` (~145 MB): Chuẩn cân bằng, khuyên dùng cho CPU phổ thông (8GB RAM).
  * `small` (~480 MB): Độ chính xác cao cho hội thoại thường nhật (16GB RAM).
  * `medium` (~1.5 GB): Độ chuẩn xác rất cao cho ngữ cảnh phức tạp.
  * `large-v3-turbo` (~1.6 GB): Bản tối ưu hóa mới nhất, tốc độ vượt trội cho video, phim ảnh.
  * `large-v3` (~3.1 GB): Phiên bản đầy đủ, nhận diện tốt trong môi trường nhiều tạp âm.
* **Chẩn đoán phần cứng tự động (Hardware Diagnostics)**: Phân tích số nhân CPU, dung lượng RAM khả dụng và GPU CUDA để đưa ra gợi ý mô hình phù hợp nhất cho thiết bị của bạn.
* **Tiến trình tải nền thời gian thực**: Hiển thị %, tốc độ tải (MB/s), thời gian còn lại (ETA), hỗ trợ hủy hoặc xóa mô hình để giải phóng dung lượng ổ cứng.
* **Thử nghiệm tức thì (Quick Test)**: Kiểm tra trực tiếp tốc độ nạp mô hình và thời gian suy luận (latency ms) ngay trên giao diện trước khi đưa vào sử dụng.

### 3. 🌐 Dịch song ngữ chuyên sâu cho học tập
* **2 Chế độ dịch linh hoạt**:
  * **Học tập (Learning)**: Dịch bám sát cấu trúc ngữ pháp và trật tự từ vựng, giúp người học hiểu rõ bản chất câu.
  * **Tự nhiên (Natural)**: Dịch thoát ý, văn phong trôi chảy tự nhiên như người bản xứ.
* Hỗ trợ model dịch mạnh mẽ: Google Gemini, Qwen 2.5/3.8, v.v.

### 4. ⚙️ Cài đặt kết nối AI trực tiếp trên giao diện (In-App Settings)
* Không cần chỉnh sửa file cấu hình `.env` thủ công.
* Quản lý đồng thời nhiều hồ sơ kết nối AI (AI Profiles): Thêm, sửa, xóa, chỉ định vai trò ASR hoặc MT.
* **Tab riêng "Mô hình Offline (ASR)"**: Quản lý tải xuống, xóa mô hình và tạo nhanh hồ sơ Offline chỉ với 1 click.
* **Thử kết nối (Live Ping Test)**: Kiểm tra trực tiếp tính hợp lệ của API Key / Server URL và hiển thị độ trễ mạng.

### 5. 🈸 Furigana thông minh & Phân tích hình thái tiếng Nhật
* Tích hợp **Fugashi (MeCab) + UniDic-Lite + PyKakasi** chạy hoàn toàn trên backend.
* Tự động hiển thị cách đọc Hiragana ngay trên đầu chữ Hán (Kanji) bằng thẻ `<ruby>` chuẩn xác.
* Hiển thị đồng thời phiên âm Romaji cho người mới bắt đầu.

### 6. 🔍 Tra từ điển tức thì (Click-to-lookup)
* Bấm trực tiếp vào bất kỳ từ tiếng Nhật nào trên video hoặc danh sách lời thoại để xem:
  * Cách đọc Kanji / Hiragana / Katakana / Romaji.
  * Cấp độ JLPT tương ứng (N5 -> N1).
  * Từ loại (Danh từ, Động từ, Tính từ,...).
  * Định nghĩa chi tiết bằng tiếng Việt.

### 7. 🔁 Công cụ luyện phát âm & Shadowing
* **Lặp câu (A-B Loop)**: Lặp đi lặp lại một câu thoại đang chọn để luyện nghe bắt âm.
* **Chế độ Shadowing**: Video tự động tạm dừng ở cuối mỗi câu thoại để bạn đọc nhại theo trước khi chuyển sang câu kế tiếp.
* **Tùy biến hiển thị phụ đề**: Ẩn/hiện linh hoạt Furigana, Romaji, tiếng Nhật, tiếng Việt theo trình độ của người học.

### 8. 🗂️ Sổ từ vựng & Xuất thẻ Anki (.apkg)
* Lưu nhanh các từ mới kèm câu ngữ cảnh vào **Sổ từ vựng**.
* Xuất file **Anki Deck (`.apkg`)** chuẩn hóa chỉ với 1 cú click chuột, có sẵn giao diện thẻ flashcard đẹp mắt để ôn tập ngắt quãng (SRS).

---

## 🏗️ Cấu trúc dự án

```
MemoAI/
├── backend/                  # Python 3.12 + FastAPI + SQLite + Faster-Whisper + Google GenAI + Japanese NLP
│   ├── memoai/
│   │   ├── api/server.py     # FastAPI REST Server: offline model APIs, project streaming, settings
│   │   ├── services/
│   │   │   ├── model_manager.py # Quản lý tải, hủy, xóa và kiểm tra mô hình offline (HuggingFace Hub)
│   │   │   ├── hardware.py      # Tự động chẩn đoán phần cứng (CPU, RAM, GPU CUDA) và gợi ý model
│   │   │   ├── dictionary.py    # Tra cứu từ điển tiếng Nhật - Việt
│   │   │   └── anki.py          # Đóng gói thẻ flashcard Anki (.apkg)
│   │   ├── providers/
│   │   │   ├── asr/             # FasterWhisperASR (Offline), GeminiASR (Cloud), OpenAICompatASR
│   │   │   └── mt/              # GeminiTranslator, OpenAICompatTranslator
│   │   ├── languages/        # Phân tích hình thái tiếng Nhật (fugashi + unidic-lite + pykakasi)
│   │   ├── models.py         # SQLModel database schema (Project, Segment, Vocab, AIProfile, AppSettings)
│   │   └── cli.py            # Giao diện dòng lệnh CLI hỗ trợ cả Online & Offline ASR
│   └── tests/                # Bộ kiểm thử tự động (pytest)
├── apps/
│   └── desktop/              # Ứng dụng Desktop: Tauri v2 + React 19 + TypeScript + TailwindCSS
│       ├── src/
│       │   ├── components/   # VideoPlayer, SubtitleOverlay, SettingsModal (Tab Offline ASR), CreateModal, AnkiModal
│       │   ├── api/client.ts # API Client kết nối với Backend REST API
│       │   └── types.ts      # TypeScript interfaces (HardwareInfo, OfflineModelItem, v.v.)
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

# Cài đặt toàn bộ dependencies (bao gồm gói hỗ trợ Offline Faster-Whisper)
uv sync --extra local-whisper

# Khởi chạy server
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

Bạn có thể xử lý video hoàn toàn bằng dòng lệnh mà không cần mở giao diện đồ họa:

```powershell
cd backend

# 1. Xử lý video hoàn toàn Offline bằng Faster-Whisper (ví dụ dùng model base)
uv run memoai run "C:\path\to\video.mp4" --asr faster_whisper --offline-model base --mt openai --mode learning

# 2. Xử lý video từ URL YouTube sử dụng Gemini Cloud
uv run memoai run "https://www.youtube.com/watch?v=..." --asr gemini --mt gemini --mode learning

# 3. Xuất phụ đề ra thư mục tùy chọn
uv run memoai run "C:\path\to\video.mp4" --output-dir "D:\Subtitles"

# Xem toàn bộ danh sách các tham số hỗ trợ
uv run memoai run --help
```

---

## ⚙️ Hướng dẫn Cấu hình Nhận dạng & Dịch thuật

Bạn có thể thiết lập trực tiếp trong giao diện ứng dụng (nút **"Cài đặt AI"** góc trên bên phải):

### 1. Sử dụng Mô hình Offline (Faster-Whisper)
1. Mở **Cài đặt** ➔ chọn tab **"Mô hình Offline (ASR)"**.
2. Xem mục **Chẩn đoán phần cứng** để biết mô hình được đề xuất cho máy bạn (ví dụ: `base` hoặc `small`).
3. Bấm **"Tải về"** tại mô hình bạn muốn sử dụng và theo dõi thanh tiến độ.
4. Khi tải xong, bấm **"Thử nghiệm"** để kiểm tra tốc độ nạp mô hình và thời gian phản hồi.
5. Khi tạo dự án mới, chọn hồ sơ **"Faster-Whisper Offline"** để nhận dạng giọng nói mà không cần Internet.

### 2. Sử dụng Google Gemini Cloud
1. Đăng ký lấy API Key miễn phí tại [Google AI Studio](https://aistudio.google.com/).
2. Nhập API Key vào mục Cài đặt AI và chọn model (`gemini-2.5-flash` được khuyến nghị).
3. Bấm **"Thử kết nối"** để kiểm tra ping và độ trễ.

### 3. Sử dụng Server nội bộ (Qwen / Ollama / LM Studio)
1. Nếu dùng Ollama: Chạy lệnh `ollama run qwen2.5:latest`.
2. Trong MemoAI, thêm hồ sơ kết nối mới:
   * **Loại**: `OpenAI Compatible`
   * **Base URL**: `http://localhost:11434/v1` (hoặc IP máy chủ trong mạng LAN).
   * **Model**: `qwen2.5:latest` (hoặc model bạn đã cài đặt).
   * Bấm **"Thử kết nối"**.

---

## 🤝 Đóng góp & Phát triển

Mọi ý kiến đóng góp, báo lỗi hoặc yêu cầu tính năng mới đều rất được hoan nghênh! Hãy mở một [Issue](https://github.com/DuyHuynhSC/MemoAI/issues) hoặc gửi [Pull Request](https://github.com/DuyHuynhSC/MemoAI/pulls).

---

## 📝 Giấy phép (License)

Dự án được phát hành theo giấy phép [MIT License](LICENSE).
