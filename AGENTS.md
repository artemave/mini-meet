# Repository Guidelines

## Project Structure & Module Organization
- Use `src/` for application code and `tests/` for test code; mirror module paths (e.g., `src/app/users/` ↔ `tests/app/users/`).
- Place helper scripts in `scripts/` (e.g., `scripts/dev`, `scripts/test`).
- Keep static assets in `assets/` and docs in `docs/`. Add examples and fixtures under `tests/fixtures/`.

## Build, Test, and Development Commands
- Local dev: `node --run dev` (or `npm run dev`) — start the app.
- Start (prod): `node --run start` — run without dev flags.
- If a Makefile is added, provide `make dev`, `make test`, `make lint`, and `make build` targets that delegate to package.json scripts.

## Coding Style & Naming Conventions
- Indentation: 2 spaces; max line length 100 unless tool-enforced otherwise.
- Files and directories: `snake_case/`; CLI binaries: `kebab-case`.
- Prefer small, focused modules. Keep functions under ~40 lines where practical.
- If formatters/linters are introduced, run them before pushing (e.g., Prettier/ESLint, Black/Ruff). Commit only formatted code.

## Testing Guidelines
- Put unit tests in `tests/`, colocated by feature; name files `feature.test.<ext>` or `test_feature.<ext>` consistently.
- Aim for meaningful coverage on core logic; include edge cases and error paths.
- Use fixtures in `tests/fixtures/` and avoid network or external side effects in unit tests.

## Security & Configuration
- Never commit secrets. Use `.env` (ignored) with a checked-in `.env.example`.
- Document required environment variables in `docs/config.md` when added.

## Agent-Specific Instructions
- Keep patches minimal and targeted; don’t refactor unrelated code.
- Follow this structure and add missing `scripts/` as part of your change when needed.
- Don't `git add`. Don't `git commit`. Don't `git push`.
