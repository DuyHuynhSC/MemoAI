import pytest
from memoai.languages.ja import JapaneseLanguagePack, contains_kanji, katakana_to_hiragana


def test_kanji_detection():
    assert contains_kanji("日本語") is True
    assert contains_kanji("にほんご") is False
    assert contains_kanji("Hello") is False


def test_katakana_to_hiragana():
    assert katakana_to_hiragana("ニホンゴ") == "にほんご"
    assert katakana_to_hiragana("ラーメン") == "らーめん"


def test_japanese_tokenize_and_furigana():
    pack = JapaneseLanguagePack()
    tokens = pack.tokenize("私は日本語を勉強しています。")
    assert len(tokens) > 0
    surfaces = [t.surface for t in tokens]
    assert "私" in surfaces
    assert "日本語" in surfaces or "日本" in surfaces

    # Test ruby HTML
    ruby = pack.to_ruby_html("日本語")
    assert "<ruby>" in ruby
    assert "<rt>" in ruby

    # Test romaji
    romaji = pack.romanize("こんにちは")
    assert "konnichiwa" in romaji.lower()
