# Kountry Eyecare - Integrated Clinic Management System

A comprehensive clinic management system for Kountry Eyecare with multi-branch support, offline-first capability, and both web and desktop deployments.

## Project Structure

```
KountryEye/
├── frontend/          # React + Vite + Shadcn UI + TailwindCSS
├── backend/           # FastAPI + SQLAlchemy + SQLite/PostgreSQL
├── desktop/           # Electron wrapper for desktop app
└── project-plan/      # Documentation and requirements
```

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, TypeScript, Shadcn/ui, TailwindCSS, Lucide Icons |
| Backend | FastAPI, SQLAlchemy, Pydantic, Alembic, SQLite/PostgreSQL |
| Desktop | Electron |

## Brand Colors

- **Primary Green**: #4C9B4F
- **Secondary Blue**: #0CC0DF
- **White**: #FFFFFF

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- pip

### Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt

# Copy .env.example to .env
copy .env.example .env  # Windows
# cp .env.example .env  # Linux/Mac

# Initialize database
python init_db.py

# Seed initial data (optional)
python seed_data.py

# Start server
uvicorn app.main:app --reload
```

### Default Admin Login

After running `seed_data.py`:
- **Email**: admin@kountryeyecare.com
- **Password**: admin123

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Desktop Setup (Development)

```bash
cd desktop
npm install
npm start
```

### Building Desktop App

```bash
cd frontend
npm run build
# Copy dist folder to desktop/frontend-build

cd ../desktop
npm run build:win  # For Windows
```

## Features

- **Patient Management**: Digital registration, duplicate detection, audit trails
- **Visit Recording**: Enquiries and full check-ins
- **Clinical Records**: Examinations, diagnoses, prescriptions
- **Sales & Billing**: POS, receipts, discounts
- **Inventory**: Warehouse, stock distribution, low stock alerts
- **Asset Management**: Equipment tracking, maintenance scheduling
- **Marketing**: Events, campaigns, ratings
- **Analytics**: Dashboards, reports, exports
- **Multi-Branch**: Branch management, role-based access
- **Offline-First**: Local data storage with sync

## User Roles

1. **Front Desk**: Visits, patient registration, payments
2. **Doctors**: Clinical records, prescriptions
3. **Marketing**: Events, campaigns, ratings
4. **Admin**: Full system access, configuration

## Quick Start (Windows)

### Development Mode
Simply double-click `start-dev.bat` in the project root. This will:
1. Start the backend server (http://localhost:8000)
2. Start the frontend dev server (http://localhost:5173)
3. Open the app in your browser

To stop: Run `stop-dev.bat` or close the terminal windows.

### Build Desktop Executable
Run `build-desktop.bat` to create a standalone Windows installer. The installer will be in `desktop/dist/`.

## License

Proprietary - Kountry Eyecare
