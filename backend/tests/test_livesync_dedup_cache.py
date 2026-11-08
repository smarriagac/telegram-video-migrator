import pytest
from unittest.mock import AsyncMock, MagicMock
from backend.application.services.live_sync_service import MessageDedupCache, LiveSyncService


class TestMessageDedupCache:
    def test_cache_dedup_and_lru_eviction(self):
        cache = MessageDedupCache(max_size_per_binding=3)

        assert not cache.is_initialized(100, 200)
        assert not cache.is_cloned(100, 200, 1)

        # Mark cloned
        cache.mark_cloned(100, 200, 1)
        cache.mark_cloned(100, 200, 2)
        cache.mark_cloned(100, 200, 3)

        assert cache.is_initialized(100, 200)
        # Order is [1, 2, 3]. Access 1 so order becomes [2, 3, 1]
        assert cache.is_cloned(100, 200, 1)

        # Add 4th item -> should evict head (2). Order becomes [3, 1, 4]
        cache.mark_cloned(100, 200, 4)
        assert cache.is_cloned(100, 200, 4)
        assert cache.is_cloned(100, 200, 1)  # retained because accessed
        assert not cache.is_cloned(100, 200, 2)  # evicted

    def test_cache_populate_respects_max_size(self):
        cache = MessageDedupCache(max_size_per_binding=5)
        # Populate with 10 IDs
        cache.populate(555, 666, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

        assert cache.is_initialized(555, 666)
        # Oldest IDs should not be in cache
        assert not cache.is_cloned(555, 666, 1)
        assert not cache.is_cloned(555, 666, 5)
        # Recent 5 IDs must be present
        assert cache.is_cloned(555, 666, 6)
        assert cache.is_cloned(555, 666, 10)

    def test_cache_invalidation(self):
        cache = MessageDedupCache()
        cache.mark_cloned(10, 20, 100)
        assert cache.is_cloned(10, 20, 100)

        cache.invalidate(10, 20)
        assert not cache.is_initialized(10, 20)
        assert not cache.is_cloned(10, 20, 100)


class TestLiveSyncServiceCacheIntegration:
    @pytest.mark.asyncio
    async def test_is_message_already_cloned_hits_db_once(self):
        repo = MagicMock()
        repo.get_cloned_source_message_ids = AsyncMock(return_value=[101, 102, 103])

        pool = MagicMock()
        use_case = MagicMock()
        broadcaster = MagicMock()

        svc = LiveSyncService(
            job_repository=repo,
            client_pool=pool,
            migration_use_case=use_case,
            broadcaster=broadcaster,
        )

        # First call triggers lazy warmup
        res1 = await svc.is_message_already_cloned(111, 222, 101)
        assert res1 is True
        assert repo.get_cloned_source_message_ids.call_count == 1

        # Second call for another cloned message -> zero new DB calls!
        res2 = await svc.is_message_already_cloned(111, 222, 102)
        assert res2 is True
        assert repo.get_cloned_source_message_ids.call_count == 1

        # Third call for non-cloned message -> zero new DB calls!
        res3 = await svc.is_message_already_cloned(111, 222, 999)
        assert res3 is False
        assert repo.get_cloned_source_message_ids.call_count == 1
