# Instructions for AI coding agents

Read `CONTRIBUTING.md` first. The short version:

- **Frontend edits go in `frontend-chakra/`** (new Chakra UI). **Never edit `frontend/`** (old UI, frozen until cutover).
- Work on the `staging` branch or a branch off it. Do not touch `main`.
- Reuse the shared components listed in `CONTRIBUTING.md` instead of writing new layouts.
- Run `npm run build` in `frontend-chakra/` before saying a change is finished; it must pass.
- Do not commit, push or deploy unless the user asks. Production (`/var/www/kountryeye`, port 80) is read-only.
