# Instructions for AI coding agents

**You are on `main`, which is what production runs. Do not do frontend work here.**

The frontend is being rebuilt. The new UI lives in `frontend-chakra/` on the **`staging`** branch and does not exist on `main` yet. The `frontend/` folder on this branch is the old UI and is frozen until cutover; changes made to it will be thrown away.

Before editing anything:

```bash
git checkout staging
git pull
```

Then read `CONTRIBUTING.md` and `AGENTS.md` on that branch. The short version:

- **Frontend edits go in `frontend-chakra/`** (React + Vite + TypeScript + Chakra UI). **Never edit `frontend/`.**
- Work on `staging` or a branch off it, and open pull requests into `staging`. Do not commit to `main`.
- Reuse the shared components listed in `CONTRIBUTING.md` instead of writing new layouts.
- Run `npm run build` in `frontend-chakra/` before saying a change is finished; it must pass.
- Do not commit, push or deploy unless the user asks. Production is read-only.
