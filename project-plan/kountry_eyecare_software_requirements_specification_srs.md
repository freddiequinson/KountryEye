# Kountry Eyecare
## Integrated Clinic Management System (ICMS)

---

## 1. Overview

### 1.1 Purpose
This document defines the functional and non-functional requirements for the **Kountry Eyecare Integrated Clinic Management System (ICMS)**. The system will manage end-to-end operations across multiple branches of Kountry Eyecare, supporting both **local (offline-first)** and **web-based** deployments with reliable data synchronization.

The document is intended for software developers, system architects, UI/UX designers, and project stakeholders.

### 1.2 Objectives
- Digitize and centralize all clinic operations
- Eliminate paper-based records and reduce duplication
- Enable real-time and offline operations with data retention
- Provide role-based access and accountability
- Support multi-branch management and growth
- Deliver actionable dashboards, analytics, and reports

### 1.3 System Scope
The system will cover:
- Patient and visit management
- Clinical records and prescriptions
- Sales, billing, and receipts
- Inventory, warehouse, and asset management
- Marketing and outreach tracking
- Accounting, reporting, and analytics
- Role and permission management

---

## 2. User Roles and Access Levels

### 2.1 Front Desk
**Primary Responsibilities**:
- Record all walk-in visits (enquiries and full check-ins)
- Digitize and validate patient registration forms
- Assign consultation types and payment methods
- Process consultation payments
- Generate receipts
- Process prescription payments
- Match and prevent duplicate patient records

**Access Scope**:
- Assigned branch only
- Patient demographic and visit data
- Sales related to front desk operations

---

### 2.2 Doctors (Ophthalmologists / Optometrists)
**Primary Responsibilities**:
- Access full patient medical records
- View visit and attendance history
- Record examination findings
- Add diagnoses and management plans
- Prescribe spectacles and medications
- Create billable prescriptions

**Access Scope**:
- Clinical data only
- Assigned branch (unless explicitly granted broader access)

---

### 2.3 Marketing
**Primary Responsibilities**:
- Plan and schedule marketing events and outreach
- Track promotional activities and media tours
- View customer ratings and feedback
- Analyze outreach performance

**Access Scope**:
- Marketing analytics and ratings
- Event and campaign modules

---

### 2.4 Admin (Clinic Owner / Super Admin)
**Primary Responsibilities**:
- Full system oversight
- Branch creation and management
- Employee onboarding and role assignment
- Permission and access control
- Revenue, expenditure, and accounting
- Asset and inventory oversight
- Warehouse and product distribution
- Import tracking and confirmation
- System-wide reporting and analytics

**Access Scope**:
- Unrestricted access across all branches and modules

---

## 3. Core Functional Modules

---

### 3.1 Visit & Patient Management

#### 3.1.1 Visit Recording
- Every walk-in is recorded as a **Visit**
- Visit types:
  - Enquiry only (requires purpose of visit)
  - Full check-in
- Visits are linked to a branch and date/time

#### 3.1.2 Patient Registration (Softcopy Forms)
- Digital patient form capturing:
  - First name, middle name, surname
  - Date of birth and age (auto-calculated)
  - Sex
  - Marital status
  - Contact information
  - Nationality
  - Occupation
  - Next of kin details
- Forms can be:
  - Filled directly by patients (tablet/phone/web)
  - Entered by front desk from hardcopy forms
- Front desk must **review and approve** patient-submitted forms before saving

#### 3.1.3 Patient Record Management
- Each patient has a **permanent unique record**
- Records include:
  - Demographics
  - Visit history
  - Payment history
  - Case history
  - Examinations
  - Diagnoses
  - Management plans
  - Medications and prescriptions
- System must intelligently detect potential duplicate patients and suggest matches
- All edits must be **audited and logged** (who, what, when)
- Patient record structure must be extensible (e.g. Ghana Card, future fields)

---

### 3.2 Consultation & Payments

- Front desk assigns:
  - Consultation type (e.g. Ophthalmologist, Optometrist – configurable by Admin)
  - Payment type:
    - Cash
    - Insurance (insurance provider, ID, membership number)
    - VisionCare Membership (clinic-defined and configurable)
- Consultation fees are:
  - Configured by Admin
  - Auto-calculated by the system
- Initial consultation payment is recorded **before tests or treatments**

---

### 3.3 Clinical Records & Prescriptions

- Doctors can:
  - Record examination results
  - Add diagnoses
  - Define management plans
  - Prescribe medications and spectacles
- Prescriptions automatically:
  - Attach to the patient record
  - Generate billable items
  - Appear at the front desk for payment processing

---

### 3.4 Sales & Billing

- Product management:
  - Add and manage products (frames, lenses, medications, etc.)
  - Set and update prices (Admin or delegated roles)
  - Apply discounts (Admin or authorized users)
- Sales operations:
  - Sell products based on prescriptions
  - Manual product sales (where applicable)
  - Automatic stock deduction per branch
- Price changes must trigger **alerts/notifications** to staff
- Generate printable and digital receipts

---

### 3.5 Inventory, Warehouse & Distribution

- Central warehouse module:
  - Register imported goods
  - Set expected arrival dates
  - Automated reminders on arrival dates
  - Confirm receipt into warehouse
- Distribution:
  - Allocate stock from warehouse to branches
  - Track stock levels per branch
  - Branches can request stock replenishment
- Branch sales are restricted to available stock (cannot sell below zero)

---

### 3.6 Asset Management

- Register assets per branch (equipment, machines, furniture, etc.)
- Asset details:
  - Purchase date
  - Location (branch)
  - Condition
- Maintenance tracking:
  - Schedule servicing
  - Log completed servicing
  - Track asset health history
- Generate printable asset and maintenance reports

---

### 3.7 Marketing & Ratings

- Event planning and scheduling
- Outreach and campaign tracking
- Customer feedback and internal ratings
- Integration support for Google Business ratings (linking and prompting customers)
- Marketing analytics dashboards

---

### 3.8 Dashboards & Reporting

#### 3.8.1 Dashboards
- Patient dashboard:
  - Daily, monthly, yearly, and all-time views
- Sales dashboard:
  - Revenue
  - Expenditure
  - Profit summaries
- Branch dashboards (Admin-only)
- Role-specific dashboards for Front Desk, Doctors, and Marketing

#### 3.8.2 Tables & Logs
- Viewable tables for:
  - All visits
  - Sales transactions
  - Attendance records
  - Payments
  - Prescriptions
  - Inventory movements

---

### 3.9 Accounting & Financial Management

- Income tracking (consultations, product sales)
- Expense tracking
- Financial summaries:
  - Daily
  - Monthly
  - Yearly
- Exportable reports for accounting purposes

---

## 4. Analytics

- Admin analytics:
  - Revenue trends
  - Patient growth
  - Branch performance
  - Product performance
- Marketing analytics:
  - Event effectiveness
  - Customer engagement and ratings

---

## 5. Non-Functional Requirements

### 5.1 Performance
- Fast system response times
- Optimized for low-latency local usage

### 5.2 Offline-First Capability
- System must:
  - Operate fully on local PCs without internet
  - Store data locally when offline
  - Automatically sync to the web server when internet is available
  - Handle conflict resolution safely

### 5.3 Deployment
- Web application
- Local desktop application (PC-based)
- Shared codebase where possible

### 5.4 Security
- Role-based access control (RBAC)
- Audit logs for sensitive actions
- Secure patient and financial data

### 5.5 Data Retention & Integrity
- No loss of data during offline usage
- Enforced uniqueness for patient records
- Full historical traceability

---

## 6. Technology Stack

- **Frontend**: Shadcn UI
- **Backend**: FastAPI
- **Brand Colors**:
  - Green: #4C9B4F
  - Blue: #0CC0DF
  - White

---

## 7. Future Expandability

- Additional consultation types
- Additional patient data fields
- Integration with external systems (insurance, labs, national IDs)
- Mobile application support

---

**End of Document**

