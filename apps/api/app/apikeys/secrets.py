import hashlib
import secrets


# 26 characters of secrets.token_urlsafe is ~154 bits, which is why the stored form is a
# plain SHA-256 digest rather than a slow KDF: there is no human-chosen secret left to
# brute-force, and the hot path compares this once per request. The cost of that choice
# is that the plaintext is never recoverable, so it is shown exactly once at creation.
API_KEY_PREFIX = "ctx_live_"
SECRET_CHARACTERS = 26


def generate_api_key() -> tuple[str, str, str, str]:
    """Return (plaintext, hash, display prefix, last four)."""
    plaintext = f"{API_KEY_PREFIX}{secrets.token_urlsafe(SECRET_CHARACTERS)}"
    return (
        plaintext,
        hash_api_key(plaintext),
        plaintext[: len(API_KEY_PREFIX) + 4],
        plaintext[-4:],
    )


def hash_api_key(plaintext: str) -> str:
    return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()
