import type { IconType } from 'react-icons'
import {
  MdAccessTime,
  MdAssignment,
  MdAttachMoney,
  MdBadge,
  MdBarChart,
  MdBuild,
  MdCampaign,
  MdDashboard,
  MdDescription,
  MdFolderOpen,
  MdHome,
  MdInventory2,
  MdMessage,
  MdPeople,
  MdPointOfSale,
  MdReceiptLong,
  MdSearch,
  MdSettings,
  MdShield,
  MdShoppingBag,
  MdTrendingUp,
  MdVisibility,
  MdVpnKey,
  MdWork,
} from 'react-icons/md'
import { FaStethoscope } from 'react-icons/fa'
import type { User } from '@/stores/auth'

export type NavItem = {
  title: string
  url: string
  icon: IconType
  roles?: string[]
  permissions?: string[] // Permission codes required
}

export type NavSection = { id: string; title: string; icon: IconType; items: NavItem[] }

const allNavItems: NavItem[] = [
  { title: 'Dashboard', url: '/', icon: MdDashboard, permissions: ['dashboard.view'] },
  { title: 'Attendance', url: '/attendance', icon: MdAccessTime, permissions: ['attendance.view'] },
  { title: 'Front Desk', url: '/frontdesk', icon: MdAssignment, permissions: ['dashboard.frontdesk', 'visits.create'] },
  { title: 'POS', url: '/sales/pos', icon: MdPointOfSale, permissions: ['pos.access'] },
  { title: 'Doctor Queue', url: '/doctor/queue', icon: FaStethoscope, permissions: ['clinical.queue'] },
  { title: 'Patients', url: '/patients', icon: MdPeople, permissions: ['patients.view'] },
  { title: 'Sales', url: '/sales', icon: MdReceiptLong, permissions: ['sales.view'] },
  { title: 'Inventory', url: '/inventory', icon: MdInventory2, permissions: ['inventory.view'] },
  { title: 'Products', url: '/inventory/products', icon: MdShoppingBag, permissions: ['inventory.view'] },
  { title: 'Categories', url: '/inventory/categories', icon: MdFolderOpen, permissions: ['inventory.manage'] },
  { title: 'Assets', url: '/inventory/assets', icon: MdBuild, permissions: ['assets.view'] },
  { title: 'Marketing', url: '/marketing', icon: MdCampaign, permissions: ['marketing.view'] },
  { title: 'Accounting', url: '/accounting', icon: MdBarChart, permissions: ['accounting.view'] },
  { title: 'Revenue', url: '/admin/revenue', icon: MdAttachMoney, permissions: ['revenue.view'] },
  { title: 'Insurance', url: '/admin/insurance', icon: MdShield, permissions: ['settings.manage'], roles: ['admin'] },
  { title: 'Employees', url: '/admin/employees', icon: MdBadge, permissions: ['employees.view'] },
  { title: 'Permissions', url: '/admin/permissions', icon: MdVpnKey, permissions: ['permissions.manage'] },
  { title: 'Analytics', url: '/admin/analytics', icon: MdTrendingUp, permissions: ['analytics.view'] },
  { title: 'Memos', url: '/fund-requests', icon: MdDescription, permissions: ['fund_requests.view'] },
  { title: 'Messages', url: '/messages', icon: MdMessage, permissions: ['messages.view'] },
  // Technician items
  { title: 'Technician', url: '/technician', icon: MdVisibility, permissions: ['technician.view'], roles: ['technician'] },
  { title: 'Scan Requests', url: '/technician/scan-requests', icon: MdAssignment, permissions: ['technician.scans'], roles: ['technician'] },
  { title: 'Referrals', url: '/technician/referrals', icon: MdPeople, permissions: ['technician.referrals'], roles: ['technician'] },
  { title: 'Scans', url: '/technician/scans', icon: MdVisibility, permissions: ['technician.scans'], roles: ['technician'] },
  { title: 'Referral Payments', url: '/admin/referral-payments', icon: MdAttachMoney, permissions: ['referrals.payments'] },
  { title: 'Search', url: '/admin/search', icon: MdSearch, permissions: ['analytics.view'] },
  { title: 'Audit Logs', url: '/admin/audit-logs', icon: MdAssignment, permissions: ['analytics.view'] },
  { title: 'Settings', url: '/admin/settings', icon: MdSettings, permissions: ['settings.manage'] },
]

export function getUserRole(user: User | null): string {
  if (user?.is_superuser) return 'admin'
  // role can be string or object with name property
  const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name
  return roleName?.toLowerCase() || 'staff'
}

export function getRoleDisplayName(user: User | null): string {
  if (user?.is_superuser) return 'System Administrator'
  const names: Record<string, string> = {
    doctor: 'Doctor',
    optometrist: 'Optometrist',
    front_desk: 'Front Desk',
    receptionist: 'Receptionist',
    sales: 'Sales Staff',
    inventory: 'Inventory Manager',
    manager: 'Manager',
    accounting: 'Accountant',
    marketing: 'Marketing',
    technician: 'Clinical Technician',
  }
  return names[getUserRole(user)] || 'Staff'
}

// Check if user has any of the required permissions
export function hasPermission(user: User | null, permCodes: string[] | undefined): boolean {
  if (!permCodes || permCodes.length === 0) return true
  if (user?.is_superuser) return true
  const userPermissions = user?.permissions || []
  // If user has no permissions at all, show basic items (Dashboard, Attendance, Messages)
  if (userPermissions.length === 0) {
    const basicPermissions = ['dashboard.view', 'attendance.view', 'messages.view']
    return permCodes.some((code) => basicPermissions.includes(code))
  }
  return permCodes.some((code) => userPermissions.includes(code))
}

export function getNavSections(user: User | null): NavSection[] {
  const userRole = getUserRole(user)
  const isTechnician = userRole === 'technician'

  const visible = (item: NavItem) => {
    if (item.permissions) return hasPermission(user, item.permissions)
    // Fallback to role-based filtering
    if (!item.roles || userRole === 'admin') return true
    return item.roles.includes(userRole)
  }
  const pick = (urls: string[]) => allNavItems.filter((i) => urls.includes(i.url) && visible(i))

  const sections: NavSection[] = [
    {
      id: 'main',
      title: 'Main',
      icon: MdHome,
      // Technician sees: Dashboard (technician), Attendance, Messages, and technician-specific items
      items: pick(
        isTechnician
          ? ['/technician', '/attendance', '/fund-requests', '/messages']
          : ['/', '/attendance', '/frontdesk', '/sales/pos', '/doctor/queue', '/patients', '/fund-requests', '/messages'],
      ),
    },
    {
      id: 'technician',
      title: 'Technician',
      icon: MdVisibility,
      items: pick(['/technician/scan-requests', '/technician/referrals', '/technician/scans']),
    },
    {
      id: 'management',
      title: 'Management',
      icon: MdWork,
      items: pick(['/sales', '/inventory', '/inventory/products', '/inventory/categories', '/inventory/assets']),
    },
    {
      id: 'admin',
      title: 'Administration',
      icon: MdShield,
      items: pick([
        '/marketing',
        '/accounting',
        '/admin/revenue',
        '/admin/insurance',
        '/admin/employees',
        '/admin/permissions',
        '/admin/analytics',
        '/admin/referral-payments',
        '/admin/search',
        '/admin/audit-logs',
      ]),
    },
  ]
  return sections.filter((s) => s.items.length > 0)
}

const extraTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/frontdesk': 'Front Desk Dashboard',
  '/dashboard/doctor': 'Doctor Dashboard',
  '/dashboard/marketing': 'Marketing Dashboard',
  '/technician/dashboard': 'Technician',
  '/technician/doctors': 'Referring Doctors',
  '/frontdesk/register': 'Register Patient',
  '/inventory/products/new': 'New Product',
  '/inventory/transfers/new': 'New Transfer',
  '/technician/referrals/new': 'New Referral',
  '/technician/scans/new': 'New Scan',
  '/admin/users': 'Settings',
  '/admin/terminal': 'Terminal',
  '/admin/fund-requests': 'Memos',
  '/profile': 'My Profile',
  '/notifications': 'Notifications',
  '/help': 'Help',
}

const dynamicTitles: [RegExp, string][] = [
  [/^\/patients\/[^/]+\/visits\//, 'Visit Details'],
  [/^\/patients\//, 'Patient Details'],
  [/^\/doctor\/consultation\//, 'Consultation'],
  [/^\/frontdesk\/checkout\//, 'Checkout'],
  [/^\/inventory\/products\//, 'Product Details'],
  [/^\/inventory\/imports\//, 'Import Details'],
  [/^\/inventory\/warehouse\//, 'Warehouse'],
  [/^\/admin\/employees\//, 'Employee Details'],
  [/^\/admin\/user-profile\//, 'User Profile'],
  [/^\/(admin\/)?fund-requests\//, 'Memo'],
  [/^\/messages\//, 'Messages'],
  [/^\/technician\/referrals\//, 'Referral Details'],
  [/^\/technician\/scans\//, 'Scan Details'],
]

export function getPageTitle(pathname: string): string {
  const item = allNavItems.find((i) => i.url === pathname)
  if (item) return item.title
  if (extraTitles[pathname]) return extraTitles[pathname]
  return dynamicTitles.find(([re]) => re.test(pathname))?.[1] || 'Kountry Eyecare'
}
