# Kountry Eyecare - Development Roadmap

## Project Architecture

```
KountryEye/
├── frontend/          # React + Vite + Shadcn UI + TailwindCSS
├── backend/           # FastAPI + SQLAlchemy + SQLite/PostgreSQL
├── desktop/           # Electron wrapper
└── project-plan/      # Documentation
```

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, TypeScript, Shadcn/ui, TailwindCSS, Lucide Icons, TanStack Query, Zustand |
| Backend | FastAPI, SQLAlchemy, Pydantic, Alembic (migrations), SQLite (local), PostgreSQL (cloud) |
| Desktop | Electron (wraps frontend, bundles backend) |
| Sync | Custom sync engine with conflict resolution |

## Design Guidelines
- **Colors**: Green (#4C9B4F), Blue (#0CC0DF), White
- **Icons**: Lucide React only (no shield icons)
- **No gradients** - use solid colors
- **No emojis** in UI
- **Minimal comments** in code
- Use Shadcn components wherever available

---

## Phase 1: Foundation (Week 1-2)

### 1.1 Backend Setup
- [ ] Initialize FastAPI project structure
- [ ] Configure SQLAlchemy with SQLite for local dev
- [ ] Set up Alembic for database migrations
- [ ] Create base models: User, Branch, Role, Permission
- [ ] Implement JWT authentication
- [ ] Create RBAC middleware
- [ ] Set up CORS for frontend

### 1.2 Frontend Setup
- [ ] Initialize Vite + React + TypeScript
- [ ] Install and configure Shadcn/ui
- [ ] Set up TailwindCSS with brand colors
- [ ] Configure Lucide icons
- [ ] Create base layout components (Sidebar, Header, MainContent)
- [ ] Set up React Router
- [ ] Configure TanStack Query for API calls
- [ ] Set up Zustand for global state
- [ ] Create authentication context and protected routes

### 1.3 Core Auth Module
- [ ] Login page
- [ ] Password reset flow
- [ ] Session management
- [ ] Role-based route guards

---

## Phase 2: User & Branch Management (Week 3)

### 2.1 Backend
- [ ] Branch CRUD endpoints
- [ ] Employee CRUD endpoints
- [ ] Role and permission management endpoints
- [ ] Audit logging system

### 2.2 Frontend
- [ ] Admin: Branch management page
- [ ] Admin: Employee management page
- [ ] Admin: Role/permission editor
- [ ] Profile settings page

---

## Phase 3: Patient & Visit Management (Week 4-5)

### 3.1 Backend
- [ ] Patient model with extensible fields
- [ ] Visit model (enquiry vs full check-in)
- [ ] Patient registration endpoints
- [ ] Duplicate detection algorithm
- [ ] Patient search and filter endpoints
- [ ] Audit trail for patient record edits

### 3.2 Frontend
- [ ] Digital patient registration form
- [ ] Front desk: Visit recording interface
- [ ] Duplicate patient detection UI
- [ ] Patient list with search/filter
- [ ] Patient detail view (demographics, history)
- [ ] Form approval workflow for front desk

---

## Phase 4: Consultation & Clinical Records (Week 6-7)

### 4.1 Backend
- [ ] Consultation type configuration (Admin)
- [ ] Payment type configuration
- [ ] Consultation fee calculation
- [ ] Clinical record models (examination, diagnosis, management plan)
- [ ] Prescription model
- [ ] Medication model

### 4.2 Frontend
- [ ] Front desk: Consultation assignment
- [ ] Front desk: Payment processing
- [ ] Doctor: Patient queue/list
- [ ] Doctor: Clinical examination form
- [ ] Doctor: Diagnosis entry
- [ ] Doctor: Management plan (spectacle Rx, etc.)
- [ ] Doctor: Prescription creation
- [ ] Prescription to billing flow

---

## Phase 5: Sales & Billing (Week 8-9)

### 5.1 Backend
- [ ] Product model
- [ ] Price management with change notifications
- [ ] Discount system
- [ ] Sales transaction model
- [ ] Receipt generation (PDF)
- [ ] Branch stock tracking

### 5.2 Frontend
- [ ] Admin: Product management
- [ ] Admin: Price configuration
- [ ] Front desk: POS interface
- [ ] Prescription-based sales
- [ ] Discount application
- [ ] Receipt preview and print
- [ ] Price change notifications

---

## Phase 6: Inventory & Warehouse (Week 10-11)

### 6.1 Backend
- [ ] Warehouse model
- [ ] Import tracking (expected arrivals, reminders)
- [ ] Stock distribution to branches
- [ ] Stock request system
- [ ] Low stock alerts

### 6.2 Frontend
- [ ] Admin: Warehouse dashboard
- [ ] Admin: Import registration
- [ ] Admin: Arrival confirmation
- [ ] Admin: Stock distribution
- [ ] Branch: Stock request form
- [ ] Inventory reports

---

## Phase 7: Asset Management (Week 12)

### 7.1 Backend
- [ ] Asset model
- [ ] Maintenance scheduling
- [ ] Service log model
- [ ] Asset health tracking
- [ ] Asset reports

### 7.2 Frontend
- [ ] Admin: Asset registry
- [ ] Asset detail view
- [ ] Maintenance scheduler
- [ ] Service log entry
- [ ] Asset health reports (printable)

---

## Phase 8: Marketing & Ratings (Week 13)

### 8.1 Backend
- [ ] Event/campaign model
- [ ] Customer rating model
- [ ] Google Business rating integration (link generation)
- [ ] Marketing analytics endpoints

### 8.2 Frontend
- [ ] Marketing: Event planner
- [ ] Marketing: Campaign tracker
- [ ] Customer rating collection
- [ ] Google review prompt
- [ ] Marketing analytics dashboard

---

## Phase 9: Dashboards & Analytics (Week 14-15)

### 9.1 Backend
- [ ] Dashboard data aggregation endpoints
- [ ] Analytics computation
- [ ] Report generation (PDF/Excel)

### 9.2 Frontend
- [ ] Patient dashboard (daily/monthly/yearly/all-time)
- [ ] Sales dashboard (revenue, expenditure, profit)
- [ ] Branch dashboard (Admin)
- [ ] Role-specific dashboards
- [ ] Analytics pages (Admin, Marketing)
- [ ] Data tables with export

---

## Phase 10: Accounting (Week 16)

### 10.1 Backend
- [ ] Income tracking
- [ ] Expense tracking
- [ ] Financial summary endpoints
- [ ] Report export

### 10.2 Frontend
- [ ] Admin: Accounting dashboard
- [ ] Income/expense entry
- [ ] Financial reports (daily/monthly/yearly)
- [ ] Export to PDF/Excel

---

## Phase 11: Offline-First & Sync (Week 17-18)

### 11.1 Architecture
- [ ] IndexedDB for frontend local storage
- [ ] SQLite bundled with Electron
- [ ] Sync queue for pending changes
- [ ] Conflict resolution strategy
- [ ] Background sync worker

### 11.2 Implementation
- [ ] Offline data layer in frontend
- [ ] Sync status indicators
- [ ] Manual sync trigger
- [ ] Conflict resolution UI
- [ ] Data integrity checks

---

## Phase 12: Electron Desktop Wrapper (Week 19-20)

### 12.1 Setup
- [ ] Initialize Electron project in `/desktop`
- [ ] Configure electron-builder
- [ ] Bundle frontend build
- [ ] Bundle backend as subprocess or use PyInstaller

### 12.2 Features
- [ ] System tray integration
- [ ] Auto-start option
- [ ] Auto-update mechanism
- [ ] Native notifications
- [ ] Print integration
- [ ] Local database management

### 12.3 Build & Distribution
- [ ] Windows installer (.exe/.msi)
- [ ] Code signing (optional)
- [ ] Update server setup

---

## Phase 13: Testing & QA (Week 21)

- [ ] Unit tests (backend)
- [ ] Integration tests (API)
- [ ] E2E tests (Playwright)
- [ ] User acceptance testing
- [ ] Performance testing
- [ ] Security audit

---

## Phase 14: Deployment (Week 22)

### Web Deployment
- [ ] PostgreSQL cloud database
- [ ] FastAPI deployment (Railway/Render/VPS)
- [ ] Frontend deployment (Vercel/Netlify)
- [ ] SSL certificates
- [ ] Domain configuration

### Desktop Distribution
- [ ] Build installers
- [ ] Documentation
- [ ] Training materials

---

## Folder Structure

### Frontend (`/frontend`)
```
src/
├── components/
│   ├── ui/              # Shadcn components
│   ├── layout/          # Sidebar, Header, etc.
│   └── shared/          # Reusable components
├── pages/
│   ├── auth/
│   ├── admin/
│   ├── frontdesk/
│   ├── doctor/
│   └── marketing/
├── hooks/
├── lib/
│   ├── api/             # API client
│   ├── utils/
│   └── constants/
├── stores/              # Zustand stores
└── types/
```

### Backend (`/backend`)
```
app/
├── api/
│   └── v1/
│       ├── endpoints/
│       └── deps.py
├── core/
│   ├── config.py
│   ├── security.py
│   └── database.py
├── models/
├── schemas/
├── services/
└── utils/
```

### Desktop (`/desktop`)
```
├── main.js              # Electron main process
├── preload.js
├── package.json
└── build/               # Build configuration
```

---

## Next Steps

1. **Start with Phase 1.1** - Backend foundation
2. **Parallel: Phase 1.2** - Frontend foundation
3. Build incrementally, testing each module before moving on
4. Integrate offline sync after core features are stable
5. Wrap with Electron last

---

## Notes

- Each phase builds on the previous
- Backend and frontend can be developed in parallel within each phase
- Electron wrapper comes last to avoid complexity during development
- Offline sync is complex - implement after core features work online
- Use feature flags for gradual rollout
