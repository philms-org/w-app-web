# Camoufox

Stealth Firefox automation ([daijro/camoufox](https://github.com/daijro/camoufox)), wired in under `scripts/camoufox/` for local E2E or scraping use. Playwright-compatible API.

## Setup (already done once, re-run if venv is missing)

```bash
python3 -m venv scripts/camoufox/venv
scripts/camoufox/venv/bin/pip install -r scripts/camoufox/requirements.txt
scripts/camoufox/venv/bin/python3 -m camoufox fetch
```

## Run the example

```bash
scripts/camoufox/venv/bin/python3 scripts/camoufox/example.py
```

## Run the login E2E test

Requires `npm run dev` running first.

```bash
scripts/camoufox/venv/bin/python3 scripts/camoufox/test_login.py
```

Checks the `/auth/login` page loads and that empty-field client-side validation works. To also exercise a full login with a real account, set `TEST_EMAIL`/`TEST_PASSWORD`:

```bash
TEST_EMAIL=you@example.com TEST_PASSWORD=... \
  scripts/camoufox/venv/bin/python3 scripts/camoufox/test_login.py
```

The venv is gitignored; the browser binary itself is cached at `~/Library/Caches/camoufox/` and shared across projects.
