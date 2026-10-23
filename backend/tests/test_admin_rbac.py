import uuid
import pytest
from fastapi.testclient import TestClient
from memoai.api.server import app


def test_admin_rbac_and_user_management():
    client = TestClient(app)

    # 1. Admin logs in with default password
    admin_login = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    assert admin_login.status_code == 200, admin_login.text
    admin_token = admin_login.json()["access_token"]
    assert admin_login.json()["user"]["role"] == "admin"
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Register regular user (Dave)
    uid = uuid.uuid4().hex[:6]
    u_dave = f"dave_{uid}"
    dave_reg = client.post(
        "/api/auth/register",
        json={"username": u_dave, "password": "davepassword", "full_name": "Dave Developer"},
    )
    assert dave_reg.status_code == 200
    dave_id = dave_reg.json()["user"]["id"]
    dave_token = dave_reg.json()["access_token"]
    assert dave_reg.json()["user"]["role"] == "user"
    dave_headers = {"Authorization": f"Bearer {dave_token}"}

    # 3. Regular user tries to access admin endpoints -> 403 Forbidden
    res_forbidden_get = client.get("/api/admin/users", headers=dave_headers)
    assert res_forbidden_get.status_code == 403

    res_forbidden_patch = client.patch(
        f"/api/admin/users/{dave_id}",
        headers=dave_headers,
        json={"role": "admin"},
    )
    assert res_forbidden_patch.status_code == 403

    res_forbidden_del = client.delete(f"/api/admin/users/{dave_id}", headers=dave_headers)
    assert res_forbidden_del.status_code == 403

    # 4. Admin lists all users -> 200 OK
    users_list_res = client.get("/api/admin/users", headers=admin_headers)
    assert users_list_res.status_code == 200
    users_list = users_list_res.json()
    assert any(u["id"] == dave_id for u in users_list)

    # 5. Admin updates Dave's password and promotes Dave to admin
    patch_res = client.patch(
        f"/api/admin/users/{dave_id}",
        headers=admin_headers,
        json={"password": "newdavepassword123", "role": "admin", "full_name": "Dave Senior"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["role"] == "admin"
    assert patch_res.json()["full_name"] == "Dave Senior"

    # 6. Dave can now log in with the new password
    dave_relogin = client.post(
        "/api/auth/login",
        json={"username": u_dave, "password": "newdavepassword123"},
    )
    assert dave_relogin.status_code == 200
    assert dave_relogin.json()["user"]["role"] == "admin"

    # 7. Admin cannot delete themselves
    admin_id = admin_login.json()["user"]["id"]
    self_del = client.delete(f"/api/admin/users/{admin_id}", headers=admin_headers)
    assert self_del.status_code == 400

    # 8. Admin deletes Dave
    del_res = client.delete(f"/api/admin/users/{dave_id}", headers=admin_headers)
    assert del_res.status_code == 200
    assert del_res.json()["ok"] is True

    # 9. Dave can no longer log in
    dave_dead_login = client.post(
        "/api/auth/login",
        json={"username": u_dave, "password": "newdavepassword123"},
    )
    assert dave_dead_login.status_code == 400
