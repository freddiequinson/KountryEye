"""Password reset token checks. Run: venv/Scripts/python -m tests.test_password_reset (from backend/)."""
from app.core.security import (
    create_access_token,
    create_reset_token,
    decode_token,
    get_password_hash,
    read_reset_token,
    reset_token_matches,
)


def test_password_reset_tokens():
    old_hash = get_password_hash("old-password")
    token = create_reset_token(42, old_hash)

    # Valid token resolves to the user and matches the current password
    user_id, fp = read_reset_token(token)
    assert user_id == "42"
    assert reset_token_matches(fp, old_hash)

    # Single use: once the password changes, the same token no longer matches
    new_hash = get_password_hash("new-password")
    assert not reset_token_matches(fp, new_hash)

    # A reset token must never work as a Bearer access token
    assert decode_token(token) is None

    # ...and an access token is not a reset token
    access = create_access_token(subject=42)
    assert decode_token(access) == "42"
    assert read_reset_token(access) is None

    # Garbage / tampered tokens are rejected
    assert read_reset_token("not-a-token") is None
    assert read_reset_token(token[:-2] + "xx") is None


if __name__ == "__main__":
    test_password_reset_tokens()
    print("ok")
