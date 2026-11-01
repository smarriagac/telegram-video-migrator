import pytest
from backend.application.services.fingerprint_service import FingerprintService


def test_fingerprint_generation_is_deterministic():
    service = FingerprintService()
    fp1 = service.compute_fingerprint(
        media_type="video", file_size=1048576, duration=45, width=1920, height=1080
    )
    fp2 = service.compute_fingerprint(
        media_type="video", file_size=1048576, duration=45, width=1920, height=1080
    )
    assert fp1 == fp2
    assert len(fp1) == 64


def test_fingerprint_changes_with_attributes():
    service = FingerprintService()
    fp1 = service.compute_fingerprint("video", file_size=1048576, duration=45)
    fp2 = service.compute_fingerprint("video", file_size=1048577, duration=45)
    fp3 = service.compute_fingerprint("video", file_size=1048576, duration=46)
    assert fp1 != fp2
    assert fp1 != fp3


def test_fingerprint_document_id():
    service = FingerprintService()
    fp1 = service.compute_fingerprint("video", input_document_id=12345)
    fp2 = service.compute_fingerprint("video", input_document_id=12345)
    fp3 = service.compute_fingerprint("video", input_document_id=67890)
    assert fp1 == fp2
    assert fp1 != fp3


def test_fingerprint_none_when_empty():
    service = FingerprintService()
    assert service.compute_fingerprint("video") is None

