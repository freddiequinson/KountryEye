import api from './api';

interface ActivityData {
  action: string;
  module?: string;
  description?: string;
  extra_data?: string;
  page_path?: string;
}

class ActivityLogger {
  private queue: ActivityData[] = [];
  private isProcessing = false;
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Flush queue every 5 seconds
    this.flushInterval = setInterval(() => this.flush(), 5000);
    
    // Flush on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flush());
    }
  }

  log(data: ActivityData) {
    // Add current page path if not provided
    if (!data.page_path && typeof window !== 'undefined') {
      data.page_path = window.location.pathname;
    }
    
    this.queue.push(data);
    
    // If queue gets large, flush immediately
    if (this.queue.length >= 10) {
      this.flush();
    }
  }

  // Convenience methods for common actions
  pageView(pageName: string, module?: string) {
    this.log({
      action: 'page_view',
      module: module || this.getModuleFromPath(),
      description: `Viewed ${pageName}`,
    });
  }

  action(action: string, module: string, description?: string, extraData?: Record<string, any>) {
    this.log({
      action,
      module,
      description,
      extra_data: extraData ? JSON.stringify(extraData) : undefined,
    });
  }

  // Common action shortcuts
  created(itemType: string, module: string, itemId?: number | string) {
    this.action('created', module, `Created ${itemType}${itemId ? ` #${itemId}` : ''}`);
  }

  updated(itemType: string, module: string, itemId?: number | string) {
    this.action('updated', module, `Updated ${itemType}${itemId ? ` #${itemId}` : ''}`);
  }

  deleted(itemType: string, module: string, itemId?: number | string) {
    this.action('deleted', module, `Deleted ${itemType}${itemId ? ` #${itemId}` : ''}`);
  }

  viewed(itemType: string, module: string, itemId?: number | string) {
    this.action('viewed', module, `Viewed ${itemType}${itemId ? ` #${itemId}` : ''}`);
  }

  exported(itemType: string, module: string, format?: string) {
    this.action('exported', module, `Exported ${itemType}${format ? ` as ${format}` : ''}`);
  }

  login() {
    this.action('login', 'auth', 'User logged in');
  }

  logout() {
    this.action('logout', 'auth', 'User logged out');
    this.flush(); // Flush immediately on logout
  }

  private getModuleFromPath(): string {
    if (typeof window === 'undefined') return 'unknown';
    
    const path = window.location.pathname;
    const segments = path.split('/').filter(Boolean);
    
    if (segments.length === 0) return 'dashboard';
    
    // Map common paths to modules
    const moduleMap: Record<string, string> = {
      'dashboard': 'dashboard',
      'patients': 'patients',
      'pos': 'sales',
      'inventory': 'inventory',
      'products': 'inventory',
      'messages': 'messaging',
      'admin': 'admin',
      'employees': 'admin',
      'permissions': 'admin',
      'settings': 'settings',
      'attendance': 'attendance',
      'frontdesk': 'frontdesk',
      'doctor': 'clinical',
      'consultations': 'clinical',
      'analytics': 'analytics',
      'reports': 'reports',
      'accounting': 'accounting',
      'marketing': 'marketing',
    };
    
    return moduleMap[segments[0]] || segments[0];
  }

  private async flush() {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    const itemsToSend = [...this.queue];
    this.queue = [];
    
    try {
      // Send activities one by one (could batch in future)
      for (const item of itemsToSend) {
        await api.post('/employees/activity', item).catch(() => {
          // Silently fail - don't interrupt user experience
        });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }
}

// Singleton instance
export const activityLogger = new ActivityLogger();

// React hook for page view tracking
export function usePageTracking(pageName: string, module?: string) {
  if (typeof window !== 'undefined') {
    // Log on mount
    activityLogger.pageView(pageName, module);
  }
}

export default activityLogger;
