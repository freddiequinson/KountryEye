import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { Toaster } from '@/components/ui/toaster'
import { OnboardingProvider } from '@/contexts/OnboardingContext'
import { OnboardingOverlay } from '@/components/onboarding/OnboardingOverlay'
import LoginPage from '@/pages/auth/LoginPage'
import DashboardLayout from '@/components/layout/DashboardLayout'
import HelpPage from '@/pages/HelpPage'
import DashboardPage from '@/pages/DashboardPage'
import PatientsPage from '@/pages/patients/PatientsPage'
import PatientDetailPage from '@/pages/patients/PatientDetailPage'
import VisitDetailPage from '@/pages/patients/VisitDetailPage'
import SalesPage from '@/pages/sales/SalesPage'
import POSPage from '@/pages/sales/POSPage'
import InventoryPage from '@/pages/inventory/InventoryPage'
import ProductsPage from '@/pages/inventory/ProductsPage'
import ProductDetailPage from '@/pages/inventory/ProductDetailPage'
import WarehouseDetailPage from '@/pages/inventory/WarehouseDetailPage'
import ImportDetailPage from '@/pages/inventory/ImportDetailPage'
import CreateTransferPage from '@/pages/inventory/CreateTransferPage'
import AssetsPage from '@/pages/inventory/AssetsPage'
import MarketingPage from '@/pages/marketing/MarketingPage'
import AccountingPage from '@/pages/accounting/AccountingPage'
// BranchesPage removed - use Settings page instead
// import BranchesPage from '@/pages/admin/BranchesPage'
import DoctorQueuePage from '@/pages/doctor/DoctorQueuePage'
import ConsultationPage from '@/pages/doctor/ConsultationPage'
import FrontDeskPage from '@/pages/frontdesk/FrontDeskPage'
import PatientRegistrationPage from '@/pages/frontdesk/PatientRegistrationPage'
import FrontDeskDashboard from '@/pages/dashboards/FrontDeskDashboard'
import DoctorDashboard from '@/pages/dashboards/DoctorDashboard'
import MarketingDashboard from '@/pages/dashboards/MarketingDashboard'
import SettingsPage from '@/pages/admin/SettingsPage'
import TerminalPage from '@/pages/admin/TerminalPage'
import RevenuePage from '@/pages/admin/RevenuePage'
import PatientSelfRegisterPage from '@/pages/public/PatientSelfRegisterPage'
import CategoriesPage from '@/pages/inventory/CategoriesPage'
import EmployeesPage from '@/pages/admin/EmployeesPage'
import EmployeeDetailPage from '@/pages/admin/EmployeeDetailPage'
import ProfilePage from '@/pages/ProfilePage'
import AttendancePage from '@/pages/AttendancePage'
import PermissionManagerPage from '@/pages/admin/PermissionManagerPage'
import AnalyticsPage from '@/pages/admin/AnalyticsPage'
import FundRequestsPage from '@/pages/FundRequestsPage'
import MessagesPage from '@/pages/MessagesPage'
import UserProfilePage from '@/pages/admin/UserProfilePage'
import NotificationsPage from '@/pages/NotificationsPage'
import ActivityTracker from '@/components/ActivityTracker'

// Technician pages
import TechnicianDashboard from '@/pages/technician/TechnicianDashboard'
import ReferralsPage from '@/pages/technician/ReferralsPage'
import NewReferralPage from '@/pages/technician/NewReferralPage'
import ScansPage from '@/pages/technician/ScansPage'
import NewScanPage from '@/pages/technician/NewScanPage'
import ScanDetailPage from '@/pages/technician/ScanDetailPage'
import ScanRequestsPage from '@/pages/technician/ScanRequestsPage'
import ReferralPaymentsPage from '@/pages/admin/ReferralPaymentsPage'
import GlobalSearchPage from '@/pages/admin/GlobalSearchPage'
import AuditLogsPage from '@/pages/admin/AuditLogsPage'
import CheckoutPage from '@/pages/frontdesk/CheckoutPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

function App() {
  return (
    <OnboardingProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<PatientSelfRegisterPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <ActivityTracker />
              <DashboardLayout>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/patients" element={<PatientsPage />} />
                  <Route path="/patients/:id" element={<PatientDetailPage />} />
                  <Route path="/patients/:patientId/visits/:visitId" element={<VisitDetailPage />} />
                  <Route path="/sales" element={<SalesPage />} />
                  <Route path="/sales/pos" element={<POSPage />} />
                  <Route path="/inventory" element={<InventoryPage />} />
                  <Route path="/inventory/products" element={<ProductsPage />} />
                  <Route path="/inventory/products/new" element={<ProductDetailPage />} />
                  <Route path="/inventory/products/:productId" element={<ProductDetailPage />} />
                  <Route path="/inventory/imports/:importId" element={<ImportDetailPage />} />
                  <Route path="/inventory/transfers/new" element={<CreateTransferPage />} />
                  <Route path="/inventory/warehouse/:warehouseId" element={<WarehouseDetailPage />} />
                  <Route path="/inventory/categories" element={<CategoriesPage />} />
                  <Route path="/inventory/assets" element={<AssetsPage />} />
                  <Route path="/marketing" element={<MarketingPage />} />
                  <Route path="/accounting" element={<AccountingPage />} />
                  {/* BranchesPage removed - use Settings page instead */}
                  {/* <Route path="/admin/branches" element={<BranchesPage />} /> */}
                  <Route path="/doctor/queue" element={<DoctorQueuePage />} />
                  <Route path="/doctor/consultation/:visitId" element={<ConsultationPage />} />
                  <Route path="/frontdesk" element={<FrontDeskPage />} />
                  <Route path="/frontdesk/register" element={<PatientRegistrationPage />} />
                  <Route path="/frontdesk/checkout/:visitId" element={<CheckoutPage />} />
                  <Route path="/dashboard/frontdesk" element={<FrontDeskDashboard />} />
                  <Route path="/dashboard/doctor" element={<DoctorDashboard />} />
                  <Route path="/dashboard/marketing" element={<MarketingDashboard />} />
                  <Route path="/admin/settings" element={<SettingsPage />} />
                  <Route path="/admin/users" element={<SettingsPage />} />
                  <Route path="/admin/terminal" element={<TerminalPage />} />
                  <Route path="/admin/revenue" element={<RevenuePage />} />
                  <Route path="/admin/employees" element={<EmployeesPage />} />
                  <Route path="/admin/employees/:employeeId" element={<EmployeeDetailPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/attendance" element={<AttendancePage />} />
                  <Route path="/admin/permissions" element={<PermissionManagerPage />} />
                  <Route path="/admin/analytics" element={<AnalyticsPage />} />
                  <Route path="/fund-requests" element={<FundRequestsPage />} />
                  <Route path="/fund-requests/:requestId" element={<FundRequestsPage />} />
                  <Route path="/admin/fund-requests" element={<FundRequestsPage />} />
                  <Route path="/admin/fund-requests/:requestId" element={<FundRequestsPage />} />
                  <Route path="/messages" element={<MessagesPage />} />
                  <Route path="/messages/:conversationId" element={<MessagesPage />} />
                  <Route path="/admin/user-profile/:userId" element={<UserProfilePage />} />
                  <Route path="/help" element={<HelpPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  
                  {/* Technician Routes */}
                  <Route path="/technician" element={<TechnicianDashboard />} />
                  <Route path="/technician/dashboard" element={<TechnicianDashboard />} />
                  <Route path="/technician/referrals" element={<ReferralsPage />} />
                  <Route path="/technician/referrals/new" element={<NewReferralPage />} />
                  <Route path="/technician/referrals/:referralId" element={<ReferralsPage />} />
                  <Route path="/technician/scans" element={<ScansPage />} />
                  <Route path="/technician/scans/new" element={<NewScanPage />} />
                  <Route path="/technician/scans/:scanId" element={<ScanDetailPage />} />
                  <Route path="/technician/scan-requests" element={<ScanRequestsPage />} />
                  <Route path="/technician/doctors" element={<ReferralsPage />} />
                  
                  {/* Admin Referral Payments */}
                  <Route path="/admin/referral-payments" element={<ReferralPaymentsPage />} />
                  <Route path="/admin/search" element={<GlobalSearchPage />} />
                  <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
                </Routes>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <OnboardingOverlay />
      <Toaster />
    </OnboardingProvider>
  )
}

export default App
