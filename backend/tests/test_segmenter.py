from memoai.providers.asr.base import Segment
from memoai.pipeline.segmenter import clean_repeated_hallucinations, normalize_segments


def test_clean_hallucinations():
    segments = [
        Segment(start=0.0, end=2.0, text="こんにちは"),
        Segment(start=2.0, end=4.0, text="ご視聴ありがとうございました"),
        Segment(start=4.0, end=6.0, text="ご視聴ありがとうございました"),
        Segment(start=6.0, end=8.0, text="ご視聴ありがとうございました"),
        Segment(start=8.0, end=10.0, text="ご視聴ありがとうございました"),
        Segment(start=10.0, end=12.0, text="次の動画でお会いしましょう"),
    ]
    cleaned = clean_repeated_hallucinations(segments)
    # Consecutive repetitions beyond 2 should be skipped
    repeated_texts = [s.text for s in cleaned if s.text == "ご視聴ありがとうございました"]
    assert len(repeated_texts) <= 2
    assert cleaned[-1].text == "次の動画でお会いしましょう"


def test_normalize_segments():
    segments = [
        Segment(start=0.0, end=2.0, text=" こんにちは "),
        Segment(start=2.0, end=4.0, text="さようなら"),
    ]
    norm = normalize_segments(segments)
    assert len(norm) == 2
    assert norm[0].id == 1
    assert norm[1].id == 2
