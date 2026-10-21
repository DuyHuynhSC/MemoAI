# MemoAI 🎬🇯🇵🇻🇳

> **Ứng dụng Đa nền tảng (Desktop & Android) thông minh hỗ trợ học tiếng Nhật qua video với phụ đề song ngữ AI, nhận dạng giọng nói Offline/Cloud, Furigana tương tác, tra từ điển tức thì và xuất thẻ Anki.**

[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Android-blue?style=flat-square)]()
[![Android](https://img.shields.io/badge/Android-APK%20Available-green?style=flat-square&logo=android)]()
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

### 6. 🔍 Tra từ điển tức thì (Click-to-lookup & Bottom Sheet)
* Bấm trực tiếp vào bất kỳ từ tiếng Nhật nào trên video hoặc danh sách lời thoại để xem:
  * Cách đọc Kanji / Hiragana / Katakana / Romaji.
  * Cấp độ JLPT tương ứng (N5 -> N1).
  * Từ loại (Danh từ, Động từ, Tính từ,...).
  * Định nghĩa chi tiết bằng tiếng Việt.
  * Phát âm chuẩn âm thanh tức thì.

### 7. 🔁 Công cụ luyện phát âm & Shadowing
* **Lặp câu (A-B Loop)**: Lặp đi lặp lại một câu thoại đang chọn để luyện nghe bắt âm.
* **Chế độ Shadowing**: Video tự động tạm dừng ở cuối mỗi câu thoại để bạn đọc nhại theo trước khi chuyển sang câu kế tiếp.
* **Tùy biến hiển thị phụ đề**: Ẩn/hiện linh hoạt Furigana, Romaji, tiếng Nhật, tiếng Việt theo trình độ của người học.
* **Tùy chỉnh cỡ chữ trực quan**: Tăng giảm kích thước chữ tiếng Nhật & tiếng Việt độc lập ngay trên trình phát video.

### 8. 🗂️ Sổ từ vựng & Xuất thẻ Anki (.apkg)
* Lưu nhanh các từ mới kèm câu ngữ cảnh vào **Sổ từ vựng**.
* Xuất file **Anki Deck (`.apkg`)** chuẩn hóa chỉ với 1 cú click chuột, có sẵn giao diện thẻ flashcard đẹp mắt để ôn tập ngắt quãng (SRS).

### 9. 📱 Trải nghiệm Di động tối ưu (Android Native & Touch-First)
* **Cử chỉ chạm đúp tua nhanh (Double-tap to Seek)**: Chạm đúp 2 lần bên trái để tua lùi 5s (`⏪ -5s`), chạm đúp bên phải để tua tới 5s (`+5s ⏩`) có hiệu ứng huy hiệu thời gian nổi tương tự YouTube.
* **Tra từ vựng dạng Bottom Sheet**: Cửa sổ giải nghĩa từ điển trượt mượt mà từ đáy màn hình, không che khuất video, hỗ trợ thao tác một tay với nút phát âm và lưu Anki lớn.
* **Chọn & Tải video trực tiếp từ điện thoại**: Chọn bất kỳ video nào (`.mp4`, `.mkv`, `.webm`, `.mov`) từ bộ nhớ điện thoại để tự động tải lên server xử lý phụ đề song ngữ.
* **Thanh điều hướng tiện lợi (Mobile Bottom Navigation)**: Chuyển đổi nhanh giữa Thư viện, Sổ từ, Thêm bài học, Cài đặt máy chủ IP và Cài đặt AI chỉ bằng ngón tay cái.
* **Chế độ Toàn màn hình xoay ngang (Landscape Fullscreen)**: Xem video tràn màn hình với phụ đề song ngữ rõ nét, thanh bật/tắt phụ đề cuộn ngang linh hoạt.
* **Kết nối Server linh hoạt**: Hộp thoại cấu hình IP máy chủ (Backend URL) có sẵn nút chọn nhanh máy ảo Android (`10.0.2.2`) và kiểm tra độ trễ mạng (Live Ping).

---

## 🏗️ Cấu trúc dự án

```
MemoAI/
├── backend/                  # Python 3.12 + FastAPI + SQLite + Faster-Whisper + Google GenAI + Japanese NLP
│   ├── memoai/
│   │   ├── api/server.py     # FastAPI Server: REST APIs, video upload stream, offline models, settings
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
│   └── desktop/              # Ứng dụng Desktop & Mobile: Tauri v2 + React 19 + TypeScript + TailwindCSS
│       ├── src/
│       │   ├── components/   # VideoPlayer (Touch), WordPopup (Bottom Sheet), ServerAddressModal, TranscriptList, CreateModal
│       │   ├── api/client.ts # API Client hỗ trợ cấu hình động IP máy chủ & Upload media
│       │   └── types.ts      # TypeScript interfaces (HardwareInfo, OfflineModelItem, v.v.)
│       └── src-tauri/        # Cấu hình Native (Rust + WebView2 + Android NDK)
│           └── gen/android/  # Mã nguồn Native Android Studio (Gradle, Kotlin, JNI libs)
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
5. *(Tùy chọn cho Android Mobile)*:
   * **Android SDK** (API level 24+) & **Android NDK** (khuyên dùng NDK r27: `27.0.12077973`).
   * **JDK**: OpenJDK phiên bản 17 đến 25 (tương thích Gradle 9.6).
   * Cài đặt Rust targets cho Android:
     ```bash
     rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
     ```

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

> [!TIP]
> **Khắc phục lỗi chứng chỉ SSL khi dùng mạng Proxy công ty / Antivirus:**
> Nếu gặp lỗi `invalid peer certificate: UnknownIssuer` (do Proxy công ty như Zscaler/Fortinet can thiệp giải mã SSL), bạn hãy thêm cờ `--allow-insecure-host` khi sync:
> ```powershell
> uv sync --extra local-whisper --allow-insecure-host pypi.org --allow-insecure-host files.pythonhosted.org
> ```
> *Hoặc thêm cấu hình cố định vào cuối file `backend/pyproject.toml` để không cần gõ lại cờ mỗi lần:*
> ```toml
> [tool.uv]
> allow-insecure-host = [
>     "pypi.org",
>     "files.pythonhosted.org",
> ]
> ```

---

### Bước 3: Khởi động Giao diện Desktop & Web

Mở một cửa sổ terminal mới từ thư mục gốc của dự án:

#### 👉 Cách A: Chạy cửa sổ Desktop Native (Tauri v2)
```powershell
npm run desktop:app
# hoặc: cd apps/desktop && npx tauri dev
```
*(Cửa sổ ứng dụng Desktop native sẽ tự động mở lên)*

#### 👉 Cách B: Chạy nhanh trên Trình duyệt Web (Phát triển / Preview)
```powershell
npm run desktop:web
# hoặc: cd apps/desktop && npm run dev
```
*(Mở trình duyệt tại: `http://localhost:5173`)*

---

### Bước 4: Khởi động Ứng dụng Android (Tauri v2 Mobile)

Ứng dụng Android chạy chung mã nguồn React 19 với bản Desktop, được tối ưu hóa giao diện cảm ứng và kết nối trực tiếp tới Backend qua mạng nội bộ hoặc máy ảo.

#### 👉 Cách A: Chạy trực tiếp trên Điện thoại thật hoặc Máy ảo Android (Live Reload)
1. Bật tính năng **USB Debugging** trên điện thoại Android và cắm cáp vào PC (hoặc khởi chạy Android Virtual Device / Emulator trong Android Studio).
2. Chạy lệnh:
   ```powershell
   npm run android:dev
   # hoặc: cd apps/desktop && npx tauri android dev
   ```
*(Ứng dụng sẽ tự động được biên dịch, cài đặt và mở lên trên màn hình điện thoại với tính năng Hot-Reload)*

#### 👉 Cách B: Đóng gói file cài đặt APK độc lập
```powershell
npm run android:build
# hoặc: cd apps/desktop && npx tauri android build --debug --apk --target aarch64
```
> File cài đặt `.apk` sẽ được tạo tại:
> `apps/desktop/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`
> Bạn có thể copy trực tiếp file này sang điện thoại Android để cài đặt.

#### 🌐 Kết nối App Android tới Backend trên Máy tính:
1. Đảm bảo điện thoại và máy tính kết nối chung mạng Wi-Fi (hoặc chạy máy ảo trên cùng máy).
2. Mở app MemoAI trên điện thoại, bấm vào biểu tượng **"Máy chủ"** trên thanh điều hướng dưới đáy màn hình:
   * **Nếu dùng máy ảo Android**: Bấm chọn nút gợi ý **`10.0.2.2 (Máy ảo Android)`**.
   * **Nếu dùng điện thoại thật**: Nhập địa chỉ IPv4 của máy tính (ví dụ: `http://192.168.1.15:8000`).
3. Bấm **"Kiểm tra kết nối"** (Ping) ➔ Khi thấy thông báo thành công, chọn **"Lưu địa chỉ"**. Toàn bộ thư viện bài học và tính năng phân tích video sẽ được đồng bộ ngay lập tức!

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

Bạn có thể thiết lập trực tiếp trong giao diện ứng dụng (nút **"Cài đặt AI"** góc trên bên phải hoặc trên thanh điều hướng di động):

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
