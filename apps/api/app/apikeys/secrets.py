import hashlib
import secrets


# The secret carries 20 bytes (~160 bits), sliced to the 26 characters this surface
# promises; the dropped character cannot meaningfully reduce that strength. So the stored
# form is a plain SHA-256 digest rather than a slow KDF: there is no human-chosen secret
# left to brute-force, and the hot path compares this once per request. The cost of that
# choice is that the plaintext is never recoverable, so it is shown exactly once at
# creation.
API_KEY_PREFIX = "ctx_live_"
SECRET_BYTES = 20
SECRET_CHARACTERS = 26


def generate_api_key() -> tuple[str, str, str, str]:
    """Return (plaintext, hash, display prefix, last four)."""
    plaintext = f"{API_KEY_PREFIX}{secrets.token_urlsafe(SECRET_BYTES)[:SECRET_CHARACTERS]}"
    return (
        plaintext,
        hash_api_key(plaintext),
        plaintext[: len(API_KEY_PREFIX) + 4],
        plaintext[-4:],
    )


def hash_api_key(plaintext: str) -> str:
    return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()
