# MemoAI 🎬🇯🇵🇻🇳

Ứng dụng tạo phụ đề song ngữ từ video và hỗ trợ học ngoại ngữ (Nhật - Việt).

## 1. Cấu trúc dự án

- `backend/`: Lõi xử lý media, ASR, dịch thuật (MT) và phân tích ngôn ngữ (Furigana, Romaji, JLPT).
- `apps/desktop/`: Giao diện Desktop (Tauri v2 + React, sẽ triển khai ở Giai đoạn 3).

## 2. Thiết lập nhanh

### Yêu cầu hệ thống:
- Python 3.12+ (đã tích hợp thông qua `uv`)
- ffmpeg & yt-dlp (đã cài đặt trên máy)

### Cấu hình API:
Tạo file `.env` trong thư mục `backend/` dựa trên `.env.example`:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_BASE_URL=http://localhost:11434/v1 # hoặc IP server Qwen nội bộ
OPENAI_MT_MODEL=qwen2.5:latest            # hoặc qwen3.8
```

## 3. Sử dụng công cụ dòng lệnh (CLI)

Di chuyển vào thư mục `backend`:
```bash
cd backend
```

### A. Kiểm tra kết nối tới Server Qwen nội bộ:
```bash
uv run memoai test-server --base-url http://<ip_server>:8000/v1 --model <ten_model>
```

### B. Tạo phụ đề song ngữ từ video hoặc URL YouTube:

#### Cách 1: Dùng Gemini cho ASR (nhận dạng giọng nói) + Qwen nội bộ để dịch:
```bash
uv run memoai run "https://www.youtube.com/watch?v=XXXXX" --asr gemini --mt openai --openai-base-url http://<ip_server>:8000/v1 --openai-model <ten_model>
```

#### Cách 2: Dùng hoàn toàn Gemini (cả ASR lẫn Dịch):
```bash
uv run memoai run "D:\Videos\sample.mp4" --asr gemini --mt gemini --gemini-key <key>
```

### File kết quả tạo ra:
- `<tên_file>.ja.srt`: Phụ đề tiếng Nhật gốc
- `<tên_file>.vi.srt`: Phụ đề tiếng Việt
- `<tên_file>.dual.srt`: Phụ đề song ngữ hiển thị 2 dòng
- `<tên_file>.dual.vtt`: Phụ đề chuẩn WebVTT
