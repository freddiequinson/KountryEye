"""Permission needed for each route in the modules that hold medical or money data.

The router-level gate only knows "can read this module" / "can write this module".
That let front desk (who can take payments) edit diagnoses, and marketing (who can
see patient names) read clinical notes. Here every route in these modules says
exactly which permission it needs; the user needs any one of them.

`None` means the module gate is enough (checked on purpose, e.g. the consultation
type list the front desk picks from). A test fails if a route in one of these
modules is missing from the table, so new routes can't slip through.
"""

CLIN_READ = ("clinical.view", "clinical.queue", "prescriptions.view")
CLIN_WRITE = ("clinical.create",)
RX_WRITE = ("prescriptions.create", "clinical.create")
PAY = ("payments.create",)
PAY_READ = ("payments.view", "payments.create")
SCAN_READ = CLIN_READ + ("technician.scans", "technician.view")
SCAN_WRITE = ("technician.scans",)
REFERRAL_READ = ("technician.view", "technician.referrals", "referrals.payments", "referrals.payments.manage")
REFERRAL_WRITE = ("technician.referrals", "referrals.payments.manage")
REF_PAY_READ = ("referrals.payments", "referrals.payments.manage")
REF_PAY_WRITE = ("referrals.payments.manage",)
STOCK_WRITE = ("inventory.manage",)
SETTINGS = ("settings.manage",)
SALES_READ = ("sales.view", "sales.create", "pos.access")
FINANCE = ("revenue.view", "accounting.view", "analytics.view", "settings.manage")
DASHBOARDS = ("dashboard.admin", "dashboard.doctor", "dashboard.frontdesk", "dashboard.marketing", "analytics.view")

ROUTE_PERMISSIONS: dict[str, dict[tuple[str, str], tuple[str, ...] | None]] = {
    "/clinical": {
        ("GET", "/types"): None,
        ("POST", "/types"): SETTINGS,
        ("PUT", "/types/{type_id}"): SETTINGS,
        ("PATCH", "/types/{type_id}/deactivate"): SETTINGS,
        ("PATCH", "/types/{type_id}/activate"): SETTINGS,
        ("DELETE", "/types/{type_id}"): SETTINGS,
        ("GET", "/consultation-types"): None,
        ("GET", "/"): CLIN_READ,
        ("POST", "/"): CLIN_WRITE,
        ("PUT", "/{consultation_id}/start"): CLIN_WRITE,
        ("PUT", "/{consultation_id}/complete"): CLIN_WRITE,
        ("GET", "/{consultation_id}/record"): CLIN_READ,
        ("POST", "/{consultation_id}/record"): CLIN_WRITE,
        ("PUT", "/{consultation_id}/record"): CLIN_WRITE,
        ("GET", "/{consultation_id}/prescriptions"): CLIN_READ + PAY_READ,
        ("POST", "/{consultation_id}/prescriptions"): RX_WRITE,
        ("GET", "/patients/{patient_id}/records"): CLIN_READ,
        ("GET", "/patients/{patient_id}/history"): CLIN_READ,
        ("GET", "/records/{record_id}/history"): CLIN_READ,
        # Front desk sees the queue (names and status) on its dashboard
        ("GET", "/queue"): CLIN_READ + ("visits.view",),
        ("GET", "/visits/{visit_id}"): CLIN_READ,
        # Visit page for front desk too; the doctor's notes are left out for them (see the endpoint)
        ("GET", "/visits/{visit_id}/detail"): CLIN_READ + PAY_READ + ("visits.view",),
        ("PATCH", "/visits/{visit_id}/status"): CLIN_WRITE + ("clinical.queue",),
        ("POST", "/visits/{visit_id}/record"): CLIN_WRITE,
        # Checkout lists and prints prescriptions to bill them
        ("GET", "/visits/{visit_id}/prescriptions"): CLIN_READ + PAY_READ,
        ("POST", "/visits/{visit_id}/prescription"): RX_WRITE,
        ("POST", "/visits/{visit_id}/optical-prescription"): RX_WRITE,
        ("GET", "/prescriptions/pending"): CLIN_READ + PAY_READ,
        ("POST", "/prescriptions/{prescription_id}/payment"): PAY,
        ("GET", "/prescriptions/{prescription_id}/download-pdf"): CLIN_READ + PAY_READ,
        ("GET", "/out-of-stock-analytics"): ("analytics.view", "inventory.manage"),
        ("POST", "/request-scan"): CLIN_WRITE,
    },
    "/technician": {
        ("GET", "/doctors"): REFERRAL_READ,
        ("GET", "/doctors/lookup/{phone}"): REFERRAL_READ,
        ("POST", "/doctors"): REFERRAL_WRITE,
        ("PUT", "/doctors/{doctor_id}"): REFERRAL_WRITE,
        ("GET", "/doctors/{doctor_id}"): REFERRAL_READ,
        ("GET", "/referrals"): REFERRAL_READ,
        ("POST", "/referrals"): ("technician.referrals",),
        ("GET", "/referrals/{referral_id}"): REFERRAL_READ,
        ("PUT", "/referrals/{referral_id}"): ("technician.referrals",),
        ("POST", "/referrals/{referral_id}/convert-to-patient"): ("technician.referrals",),
        ("POST", "/referrals/{referral_id}/create-payment"): REF_PAY_WRITE,
        ("GET", "/scans"): SCAN_READ,
        ("POST", "/scans"): SCAN_WRITE,
        ("GET", "/scans/{scan_id}"): SCAN_READ,
        ("PUT", "/scans/{scan_id}"): SCAN_WRITE,
        ("POST", "/scans/{scan_id}/complete"): SCAN_WRITE,
        ("POST", "/scans/{scan_id}/review"): CLIN_WRITE,
        ("POST", "/scans/{scan_id}/upload-pdf"): SCAN_WRITE,
        ("GET", "/scans/{scan_id}/pdf"): SCAN_READ,
        ("POST", "/scans/request"): CLIN_WRITE + SCAN_WRITE,
        ("GET", "/patient/{patient_id}/scans"): SCAN_READ,
        ("GET", "/consultation/{consultation_id}/scans"): SCAN_READ,
        ("GET", "/scan-requests"): ("technician.view", "technician.scans"),
        ("GET", "/scan-pricing"): None,
        ("PUT", "/scan-pricing/{scan_type}"): SETTINGS + SCAN_WRITE,
        ("POST", "/scans/{scan_id}/payment"): SCAN_WRITE + PAY,
        ("POST", "/scans/{scan_id}/mark-paid"): SCAN_WRITE + PAY,
        ("POST", "/scans/{scan_id}/add-to-deficit"): SCAN_WRITE + PAY,
        ("GET", "/scan-payments/unpaid"): SCAN_WRITE + PAY_READ,
        ("GET", "/payment-settings"): REF_PAY_READ,
        ("POST", "/payment-settings"): REF_PAY_WRITE,
        ("GET", "/payments"): REF_PAY_READ,
        ("PUT", "/payments/{payment_id}"): REF_PAY_WRITE,
        ("POST", "/payments/{payment_id}/mark-paid"): REF_PAY_WRITE,
        ("POST", "/payments/create-manual"): REF_PAY_WRITE,
        ("GET", "/analytics/top-referrers"): REFERRAL_READ + ("analytics.view",),
        ("GET", "/analytics/summary"): REFERRAL_READ + ("analytics.view",),
    },
    "/patients": {
        ("GET", ""): None,
        ("GET", "/export"): ("patients.edit", "employees.manage"),
        ("GET", "/duplicates"): None,
        ("POST", "/check-duplicates"): ("patients.create", "patients.edit"),
        ("GET", "/search"): None,
        ("GET", "/{patient_id}"): None,
        ("POST", ""): ("patients.create",),
        ("PUT", "/{patient_id}"): ("patients.edit",),
        # On the public router (no login, rate limited); listed so the coverage test passes
        ("POST", "/self-register"): None,
        ("GET", "/{patient_id}/visits"): None,
        ("GET", "/{patient_id}/balance"): PAY_READ + ("debtors.view",),
        ("GET", "/{patient_id}/detect-visit-type"): None,
        ("GET", "/visits"): None,
        ("GET", "/visits/search"): None,
        ("GET", "/visits/pending-payment"): PAY_READ,
        ("GET", "/visits/{visit_id}"): None,
        ("POST", "/visits"): ("visits.create",),
        ("PUT", "/visits/{visit_id}"): ("visits.create", "visits.checkin"),
        ("POST", "/visits/{visit_id}/pay"): PAY,
        ("POST", "/visits/{visit_id}/payment"): PAY,
        ("GET", "/visits/{visit_id}/insurance-balance"): PAY_READ,
        ("GET", "/pending-registrations"): ("patients.create",),
        ("GET", "/pending-registrations/{registration_id}"): ("patients.create",),
        ("PUT", "/pending-registrations/{registration_id}"): ("patients.create",),
        ("POST", "/pending-registrations/{registration_id}/approve"): ("patients.create",),
        ("DELETE", "/pending-registrations/{registration_id}"): ("patients.create",),
    },
    "/sales": {
        ("GET", "/overview"): SALES_READ + ("analytics.view",),
        ("GET", "/categories"): None,
        ("POST", "/categories"): STOCK_WRITE,
        ("PUT", "/categories/{category_id}"): STOCK_WRITE,
        ("DELETE", "/categories/{category_id}"): STOCK_WRITE,
        ("GET", "/products"): None,
        ("GET", "/products/export"): STOCK_WRITE,
        ("GET", "/products/{product_id}"): None,
        ("POST", "/products"): STOCK_WRITE,
        ("PUT", "/products/{product_id}"): STOCK_WRITE,
        ("DELETE", "/products/{product_id}"): STOCK_WRITE,
        ("POST", "/products/{product_id}/image"): STOCK_WRITE,
        ("POST", "/products/import-csv"): STOCK_WRITE,
        ("GET", "/products/{product_id}/rank"): None,
        ("GET", "/stock/{branch_id}"): None,
        ("POST", "/create"): ("sales.create",),
        ("GET", ""): SALES_READ,
        ("GET", "/{sale_id}"): SALES_READ,
        ("POST", "/payments"): PAY,
    },
    "/payments": {
        ("GET", "/invoices"): PAY_READ,
        ("GET", "/invoices/{invoice_id}"): PAY_READ,
        ("POST", "/invoices"): PAY,
        ("PUT", "/invoices/{invoice_id}"): PAY,
        ("GET", "/payments"): PAY_READ,
        ("POST", "/payments"): PAY,
        ("GET", "/patients/{patient_id}/balance"): PAY_READ + ("debtors.view",),
    },
    "/orders": {
        ("POST", "/"): ("sales.create",),
        ("GET", "/"): None,
        ("GET", "/pending"): None,
        ("GET", "/{order_id}"): None,
        ("PATCH", "/{order_id}/status"): ("sales.create", "lab.manage"),
        ("POST", "/{order_id}/payment"): PAY,
    },
    "/dashboard": {
        # Every role dashboard shows the overview cards; an account with no role sees nothing
        ("GET", "/overview"): DASHBOARDS,
        ("GET", "/patients/stats"): ("dashboard.admin", "analytics.view"),
        ("GET", "/sales/stats"): ("dashboard.admin", "analytics.view", "revenue.view"),
        ("GET", "/visits/queue"): ("visits.view", "clinical.queue"),
    },
    "/receipts": {
        ("GET", "/prescription/{prescription_id}"): CLIN_READ + PAY_READ,
        ("GET", "/prescription-slip/{prescription_id}"): CLIN_READ + PAY_READ,
        ("GET", "/sale/{sale_id}"): SALES_READ + PAY_READ,
        ("GET", "/visit/{visit_id}"): PAY_READ + ("visits.view",),
    },
    "/checkout": {
        ("GET", "/visits/{visit_id}/checkout-summary"): PAY_READ + ("pos.access",),
        ("GET", "/visits/{visit_id}/checkout-receipt"): PAY_READ + ("pos.access",),
        # Taking money: payments or the POS, never check-in alone
        ("POST", "/visits/{visit_id}/checkout"): PAY + ("pos.access",),
        ("POST", "/visits/{visit_id}/complete-checkout"): PAY + ("pos.access",),
        ("GET", "/patients/{patient_id}/active-visits"): PAY_READ + ("pos.access", "visits.view"),
    },
    "/settings": {
        # VisionCare members are people's names, phones and employers
        ("GET", "/visioncare/members"): ("patients.view", "settings.manage"),
        ("GET", "/visioncare/members/{member_id}"): ("patients.view", "settings.manage"),
        ("POST", "/visioncare/members"): SETTINGS,
        ("POST", "/visioncare/upload"): SETTINGS,
        ("DELETE", "/visioncare/members/{member_id}"): SETTINGS,
        ("GET", "/visit-fees"): None,
        ("PUT", "/visit-fees"): SETTINGS,
        # Secret keys are never returned; only vat_rate is writable below superadmin (checked in the endpoint)
        ("GET", "/"): None,
        ("GET", "/{key}"): None,
        ("PUT", "/{key}"): None,
    },
    "/insurance": {
        ("GET", ""): None,
        ("GET", "/list"): None,
        ("POST", ""): SETTINGS,
        ("GET", "/{company_id}"): None,
        ("PUT", "/{company_id}"): SETTINGS,
        ("DELETE", "/{company_id}"): SETTINGS,
        ("GET", "/{company_id}/fee-overrides"): None,
        ("POST", "/{company_id}/fee-overrides"): SETTINGS,
        ("PUT", "/{company_id}/fee-overrides/{override_id}"): SETTINGS,
        ("DELETE", "/{company_id}/fee-overrides/{override_id}"): SETTINGS,
        # Reports list patients' policy numbers and what insurers owe
        ("GET", "/analytics/summary"): FINANCE,
        ("GET", "/analytics/monthly"): FINANCE,
        ("GET", "/analytics/detailed"): FINANCE,
        ("GET", "/analytics/export"): FINANCE,
    },
}
