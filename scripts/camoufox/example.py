"""Example Camoufox script for w-app-web.

Setup:
    python3 -m venv scripts/camoufox/venv
    scripts/camoufox/venv/bin/pip install -r scripts/camoufox/requirements.txt
    scripts/camoufox/venv/bin/python3 -m camoufox fetch

Run:
    scripts/camoufox/venv/bin/python3 scripts/camoufox/example.py
"""

from camoufox.sync_api import Camoufox

TARGET_URL = "http://localhost:3000"

with Camoufox(headless=False) as browser:
    page = browser.new_page()
    page.goto(TARGET_URL)
    print(page.title())
