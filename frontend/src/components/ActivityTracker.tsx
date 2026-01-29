import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { activityLogger } from '@/lib/activityLogger';

const PAGE_NAMES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/patients': 'Patients List',
  '/pos': 'Point of Sale',
  '/inventory': 'Inventory',
  '/products': 'Products',
  '/categories': 'Categories',
  '/assets': 'Assets',
  '/frontdesk': 'Front Desk',
  '/doctor-queue': 'Doctor Queue',
  '/messages': 'Messages',
  '/attendance': 'Attendance',
  '/settings': 'Settings',
  '/profile': 'My Profile',
  '/notifications': 'Notifications',
  '/admin/employees': 'Employees',
  '/admin/permissions': 'Permissions',
  '/admin/analytics': 'Analytics',
  '/admin/revenue': 'Revenue',
  '/accounting': 'Accounting',
  '/marketing': 'Marketing',
  '/fund-requests': 'Fund Requests',
  '/help': 'Help',
};

export function ActivityTracker() {
  const location = useLocation();
  const lastPath = useRef<string>('');

  useEffect(() => {
    // Don't log if same path (e.g., query param changes)
    if (location.pathname === lastPath.current) return;
    lastPath.current = location.pathname;

    // Get page name
    let pageName = PAGE_NAMES[location.pathname];
    
    // Handle dynamic routes
    if (!pageName) {
      if (location.pathname.startsWith('/patients/')) {
        pageName = 'Patient Detail';
      } else if (location.pathname.startsWith('/products/')) {
        pageName = 'Product Detail';
      } else if (location.pathname.startsWith('/admin/employees/')) {
        pageName = 'Employee Detail';
      } else if (location.pathname.startsWith('/admin/user-profile/')) {
        pageName = 'User Profile';
      } else if (location.pathname.startsWith('/consultation/')) {
        pageName = 'Consultation';
      } else if (location.pathname.startsWith('/visit/')) {
        pageName = 'Visit Detail';
      } else {
        // Use path as fallback
        pageName = location.pathname.split('/').filter(Boolean).join(' > ') || 'Home';
      }
    }

    // Log the page view
    activityLogger.pageView(pageName);
  }, [location.pathname]);

  return null;
}

export default ActivityTracker;
