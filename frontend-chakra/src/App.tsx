import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { hasPermission } from '@/config/nav'
import { EmptyState } from '@/components/ui'
import { MdLock } from 'react-icons/md'
import { OnboardingProvider } from '@/contexts/OnboardingContext'
import { OnboardingOverlay } from '@/components/onboarding/OnboardingOverlay'
import ActivityTracker from '@/components/ActivityTracker'
import AdminLayout from '@/layouts/admin/AdminLayout'
import LoginPage from '@/pages/auth/LoginPage'
import ChangePasswordPage from '@/pages/auth/ChangePasswordPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import PatientSelfRegisterPage from '@/pages/public/PatientSelfRegisterPage'
import DashboardPage from '@/pages/DashboardPage'

import FrontDeskDashboard from '@/pages/dashboards/FrontDeskDashboard'
import DoctorDashboard from '@/pages/dashboards/DoctorDashboard'

import MarketingDashboard from '@/pages/dashboards/MarketingDashboard'
import PatientsPage from '@/pages/patients/PatientsPage'

import PatientDetailPage from '@/pages/patients/PatientDetailPage'
import VisitDetailPage from '@/pages/patients/VisitDetailPage'

import FrontDeskPage from '@/pages/frontdesk/FrontDeskPage'
import PatientRegistrationPage from '@/pages/frontdesk/PatientRegistrationPage'

import CheckoutPage from '@/pages/frontdesk/CheckoutPage'
import DoctorQueuePage from '@/pages/doctor/DoctorQueuePage'

import ConsultationPage from '@/pages/doctor/ConsultationPage'
import SalesPage from '@/pages/sales/SalesPage'

import POSPage from '@/pages/sales/POSPage'
import CategoriesPage from '@/pages/inventory/CategoriesPage'

import CreateTransferPage from '@/pages/inventory/CreateTransferPage'
import ImportDetailPage from '@/pages/inventory/ImportDetailPage'

import WarehouseDetailPage from '@/pages/inventory/WarehouseDetailPage'
import InventoryPage from '@/pages/inventory/InventoryPage'

import ProductsPage from '@/pages/inventory/ProductsPage'
import ProductDetailPage from '@/pages/inventory/ProductDetailPage'

import AssetsPage from '@/pages/inventory/AssetsPage'
import MarketingPage from '@/pages/marketing/MarketingPage'

import AccountingPage from '@/pages/accounting/AccountingPage'
import TerminalPage from '@/pages/admin/TerminalPage'

import GlobalSearchPage from '@/pages/admin/GlobalSearchPage'
import AuditLogsPage from '@/pages/admin/AuditLogsPage'

import UserProfilePage from '@/pages/admin/UserProfilePage'
import PermissionManagerPage from '@/pages/admin/PermissionManagerPage'

import InsuranceCompaniesPage from '@/pages/admin/InsuranceCompaniesPage'
import RevenuePage from '@/pages/admin/RevenuePage'

import FundRequestsPage from '@/pages/FundRequestsPage'
import EmployeesPage from '@/pages/admin/EmployeesPage'

import EmployeeDetailPage from '@/pages/admin/EmployeeDetailPage'
import ReferralPaymentsPage from '@/pages/admin/ReferralPaymentsPage'

import AnalyticsPage from '@/pages/admin/AnalyticsPage'
import SettingsPage from '@/pages/admin/SettingsPage'
import SuperadminPage from '@/pages/admin/SuperadminPage'

import ProfilePage from '@/pages/ProfilePage'
import AttendancePage from '@/pages/AttendancePage'

import NotificationsPage from '@/pages/NotificationsPage'
import HelpPage from '@/pages/HelpPage'

import MessagesPage from '@/pages/MessagesPage'
import TechnicianDashboard from '@/pages/technician/TechnicianDashboard'

import ReferralsPage from '@/pages/technician/ReferralsPage'
import NewReferralPage from '@/pages/technician/NewReferralPage'

import ReferralDetailPage from '@/pages/technician/ReferralDetailPage'
import ScansPage from '@/pages/technician/ScansPage'

import NewScanPage from '@/pages/technician/NewScanPage'
import ScanDetailPage from '@/pages/technician/ScanDetailPage'

import ScanRequestsPage from '@/pages/technician/ScanRequestsPage'

function ProtectedRoute({ children, allowPasswordChange = false }: { children: React.ReactNode; allowPasswordChange?: boolean }) {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Check if user must change password (strictly enforced)
  if (user?.must_change_password && !allowPasswordChange) {
    return <Navigate to="/change-password" replace />
  }

  return <>{children}</>
}

// Hides a page from people whose role doesn't allow it (the server checks again on every request)
function Guard({ perms, children }: { perms: string[]; children: React.ReactNode }) {
  const { user } = useAuthStore()
  const allowed = perms.includes('__superadmin__')
    ? !!user?.is_superuser
    : hasPermission(user, perms)
  if (allowed) return <>{children}</>
  return (
    <EmptyState icon={MdLock} title="You don't have access to this page">
      Ask your administrator if you need it.
    </EmptyState>
  )
}

function App() {
  return (
    <OnboardingProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/register" element={<PatientSelfRegisterPage />} />
        <Route
          path="/change-password"
          element={
            <ProtectedRoute allowPasswordChange>
              <ChangePasswordPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <ActivityTracker />
              <AdminLayout>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/patients" element={<Guard perms={['patients.view']}><PatientsPage /></Guard>} />
                  <Route path="/patients/:id" element={<Guard perms={['patients.view']}><PatientDetailPage /></Guard>} />
                  <Route path="/patients/:patientId/visits/:visitId" element={<Guard perms={['patients.view','visits.view']}><VisitDetailPage /></Guard>} />
                  <Route path="/sales" element={<Guard perms={['sales.view']}><SalesPage /></Guard>} />
                  <Route path="/sales/pos" element={<Guard perms={['pos.access']}><POSPage /></Guard>} />
                  <Route path="/inventory" element={<Guard perms={['inventory.view','inventory.manage']}><InventoryPage /></Guard>} />
                  <Route path="/inventory/products" element={<Guard perms={['inventory.view','inventory.manage']}><ProductsPage /></Guard>} />
                  <Route path="/inventory/products/new" element={<Guard perms={['inventory.manage']}><ProductDetailPage /></Guard>} />
                  <Route path="/inventory/products/:productId" element={<Guard perms={['inventory.view','inventory.manage']}><ProductDetailPage /></Guard>} />
                  <Route path="/inventory/imports/:importId" element={<Guard perms={['inventory.manage']}><ImportDetailPage /></Guard>} />
                  <Route path="/inventory/transfers/new" element={<Guard perms={['inventory.manage','inventory.transfer']}><CreateTransferPage /></Guard>} />
                  <Route path="/inventory/warehouse/:warehouseId" element={<Guard perms={['inventory.view','inventory.manage']}><WarehouseDetailPage /></Guard>} />
                  <Route path="/inventory/categories" element={<Guard perms={['inventory.manage']}><CategoriesPage /></Guard>} />
                  <Route path="/inventory/assets" element={<Guard perms={['assets.view','assets.manage']}><AssetsPage /></Guard>} />
                  <Route path="/marketing" element={<Guard perms={['marketing.view']}><MarketingPage /></Guard>} />
                  <Route path="/accounting" element={<Guard perms={['accounting.view']}><AccountingPage /></Guard>} />
                  <Route path="/doctor/queue" element={<Guard perms={['clinical.queue']}><DoctorQueuePage /></Guard>} />
                  <Route path="/doctor/consultation/:visitId" element={<Guard perms={['clinical.create','clinical.view']}><ConsultationPage /></Guard>} />
                  <Route path="/frontdesk" element={<Guard perms={['dashboard.frontdesk','visits.create']}><FrontDeskPage /></Guard>} />
                  <Route path="/frontdesk/register" element={<Guard perms={['patients.create']}><PatientRegistrationPage /></Guard>} />
                  <Route path="/frontdesk/checkout/:visitId" element={<Guard perms={['payments.create','payments.view']}><CheckoutPage /></Guard>} />
                  <Route path="/dashboard/frontdesk" element={<FrontDeskDashboard />} />
                  <Route path="/dashboard/doctor" element={<DoctorDashboard />} />
                  <Route path="/dashboard/marketing" element={<MarketingDashboard />} />
                  <Route path="/superadmin" element={<Guard perms={['__superadmin__']}><SuperadminPage /></Guard>} />
                  <Route path="/admin/settings" element={<Guard perms={['settings.manage']}><SettingsPage /></Guard>} />
                  <Route path="/admin/users" element={<Guard perms={['settings.manage']}><SettingsPage /></Guard>} />
                  <Route path="/admin/terminal" element={<Guard perms={['__superadmin__']}><TerminalPage /></Guard>} />
                  <Route path="/admin/revenue" element={<Guard perms={['revenue.view']}><RevenuePage /></Guard>} />
                  <Route path="/admin/employees" element={<Guard perms={['employees.view','employees.manage']}><EmployeesPage /></Guard>} />
                  <Route path="/admin/employees/:employeeId" element={<EmployeeDetailPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/attendance" element={<AttendancePage />} />
                  <Route path="/admin/permissions" element={<Guard perms={['__superadmin__']}><PermissionManagerPage /></Guard>} />
                  <Route path="/admin/analytics" element={<Guard perms={['analytics.view']}><AnalyticsPage /></Guard>} />
                  <Route path="/fund-requests" element={<FundRequestsPage />} />
                  <Route path="/fund-requests/:requestId" element={<FundRequestsPage />} />
                  <Route path="/admin/fund-requests" element={<FundRequestsPage />} />
                  <Route path="/admin/fund-requests/:requestId" element={<FundRequestsPage />} />
                  <Route path="/messages" element={<MessagesPage />} />
                  <Route path="/messages/:conversationId" element={<MessagesPage />} />
                  <Route path="/admin/user-profile/:userId" element={<Guard perms={['employees.view','employees.manage']}><UserProfilePage /></Guard>} />
                  <Route path="/help" element={<HelpPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />

                  {/* Technician Routes */}
                  <Route path="/technician" element={<Guard perms={['technician.view']}><TechnicianDashboard /></Guard>} />
                  <Route path="/technician/dashboard" element={<Guard perms={['technician.view']}><TechnicianDashboard /></Guard>} />
                  <Route path="/technician/referrals" element={<Guard perms={['technician.referrals']}><ReferralsPage /></Guard>} />
                  <Route path="/technician/referrals/new" element={<Guard perms={['technician.referrals']}><NewReferralPage /></Guard>} />
                  <Route path="/technician/referrals/:referralId" element={<Guard perms={['technician.referrals']}><ReferralDetailPage /></Guard>} />
                  <Route path="/technician/scans" element={<Guard perms={['technician.scans','clinical.view']}><ScansPage /></Guard>} />
                  <Route path="/technician/scans/new" element={<Guard perms={['technician.scans']}><NewScanPage /></Guard>} />
                  <Route path="/technician/scans/:scanId" element={<Guard perms={['technician.scans','clinical.view']}><ScanDetailPage /></Guard>} />
                  <Route path="/technician/scan-requests" element={<Guard perms={['technician.scans']}><ScanRequestsPage /></Guard>} />
                  <Route path="/technician/doctors" element={<Guard perms={['technician.referrals']}><ReferralsPage /></Guard>} />

                  {/* Admin Referral Payments */}
                  <Route path="/admin/referral-payments" element={<Guard perms={['referrals.payments','referrals.payments.manage']}><ReferralPaymentsPage /></Guard>} />
                  <Route path="/admin/search" element={<Guard perms={['analytics.view']}><GlobalSearchPage /></Guard>} />
                  <Route path="/admin/audit-logs" element={<Guard perms={['audit.view']}><AuditLogsPage /></Guard>} />
                  <Route path="/admin/insurance" element={<Guard perms={['settings.manage']}><InsuranceCompaniesPage /></Guard>} />
                </Routes>
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <OnboardingOverlay />
    </OnboardingProvider>
  )
}

export default App
