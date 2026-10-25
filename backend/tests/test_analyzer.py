import uuid
from fastapi.testclient import TestClient
from memoai.api.server import app


def test_user_jlpt_level_registration_and_update():
    client = TestClient(app)
    uid = uuid.uuid4().hex[:6]
    username = f"jlpt_user_{uid}"

    # 1. Register user with JLPT level N3
    reg_res = client.post(
        "/api/auth/register",
        json={
            "username": username,
            "password": "password123",
            "full_name": "JLPT Learner",
            "jlpt_level": "N3",
        },
    )
    assert reg_res.status_code == 200, reg_res.text
    reg_data = reg_res.json()
    assert reg_data["user"]["jlpt_level"] == "N3"
    token = reg_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Verify /api/auth/me returns N3
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["jlpt_level"] == "N3"

    # 3. Update JLPT level to N1 via PUT /api/auth/profile
    upd_res = client.put(
        "/api/auth/profile",
        headers=headers,
        json={"jlpt_level": "N1", "full_name": "Advanced Learner"},
    )
    assert upd_res.status_code == 200
    assert upd_res.json()["jlpt_level"] == "N1"
    assert upd_res.json()["full_name"] == "Advanced Learner"

    # 4. Reject invalid JLPT level
    bad_res = client.put(
        "/api/auth/profile",
        headers=headers,
        json={"jlpt_level": "N9"},
    )
    assert bad_res.status_code == 400


def test_llm_analysis_and_deduplication_per_user():
    client = TestClient(app)
    uid = uuid.uuid4().hex[:6]

    # Create two users: User A (N4) and User B (N2)
    res_a = client.post(
        "/api/auth/register",
        json={"username": f"user_a_{uid}", "password": "pw1234", "jlpt_level": "N4"},
    )
    headers_a = {"Authorization": f"Bearer {res_a.json()['access_token']}"}

    res_b = client.post(
        "/api/auth/register",
        json={"username": f"user_b_{uid}", "password": "pw1234", "jlpt_level": "N2"},
    )
    headers_b = {"Authorization": f"Bearer {res_b.json()['access_token']}"}

    sentence = "写真を撮ってもいいですか。"
    translation = "Tôi chụp ảnh có được không?"

    # 1. Pre-save one vocab ("写真") and one grammar ("〜てもいい") for User A
    v_res = client.post(
        "/api/vocab",
        headers=headers_a,
        json={
            "word": "写真",
            "reading": "しゃしん",
            "romanized": "shashin",
            "meaning": "Bức ảnh",
            "jlpt": "N5",
            "pos": "Danh từ",
        },
    )
    assert v_res.status_code == 200

    # Adding the exact same vocab again for User A should skip creating a duplicate
    v_dup = client.post(
        "/api/vocab",
        headers=headers_a,
        json={
            "word": "写真",
            "reading": "しゃしん",
            "meaning": "Bức ảnh (duplicate)",
        },
    )
    assert v_dup.status_code == 200
    assert v_dup.json()["id"] == v_res.json()["id"]

    g_res = client.post(
        "/api/grammar",
        headers=headers_a,
        json={
            "pattern": "〜てもいい",
            "meaning": "Được phép làm gì",
            "explanation": "V-て + もいい",
            "jlpt": "N5",
        },
    )
    assert g_res.status_code == 200

    # Adding duplicate grammar pattern (~ vs 〜) for User A should skip creating a duplicate
    g_dup = client.post(
        "/api/grammar",
        headers=headers_a,
        json={
            "pattern": "~てもいい",
            "meaning": "Được phép làm gì",
        },
    )
    assert g_dup.status_code == 200
    assert g_dup.json()["id"] == g_res.json()["id"]

    # 2. Batch save analysis items for User A (1 existing vocab + 1 new vocab, 1 existing grammar + 1 new grammar)
    batch_res = client.post(
        "/api/analysis/save-batch",
        headers=headers_a,
        json={
            "context_sentence": sentence,
            "context_translation": translation,
            "vocabs": [
                {"word": "写真", "reading": "しゃしん", "romanized": "shashin", "meaning": "Bức ảnh", "pos": "Danh từ", "jlpt": "N5"},
                {"word": "撮る", "reading": "とる", "romanized": "toru", "meaning": "Chụp (ảnh)", "pos": "Động từ", "jlpt": "N5"},
            ],
            "grammars": [
                {"pattern": "〜てもいい", "meaning": "Được phép làm gì", "explanation": "V-て + もいい", "jlpt": "N5"},
                {"pattern": "〜ですか", "meaning": "Câu hỏi lịch sự", "explanation": "Đặt ở cuối câu", "jlpt": "N5"},
            ],
        },
    )
    assert batch_res.status_code == 200
    stats = batch_res.json()
    assert stats["saved_vocabs"] == 1
    assert stats["skipped_vocabs"] == 1
    assert stats["saved_grammars"] == 1
    assert stats["skipped_grammars"] == 1

    # 3. Verify User A has 2 vocabs and 2 grammars, while User B has 0
    vocabs_a = client.get("/api/vocab", headers=headers_a).json()
    grammars_a = client.get("/api/grammar", headers=headers_a).json()
    assert len(vocabs_a) == 2
    assert len(grammars_a) == 2

    vocabs_b = client.get("/api/vocab", headers=headers_b).json()
    grammars_b = client.get("/api/grammar", headers=headers_b).json()
    assert len(vocabs_b) == 0
    assert len(grammars_b) == 0

    # 4. Call /api/analysis/segment for User A and verify is_saved flags
    analysis_res = client.post(
        "/api/analysis/segment",
        headers=headers_a,
        json={
            "sentence": sentence,
            "translation": translation,
        },
    )
    assert analysis_res.status_code == 200
    analysis_data = analysis_res.json()
    assert analysis_data["user_level"] == "N4"
    assert isinstance(analysis_data["vocabs"], list)
    assert isinstance(analysis_data["grammars"], list)

    # Check that "写真" is marked as is_saved=True for User A
    shashin_items = [v for v in analysis_data["vocabs"] if v["word"] == "写真"]
    if shashin_items:
        assert shashin_items[0]["is_saved"] is True

    # 5. Export Grammar Anki Deck for User A
    anki_res = client.get("/api/grammar/export/anki", headers=headers_a)
    assert anki_res.status_code == 200
    assert len(anki_res.content) > 100
