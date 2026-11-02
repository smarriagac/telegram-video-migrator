from __future__ import annotations

from datetime import datetime, timedelta, timezone
import pytest
from unittest.mock import AsyncMock, MagicMock

from backend.domain.entities.channel_membership import ChannelMembership, MembershipStatus
from backend.application.services.membership_gatekeeper_service import MembershipGatekeeperService


def test_channel_membership_expiration_logic():
    now = datetime.now(timezone.utc)
    future = (now + timedelta(days=5)).isoformat()
    past = (now - timedelta(hours=2)).isoformat()

    active_valid = ChannelMembership(
        tenant_id="t-1",
        channel_id=-100123,
        telegram_user_id=999,
        status=MembershipStatus.ACTIVE,
        expires_at=future,
    )
    assert active_valid.is_expired(now) is False
    assert active_valid.needs_kick(now) is False

    active_expired = ChannelMembership(
        tenant_id="t-1",
        channel_id=-100123,
        telegram_user_id=999,
        status=MembershipStatus.ACTIVE,
        expires_at=past,
    )
    assert active_expired.is_expired(now) is True
    assert active_expired.needs_kick(now) is True

    # User invited but never joined -> needs_kick is False
    invited_unjoined = ChannelMembership(
        tenant_id="t-1",
        channel_id=-100123,
        telegram_user_id=None,
        status=MembershipStatus.INVITED,
        expires_at=past,
    )
    assert invited_unjoined.needs_kick(now) is False

    # Already kicked -> needs_kick is False
    already_kicked = ChannelMembership(
        tenant_id="t-1",
        channel_id=-100123,
        telegram_user_id=999,
        status=MembershipStatus.KICKED,
        expires_at=past,
    )
    assert already_kicked.needs_kick(now) is False


@pytest.mark.asyncio
async def test_gatekeeper_evicts_expired_members_only():
    mock_gateway = MagicMock()
    mock_gateway.kick_chat_member = AsyncMock(return_value=True)
    gatekeeper = MembershipGatekeeperService(telegram_gateway=mock_gateway)

    now = datetime.now(timezone.utc)
    past = (now - timedelta(days=1)).isoformat()
    future = (now + timedelta(days=10)).isoformat()

    valid_member = ChannelMembership(
        tenant_id="t-1",
        channel_id=-100111,
        telegram_user_id=101,
        status=MembershipStatus.ACTIVE,
        expires_at=future,
    )
    expired_member = ChannelMembership(
        tenant_id="t-1",
        channel_id=-100111,
        telegram_user_id=102,
        status=MembershipStatus.ACTIVE,
        expires_at=past,
    )

    evicted = await gatekeeper.evaluate_and_evict_expired(
        memberships=[valid_member, expired_member],
        current_time=now,
    )

    assert len(evicted) == 1
    assert evicted[0].telegram_user_id == 102
    assert expired_member.status == MembershipStatus.KICKED

    # Ensure gateway only kicked the expired user
    mock_gateway.kick_chat_member.assert_awaited_once_with(
        channel_id=-100111,
        user_id=102,
    )


@pytest.mark.asyncio
async def test_gatekeeper_generates_single_use_pass():
    mock_gateway = MagicMock()
    mock_gateway.create_channel_invite_link = AsyncMock(return_value="https://t.me/+AbCdEfGhIjK")
    gatekeeper = MembershipGatekeeperService(telegram_gateway=mock_gateway)

    pass_obj = await gatekeeper.generate_pass(
        tenant_id="tenant-pro",
        channel_id=-100999,
        duration_days=30,
    )

    assert pass_obj.tenant_id == "tenant-pro"
    assert pass_obj.channel_id == -100999
    assert pass_obj.invite_link == "https://t.me/+AbCdEfGhIjK"
    assert pass_obj.status == MembershipStatus.INVITED
    assert pass_obj.expires_at is not None
    mock_gateway.create_channel_invite_link.assert_awaited_once()


@pytest.mark.asyncio
async def test_gateway_send_direct_message_signature():
    mock_gateway = MagicMock()
    mock_gateway.send_direct_message = AsyncMock(return_value=True)

    sent = await mock_gateway.send_direct_message(
        recipient="@Smpyt",
        text="Tu enlace VIP: https://t.me/+AbCdEfGhIjK",
    )
    assert sent is True
    mock_gateway.send_direct_message.assert_awaited_once_with(
        recipient="@Smpyt",
        text="Tu enlace VIP: https://t.me/+AbCdEfGhIjK",
    )


@pytest.mark.asyncio
async def test_gateway_get_and_hide_join_request():
    mock_gateway = MagicMock()
    mock_gateway.get_join_requests = AsyncMock(
        return_value=[
            {
                "channel_id": -1004337257363,
                "user_id": 123456,
                "first_name": "Test",
                "last_name": "User",
                "username": "testuser",
                "date": "2026-11-02T13:00:00Z",
            }
        ]
    )
    mock_gateway.hide_join_request = AsyncMock(return_value=True)

    requests = await mock_gateway.get_join_requests(-1004337257363)
    assert len(requests) == 1
    assert requests[0]["user_id"] == 123456

    approved = await mock_gateway.hide_join_request(-1004337257363, 123456, approved=True)
    assert approved is True
    mock_gateway.hide_join_request.assert_awaited_once_with(-1004337257363, 123456, approved=True)
