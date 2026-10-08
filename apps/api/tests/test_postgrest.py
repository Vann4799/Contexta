import pytest

from app.core.postgrest import first_row


def test_a_list_payload_yields_its_first_row() -> None:
    assert first_row([{"id": "doc-1"}], "document") == {"id": "doc-1"}


def test_a_bare_object_payload_passes_through() -> None:
    assert first_row({"id": "doc-1"}, "document") == {"id": "doc-1"}


def test_an_empty_list_raises_instead_of_indexing() -> None:
    with pytest.raises(RuntimeError, match="no row"):
        first_row([], "document")
