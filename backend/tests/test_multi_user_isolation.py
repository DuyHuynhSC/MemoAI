import uuid
import pytest
from fastapi.testclient import TestClient
from memoai.api.server import app


def test_auth_registration_and_login():
    client = TestClient(app)
    uid = uuid.uuid4().hex[:6]
    u_alice = f"alice_{uid}"

    # 1. Register User Alice
    res = client.post(
        "/api/auth/register",
        json={
            "username": u_alice,
            "password": "alicepassword",
            "full_name": "Alice Wonderland",
            "gemini_api_key": "AIzaSyAliceCustomKey123",
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert "access_token" in data
    assert data["user"]["username"] == u_alice
    alice_token = data["access_token"]

    # 2. Register Duplicate Username should fail
    dup_res = client.post(
        "/api/auth/register",
        json={
            "username": u_alice,
            "password": "anotherpassword",
        },
    )
    assert dup_res.status_code == 400

    # 3. Login with Alice
    login_res = client.post(
        "/api/auth/login",
        json={"username": u_alice, "password": "alicepassword"},
    )
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()

    # 4. Login with Wrong Password
    wrong_res = client.post(
        "/api/auth/login",
        json={"username": u_alice, "password": "wrongpassword"},
    )
    assert wrong_res.status_code == 400

    # 5. Access /api/auth/me with Bearer token
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {alice_token}"})
    assert me_res.status_code == 200
    assert me_res.json()["username"] == u_alice


def test_multi_user_project_and_api_key_isolation(monkeypatch):
    # Mock background pipeline task
    monkeypatch.setattr("memoai.api.server.run_pipeline_task", lambda pid, req: None)

    client = TestClient(app)
    uid = uuid.uuid4().hex[:6]
    u_bob = f"bob_{uid}"
    u_charlie = f"charlie_{uid}"

    # 1. Register User 1 (Bob)
    res_bob = client.post(
        "/api/auth/register",
        json={
            "username": u_bob,
            "password": "bobpassword",
            "full_name": "Bob Builder",
            "gemini_api_key": f"AIzaSyBob_{uid}",
        },
    )
    assert res_bob.status_code == 200, res_bob.text
    bob_token = res_bob.json()["access_token"]
    bob_headers = {"Authorization": f"Bearer {bob_token}"}

    # 2. Register User 2 (Charlie)
    res_charlie = client.post(
        "/api/auth/register",
        json={
            "username": u_charlie,
            "password": "charliepassword",
            "full_name": "Charlie Chaplin",
            "gemini_api_key": f"AIzaSyCharlie_{uid}",
        },
    )
    assert res_charlie.status_code == 200, res_charlie.text
    charlie_token = res_charlie.json()["access_token"]
    charlie_headers = {"Authorization": f"Bearer {charlie_token}"}

    # 3. Check AI Profiles isolation:
    # Bob should see Bob's Gemini key, NOT Charlie's key
    bob_settings = client.get("/api/settings", headers=bob_headers).json()
    bob_profile_keys = [p["api_key"] for p in bob_settings["profiles"] if p.get("api_key")]
    assert f"AIzaSyBob_{uid}" in bob_profile_keys
    assert f"AIzaSyCharlie_{uid}" not in bob_profile_keys

    # Charlie should see Charlie's key, NOT Bob's key
    charlie_settings = client.get("/api/settings", headers=charlie_headers).json()
    charlie_profile_keys = [p["api_key"] for p in charlie_settings["profiles"] if p.get("api_key")]
    assert f"AIzaSyCharlie_{uid}" in charlie_profile_keys
    assert f"AIzaSyBob_{uid}" not in charlie_profile_keys

    # 4. Bob creates a project
    p_res = client.post(
        "/api/projects",
        headers=bob_headers,
        json={"url_or_path": "https://www.youtube.com/watch?v=bob_video", "title": "Bob's Japanese Lesson"},
    )
    assert p_res.status_code == 200
    bob_proj_id = p_res.json()["id"]

    # 5. Charlie lists projects -> should be empty (or not contain Bob's project)
    charlie_projs = client.get("/api/projects", headers=charlie_headers).json()
    charlie_proj_ids = [p["id"] for p in charlie_projs]
    assert bob_proj_id not in charlie_proj_ids

    # 6. Charlie tries to directly get Bob's project -> 403 Forbidden
    charlie_get = client.get(f"/api/projects/{bob_proj_id}", headers=charlie_headers)
    assert charlie_get.status_code == 403

    # 7. Charlie tries to delete Bob's project -> 403 Forbidden
    charlie_del = client.delete(f"/api/projects/{bob_proj_id}", headers=charlie_headers)
    assert charlie_del.status_code == 403

    # 8. Bob can get his own project -> 200 OK
    bob_get = client.get(f"/api/projects/{bob_proj_id}", headers=bob_headers)
    assert bob_get.status_code == 200
    assert bob_get.json()["project"]["title"] == "Bob's Japanese Lesson"

    # 9. Test Vocab isolation: Bob adds vocab, Charlie cannot see it
    v_res = client.post(
        "/api/vocab",
        headers=bob_headers,
        json={"word": "先生", "meaning": "Thầy cô giáo", "reading": "せんせい"},
    )
    assert v_res.status_code == 200
    bob_vocab_id = v_res.json()["id"]

    bob_vocabs = client.get("/api/vocab", headers=bob_headers).json()
    assert any(v["id"] == bob_vocab_id for v in bob_vocabs)

    charlie_vocabs = client.get("/api/vocab", headers=charlie_headers).json()
    assert not any(v["id"] == bob_vocab_id for v in charlie_vocabs)

    # Charlie cannot delete Bob's vocab -> 403 Forbidden
    charlie_del_vocab = client.delete(f"/api/vocab/{bob_vocab_id}", headers=charlie_headers)
    assert charlie_del_vocab.status_code == 403
