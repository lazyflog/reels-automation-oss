# Contributing

Thanks for your interest! Issues and pull requests are welcome.

## Development setup

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec api alembic upgrade head
docker compose exec api python scripts/create_admin.py --username admin --password '<password>'
```

- Backend: Python 3.12, FastAPI, Celery, SQLAlchemy 2, Alembic, moviepy 2 — `backend/`
- Dashboard: Next.js 14 (App Router), TypeScript, Tailwind — `dashboard/`

Before opening a PR:

```bash
cd dashboard && npm ci && npx tsc --noEmit
cd ../backend && python -m compileall -q .
```

## Guidelines

- **Database changes** need an Alembic migration:
  `docker compose exec api alembic revision --autogenerate -m "describe change"` — review the
  generated file before committing.
- **Prompts** live in `backend/prompts.py`. Keep them in English and use the `{language}`
  placeholder for the output language.
- **Secrets** come from environment variables only (`backend/config.py`). Never commit `.env`,
  tokens or API keys.
- **Optional integrations** that access third-party platforms must be off by default, behind a
  config flag, and documented in `docs/LEGAL.md`.
- **No third-party content** — do not add real video URLs, creator names, downloaded media,
  copyrighted fonts or music to code, tests, issues or screenshots.
- Keep pipeline steps independently retryable (each Celery task reads its state from the DB).

## Documentation

User-facing docs exist in English, Korean, Simplified Chinese and Japanese (`README*.md`,
`docs/*.md`). English is the source of truth; if you change an English doc, update the
translations or note in the PR that they need updating.

## License

By contributing you agree that your contributions are licensed under the MIT License.
