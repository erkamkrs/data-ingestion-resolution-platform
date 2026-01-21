import pytest

from worker import normalize_email, is_valid_email_format


@pytest.mark.parametrize("raw, normalized", [
    ("  JOHN@Example.COM  ", "john@example.com"),
    ("user@example.com (work)", "user@example.com"),
    ("", None),
    (None, None),
])
def test_normalize_email(raw, normalized):
    assert normalize_email(raw) == normalized


@pytest.mark.parametrize("email", [
    "john@example.com",
    "jane.doe+tag@example.co.uk",
])
def test_is_valid_email_format_valid(email):
    assert is_valid_email_format(email) is True


@pytest.mark.parametrize("email", [
    "", "notanemail", "john@", "@example.com", "john@example", "john@example,com",
    "john@example.com;other@example.com",
])
def test_is_valid_email_format_invalid(email):
    assert is_valid_email_format(email) is False
