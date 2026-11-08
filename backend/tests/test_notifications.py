import pytest
from httpx import ASGITransport, AsyncClient

from backend.domain.entities.app_notification import AppNotification
from backend.domain.entities.user import Role, User
from backend.infrastructure.persistence.sqlite_job_repository import SQLiteJobRepository
from backend.main import app
from backend.presentation.dependencies import get_current_user, get_job_repository


@pytest.fixture
def mock_admin_user() -> User:
    return User(
        id=1,
        email="admin@hub.local",
        password_hash="hashed_secret",
        role=Role.ADMIN,
        tenant_id="default",
    )


class TestNotificationsPersistence:
    @pytest.mark.asyncio
    async def test_notification_lifecycle_sqlite(self):
        repo = SQLiteJobRepository(db_path=":memory:")
        await repo.initialize_schema()

        # Initially 0 unread
        assert await repo.get_unread_notifications_count(tenant_id="default") == 0

        # Save notification
        n1 = AppNotification.create(
            title="Canal Expulsado",
            message="La cuenta fue expulsada de Grupo VIP",
            severity="ERROR",
            tenant_id="default",
            link="/sync",
        )
        saved = await repo.save_notification(n1)
        assert saved.id == n1.id

        # Verify unread count is 1
        assert await repo.get_unread_notifications_count(tenant_id="default") == 1

        # Save second notification
        n2 = AppNotification.create(
            title="Video Sanitizado",
            message="Video #123 procesado exitosamente",
            severity="SUCCESS",
            tenant_id="default",
            link="/migration",
        )
        await repo.save_notification(n2)
        assert await repo.get_unread_notifications_count(tenant_id="default") == 2

        # List all
        all_notifs = await repo.list_notifications(tenant_id="default")
        assert len(all_notifs) == 2
        assert all_notifs[0].title == "Video Sanitizado"  # Latest first

        # Mark first as read
        ok = await repo.mark_notification_as_read(n2.id, tenant_id="default")
        assert ok
        assert await repo.get_unread_notifications_count(tenant_id="default") == 1

        # List unread only
        unread_only = await repo.list_notifications(tenant_id="default", unread_only=True)
        assert len(unread_only) == 1
        assert unread_only[0].id == n1.id

        # Mark all as read
        marked_count = await repo.mark_all_notifications_as_read(tenant_id="default")
        assert marked_count == 1
        assert await repo.get_unread_notifications_count(tenant_id="default") == 0


class TestNotificationsApi:
    @pytest.mark.asyncio
    async def test_notifications_endpoints(self, mock_admin_user):
        repo = SQLiteJobRepository(db_path=":memory:")
        await repo.initialize_schema()

        app.dependency_overrides[get_current_user] = lambda: mock_admin_user
        app.dependency_overrides[get_job_repository] = lambda: repo

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                # 1. Unread count initially 0
                res = await client.get("/api/notifications/unread-count")
                assert res.status_code == 200
                assert res.json()["unread_count"] == 0

                # 2. Create notification via POST
                create_res = await client.post(
                    "/api/notifications",
                    json={
                        "title": "Alerta FloodWait",
                        "message": "FloodWait de 45 segundos detectado.",
                        "severity": "WARNING",
                        "link": "/channels",
                    },
                )
                assert create_res.status_code == 201
                notif_data = create_res.json()
                notif_id = notif_data["id"]
                assert notif_data["severity"] == "WARNING"
                assert not notif_data["is_read"]

                # 3. Unread count is now 1
                res_count = await client.get("/api/notifications/unread-count")
                assert res_count.json()["unread_count"] == 1

                # 4. List notifications
                list_res = await client.get("/api/notifications")
                assert list_res.status_code == 200
                items = list_res.json()
                assert len(items) == 1
                assert items[0]["id"] == notif_id

                # 5. Mark as read
                patch_res = await client.patch(f"/api/notifications/{notif_id}/read")
                assert patch_res.status_code == 200
                assert patch_res.json()["status"] == "SUCCESS"

                # 6. Unread count returns to 0
                res_count_after = await client.get("/api/notifications/unread-count")
                assert res_count_after.json()["unread_count"] == 0

                # 7. Create another and test read-all
                await client.post(
                    "/api/notifications",
                    json={"title": "Test 2", "message": "Msg", "severity": "INFO"},
                )
                read_all_res = await client.post("/api/notifications/read-all")
                assert read_all_res.status_code == 200
                assert read_all_res.json()["marked_read_count"] == 1

        finally:
            app.dependency_overrides.clear()
