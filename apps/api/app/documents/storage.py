from typing import Protocol
from urllib.parse import quote

import httpx


class DocumentStorage(Protocol):
    async def upload_document(
        self,
        storage_path: str,
        content: bytes,
        content_type: str,
    ) -> None:
        ...


class SupabaseDocumentStorage:
    def __init__(
        self,
        supabase_url: str,
        service_role_key: str,
        bucket: str,
    ) -> None:
        self._supabase_url = supabase_url.rstrip("/")
        self._service_role_key = service_role_key
        self._bucket = bucket

    async def upload_document(
        self,
        storage_path: str,
        content: bytes,
        content_type: str,
    ) -> None:
        headers = {
            "apikey": self._service_role_key,
            "Authorization": f"Bearer {self._service_role_key}",
            "Content-Type": content_type,
            "x-upsert": "false",
        }
        encoded_storage_path = "/".join(
            quote(segment, safe="") for segment in storage_path.split("/")
        )
        url = (
            f"{self._supabase_url}/storage/v1/object/"
            f"{self._bucket}/{encoded_storage_path}"
        )
        async with httpx.AsyncClient() as client:
            response = await client.post(url, content=content, headers=headers)
            response.raise_for_status()


class InMemoryDocumentStorage:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}
        self.content_types: dict[str, str] = {}

    async def upload_document(
        self,
        storage_path: str,
        content: bytes,
        content_type: str,
    ) -> None:
        self.objects[storage_path] = content
        self.content_types[storage_path] = content_type
