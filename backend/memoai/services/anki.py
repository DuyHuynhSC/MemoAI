import random
from pathlib import Path
import genanki
from memoai.models import Vocab

# Distinct Model ID and Deck ID
MEMOAI_MODEL_ID = 1607392319
MEMOAI_DECK_ID = 2059400110

CARD_CSS = """
.card {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 20px;
  text-align: center;
  color: #1e293b;
  background-color: #f8fafc;
  padding: 24px;
}
.word {
  font-size: 42px;
  font-weight: bold;
  color: #0f172a;
  margin-bottom: 8px;
}
.reading {
  font-size: 24px;
  color: #64748b;
  margin-bottom: 16px;
}
.jlpt {
  display: inline-block;
  font-size: 14px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 9999px;
  background-color: #e0e7ff;
  color: #4338ca;
  margin-bottom: 20px;
}
.meaning {
  font-size: 26px;
  font-weight: 600;
  color: #047857;
  margin-top: 16px;
}
.sentence {
  font-size: 20px;
  color: #334155;
  background: #ffffff;
  padding: 14px 18px;
  border-radius: 12px;
  margin-top: 20px;
  border-left: 4px solid #3b82f6;
  text-align: left;
}
.trans {
  font-size: 18px;
  color: #64748b;
  margin-top: 8px;
}
"""

memoai_card_model = genanki.Model(
    MEMOAI_MODEL_ID,
    "MemoAI Japanese Flashcard",
    fields=[
        {"name": "Word"},
        {"name": "Reading"},
        {"name": "Romanized"},
        {"name": "Meaning"},
        {"name": "ContextSentence"},
        {"name": "ContextTranslation"},
        {"name": "JLPT"},
    ],
    templates=[
        {
            "name": "Recognition",
            "qfmt": """
<div class="word">{{Word}}</div>
{{#Reading}}<div class="reading">{{Reading}}</div>{{/Reading}}
{{#JLPT}}<div class="jlpt">{{JLPT}}</div>{{/JLPT}}
{{#ContextSentence}}<div class="sentence">{{ContextSentence}}</div>{{/ContextSentence}}
""",
            "afmt": """
{{FrontSide}}
<hr id="answer">
<div class="meaning">{{Meaning}}</div>
{{#Romanized}}<div class="reading">{{Romanized}}</div>{{/Romanized}}
{{#ContextTranslation}}<div class="sentence trans">{{ContextTranslation}}</div>{{/ContextTranslation}}
""",
        },
    ],
    css=CARD_CSS,
)


def export_anki_deck(vocabs: list[Vocab], deck_name: str = "MemoAI::TiengNhat", output_path: Path | None = None) -> Path:
    """Export a list of Vocab objects to an Anki .apkg file."""
    deck = genanki.Deck(MEMOAI_DECK_ID, deck_name)

    for v in vocabs:
        note = genanki.Note(
            model=memoai_card_model,
            fields=[
                v.word,
                v.reading or "",
                v.romanized or "",
                v.meaning or "",
                v.context_sentence or "",
                v.context_translation or "",
                v.jlpt or "",
            ],
        )
        deck.add_note(note)

    if output_path is None:
        output_path = Path("memoai_deck.apkg")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    genanki.Package(deck).write_to_file(str(output_path))
    return output_path
