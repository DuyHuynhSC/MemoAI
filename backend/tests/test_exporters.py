from memoai.providers.asr.base import Segment
from memoai.exporters.srt import format_timestamp_srt, export_srt
from memoai.exporters.vtt import format_timestamp_vtt, export_vtt


def test_srt_timestamp_format():
    assert format_timestamp_srt(0.0) == "00:00:00,000"
    assert format_timestamp_srt(65.123) == "00:01:05,123"
    assert format_timestamp_srt(3661.050) == "01:01:01,050"


def test_vtt_timestamp_format():
    assert format_timestamp_vtt(0.0) == "00:00:00.000"
    assert format_timestamp_vtt(65.123) == "00:01:05.123"


def test_export_dual_srt():
    segments = [
        Segment(start=1.0, end=3.5, text="こんにちは"),
        Segment(start=4.0, end=6.0, text="元気ですか？"),
    ]
    translations = [
        "Xin chào",
        "Bạn khỏe không?",
    ]
    srt_out = export_srt(segments, translations, mode="dual")
    assert "1" in srt_out
    assert "00:00:01,000 --> 00:00:03,500" in srt_out
    assert "こんにちは\nXin chào" in srt_out
    assert "元気ですか？\nBạn khỏe không?" in srt_out
