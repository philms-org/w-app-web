"""E2E test for the /auth/login flow, driven by Camoufox.

Requires the dev server running (npm run dev) at BASE_URL.

Run:
    scripts/camoufox/venv/bin/python3 scripts/camoufox/test_login.py

Optional full-login check (uses a real Supabase account, skipped by default):
    TEST_EMAIL=you@example.com TEST_PASSWORD=... \
        scripts/camoufox/venv/bin/python3 scripts/camoufox/test_login.py
"""

import os
import sys

from camoufox.sync_api import Camoufox

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")
TEST_EMAIL = os.environ.get("TEST_EMAIL")
TEST_PASSWORD = os.environ.get("TEST_PASSWORD")


def run():
    with Camoufox(headless=True) as browser:
        page = browser.new_page()
        page.goto(f"{BASE_URL}/auth/login")

        page.get_by_text("Welcome Back").wait_for()
        print("PASS: login page loads")

        page.get_by_role("button", name="Login").click()
        page.get_by_text("Please fill in all fields").wait_for()
        print("PASS: empty-fields validation shows an error")

        if TEST_EMAIL and TEST_PASSWORD:
            page.get_by_placeholder("Enter your email").fill(TEST_EMAIL)
            page.get_by_placeholder("Enter your password").fill(TEST_PASSWORD)
            page.get_by_role("button", name="Login").click()
            page.wait_for_url(lambda url: "/auth/login" not in url, timeout=10_000)
            print(f"PASS: logged in and navigated to {page.url}")
        else:
            print("SKIP: full login (set TEST_EMAIL/TEST_PASSWORD to run it)")


if __name__ == "__main__":
    try:
        run()
    except Exception as exc:
        print(f"FAIL: {exc}")
        sys.exit(1)
