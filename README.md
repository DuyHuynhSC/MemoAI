# MemoAI 🎬🇯🇵🇻🇳

Ứng dụng desktop tạo phụ đề song ngữ từ video và hỗ trợ học ngoại ngữ (Nhật - Việt) chuyên sâu:
- **Tạo phụ đề song ngữ**: Tự động nhận dạng giọng nói (ASR) bằng Google Gemini hoặc OpenAI-compatible / Whisper, dịch ngữ cảnh sang tiếng Việt.
- **Tương tác từ vựng (Click-to-lookup)**: Bấm trực tiếp vào bất kỳ từ tiếng Nhật nào trên phụ đề hoặc danh sách câu để xem cách đọc Hiragana, Romaji, cấp độ JLPT (N5–N1) và nghĩa tiếng Việt.
- **Furigana thông minh**: Hiển thị cách đọc ngay trên đầu chữ Hán (Kanji) bằng thẻ `<ruby>`.
- **Học tập chuyên sâu**: Chế độ lặp câu (A-B loop), chế độ Shadowing (tự dừng sau mỗi câu để người học luyện phát âm nhại lại).
- **Xuất thẻ Anki (.apkg)**: Lưu từ vựng yêu thích kèm câu ngữ cảnh và xuất thẳng ra file Anki để ôn tập ngắt quãng (SRS).

---

## 1. Cấu trúc dự án

```
MemoAI/
├── backend/                  # Python 3.12 (uv) + FastAPI + SQLite + Google GenAI + Japanese NLP
│   ├── memoai/
│   │   ├── api/server.py     # FastAPI Server (REST endpoints, Range video streaming, Anki export)
│   │   ├── services/         # Tra từ điển (dictionary.py) & xuất thẻ Anki (anki.py)
│   │   ├── providers/        # ASR (Gemini/OpenAI) & MT (Gemini/Qwen)
│   │   └── languages/        # Phân tích hình thái tiếng Nhật (fugashi + unidic-lite + pykakasi)
│   └── tests/                # Bộ kiểm thử tự động (pytest)
├── apps/
│   └── desktop/              # Ứng dụng Desktop: Tauri v2 + React 19 + TypeScript + TailwindCSS
│       ├── src/              # VideoPlayer, Subtitle Overlay, Transcript, WordPopup, Anki Modal
│       └── src-tauri/        # Cấu hình cửa sổ Desktop native (Rust + WebView2)
└── package.json              # Scripts khởi chạy nhanh
```

---

## 2. Hướng dẫn khởi chạy ứng dụng

### Bước 1: Khởi động Backend API Server

Mở một cửa sổ terminal:
```powershell
cd d:\SourceCode\MemoAI\backend
uv run memoai server
```
> Server sẽ khởi chạy tại: `http://127.0.0.1:8000`

---

### Bước 2: Khởi động giao diện Desktop

Mở một cửa sổ terminal thứ hai:

#### Cách A: Chạy cửa sổ Desktop Native (Tauri v2)
```powershell
cd d:\SourceCode\MemoAI\apps\desktop
npx tauri dev
```
*(Cửa sổ ứng dụng Desktop MemoAI độc lập sẽ xuất hiện)*.

#### Cách B: Chạy nhanh trên trình duyệt Web (dành cho phát triển)
```powershell
cd d:\SourceCode\MemoAI\apps\desktop
npm run dev
```
*(Mở trình duyệt tại `http://localhost:5173`)*.

---

## 3. Các tính năng nổi bật trong giao diện

1. **Thư viện video (Library)**:
   - Hiển thị danh sách các video đã xử lý kèm trạng thái tiến độ realtime.
   - Nút **"Thêm video mới"**: Hỗ trợ dán link YouTube (hoặc YouTube Shorts) hoặc đường dẫn file video/audio trên máy.

2. **Phòng học video (Video Learning Room)**:
   - **Phụ đề song ngữ 2 tầng**: Dòng 1 tiếng Nhật có Furigana, dòng 2 tiếng Việt dịch sát nghĩa.
   - **Tra từ tức thì**: Click chuột vào bất kỳ từ tiếng Nhật nào trên video hoặc bảng lời thoại bên phải ➔ Popup hiển thị Furigana, Romaji, từ loại, cấp độ JLPT (N5–N1) và nghĩa tiếng Việt.
   - **Lưu vào Anki**: Bấm nút "Lưu vào Sổ từ (Anki)" trên popup để ghi nhớ từ vựng kèm ngữ cảnh câu đang xem.
   - **Công cụ luyện phát âm**:
     - Nút **Lặp câu (A-B loop)**: Lặp đi lặp lại một câu thoại cho đến khi nghe rõ.
     - Nút **Shadowing**: Tự động tạm dừng video ở cuối mỗi câu để bạn đọc nhại theo.
     - Nút **Bật/Tắt từng lớp phụ đề**: Ẩn/hiện linh hoạt Furigana, Romaji, Tiếng Nhật, Tiếng Việt.

3. **Sổ từ vựng & Xuất Anki (.apkg)**:
   - Bấm nút **"Sổ từ vựng & Anki"** ở thanh điều hướng trên cùng.
   - Xem lại danh sách từ vựng đã tích luỹ.
   - Bấm nút **"Xuất thẻ Anki (.apkg)"** để tải ngay file flashcard được thiết kế sẵn kiểu chữ đẹp mắt về máy và import thẳng vào ứng dụng Anki.
