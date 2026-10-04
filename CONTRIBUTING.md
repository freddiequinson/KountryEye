# Contributing to KountryEye

## Where frontend work goes

**All frontend work goes in `frontend-chakra/`.** This is the new UI (React + Vite + TypeScript + Chakra UI v2, based on the Horizon UI template).

**Do not edit `frontend/`.** That is the old UI (shadcn + Tailwind). It is still what production serves, and it stays frozen until the new UI replaces it. Changes made there will be thrown away at cutover.

| Folder | What it is | Edit it? |
|---|---|---|
| `frontend-chakra/` | New UI, deployed to staging | Yes |
| `frontend/` | Old UI, live in production | No |
| `backend/` | FastAPI API shared by both | Yes, with care: production uses it too |
| `deployment/staging/` | Staging deploy scripts | Only if you are changing how staging deploys |

## Branches

- Work from the **`staging`** branch. `main` is what production runs and does not contain the new UI yet.
- Create a branch off `staging`, then open a pull request back into `staging`.
- Do not push to `main` and do not deploy to production. Cutover is a separate, planned step.

```bash
git checkout staging
git pull
git checkout -b your-change
```

## Running it locally

Backend (port 8000):

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows; use `source venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload
```

New frontend (port 5173, proxies `/api` and `/uploads` to the backend):

```bash
cd frontend-chakra
npm install
npm run dev
```

## Before you push

```bash
cd frontend-chakra
npm run build
```

The build runs the TypeScript check and fails on unused imports or variables. It must pass.

Look at what you changed in the browser in **light mode, dark mode and at phone width**. A change is not finished until you have seen it render.

## How the new UI is built

Reuse the shared pieces instead of writing one-off layouts. They live in `frontend-chakra/src/components/`:

| Need | Use |
|---|---|
| Page title row with actions | `PageHeader` |
| Dashboard banner with photo | `PageHero` |
| Card, card with title | `card/Card`, `card/SectionCard` |
| Several related views in one card | `card/TabCard` or `card/TabbedSections` |
| Metric tile | `card/StatCard` |
| Product tile (POS) | `card/ProductCard` |
| Top of a detail page (patient, employee) | `EntityHeader` in `Person.tsx` |
| Name with avatar in a table | `PersonCell` in `Person.tsx` |
| List row with a tile, name, value | `HistoryItem` |
| Long form | `FormSection` and `FormActions` in `FormSection.tsx` |
| Modal, confirm dialog, field, search box, empty state, pagination, table wrapper | `ui.tsx` |
| Charts | `charts.tsx` (ApexCharts) |
| Calendar | `calendar/MiniCalendar` |

Conventions:

- **Layout:** prefer tabs over placing peer cards side by side. Long forms use `FormSection` (label on the left, fields in a grid), not one long column.
- **Inputs:** `variant="main"` on `Input`, `Select` and `Textarea`.
- **Buttons:** `variant="brand"` for the primary action, `variant="light"` for secondary, `colorScheme="red"` for destructive.
- **Colours:** use theme tokens (`brand.500`, `secondaryGray.600`, `secondaryGray.900`), not hex values. Every colour must work in dark mode; use `useColorModeValue` or `_dark`.
- **Icons:** `react-icons` (the `Md*` set). Do not add lucide.
- **Sizes:** page titles 34px, card titles 22px, table text 14px. These come from the shared components; do not override them per page.
- **Data:** TanStack Query for fetching, the `api` client in `src/lib/api.ts`, toasts through `src/hooks/use-toast.ts`.
- **Confirmations:** use `ConfirmDialog`, never the browser's `confirm()`.
- **Routes:** add them in `src/App.tsx` and the menu entry in `src/config/nav.ts`. Keep URL paths the same as the old app so links keep working.

The visual reference is the free Horizon UI Chakra template (horizon-ui.com, `horizon-ui-chakra` on GitHub). If a pattern exists there, port it rather than inventing a new one.

## Backend changes

Production and staging run the same backend code, on separate copies of the database. If your change needs a new column or table, say so in the pull request, because the production SQLite database has to be migrated by hand before the code is deployed (see `DEPLOYMENT.md`).

## Staging

Staging is at `http://144.126.199.94:8080` and runs the `staging` branch against a copy of the production data. Deploys are done by the project owner after a pull request is merged. The scripts are in `deployment/staging/`.

## AI coding agents

The same rules apply to AI agents working in this repository: edit `frontend-chakra/`, never `frontend/`; work on `staging`; run `npm run build` in `frontend-chakra` before finishing; do not commit, push or deploy unless the person you are working for asks. See `AGENTS.md`.
