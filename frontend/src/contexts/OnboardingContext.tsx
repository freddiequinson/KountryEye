import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';

export interface TutorialStep {
  id: string;
  target: string;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  page?: string;
}

// Page-specific tutorial steps
export const pageTutorials: Record<string, TutorialStep[]> = {
  '/': [
    { id: 'dashboard-welcome', target: '[data-tour="page-title"]', title: 'Dashboard Overview', description: 'This is your main dashboard showing key metrics and quick actions for your daily operations.', position: 'bottom' },
    { id: 'dashboard-stats', target: '[data-tour="stats-cards"]', title: 'Key Metrics', description: 'View today\'s patients, revenue, pending appointments, and other important statistics at a glance.', position: 'bottom' },
    { id: 'dashboard-actions', target: '[data-tour="quick-actions"]', title: 'Quick Actions', description: 'Use these buttons to quickly register patients, create visits, or access common tasks.', position: 'bottom' },
  ],
  '/frontdesk': [
    { id: 'fd-welcome', target: '[data-tour="page-title"]', title: 'Front Desk', description: 'This is your patient check-in and queue management center.', position: 'bottom' },
    { id: 'fd-queue', target: '[data-tour="patient-queue"]', title: 'Patient Queue', description: 'View all patients waiting to be seen. Click on a patient to view details or check them in.', position: 'right' },
    { id: 'fd-register', target: '[data-tour="register-btn"]', title: 'Register Patient', description: 'Click here to register a new patient or create a walk-in visit.', position: 'bottom' },
    { id: 'fd-search', target: '[data-tour="patient-search"]', title: 'Search Patients', description: 'Quickly find existing patients by name, phone number, or patient ID.', position: 'bottom' },
  ],
  '/sales/pos': [
    { id: 'pos-welcome', target: '[data-tour="page-title"]', title: 'Point of Sale', description: 'Process sales transactions for products and services.', position: 'bottom' },
    { id: 'pos-cart', target: '[data-tour="cart"]', title: 'Shopping Cart', description: 'Items added to the sale appear here. You can adjust quantities or remove items.', position: 'left' },
    { id: 'pos-products', target: '[data-tour="products"]', title: 'Products', description: 'Browse or search for products to add to the sale.', position: 'right' },
    { id: 'pos-payment', target: '[data-tour="payment"]', title: 'Payment', description: 'Select payment method and complete the transaction.', position: 'top' },
  ],
  '/patients': [
    { id: 'patients-welcome', target: '[data-tour="page-title"]', title: 'Patient Records', description: 'View and manage all patient records in the system.', position: 'bottom' },
    { id: 'patients-list', target: '[data-tour="patient-list"]', title: 'Patient List', description: 'Browse all patients. Click on a patient to view their full profile and history.', position: 'right' },
    { id: 'patients-search', target: '[data-tour="search"]', title: 'Search', description: 'Search patients by name, phone, or ID number.', position: 'bottom' },
    { id: 'patients-add', target: '[data-tour="add-patient"]', title: 'Add Patient', description: 'Register a new patient in the system.', position: 'left' },
  ],
  '/doctor/queue': [
    { id: 'dq-welcome', target: '[data-tour="page-title"]', title: 'Doctor Queue', description: 'View patients waiting for your consultation.', position: 'bottom' },
    { id: 'dq-list', target: '[data-tour="queue-list"]', title: 'Waiting Patients', description: 'Patients are listed in order of arrival. Click to start a consultation.', position: 'right' },
    { id: 'dq-start', target: '[data-tour="start-consultation"]', title: 'Start Consultation', description: 'Click on a patient to begin their examination and record findings.', position: 'bottom' },
  ],
  '/inventory': [
    { id: 'inv-welcome', target: '[data-tour="page-title"]', title: 'Inventory Management', description: 'Track and manage all products and stock levels.', position: 'bottom' },
    { id: 'inv-stock', target: '[data-tour="stock-levels"]', title: 'Stock Levels', description: 'View current stock quantities across all branches.', position: 'right' },
    { id: 'inv-low', target: '[data-tour="low-stock"]', title: 'Low Stock Alerts', description: 'Items running low are highlighted for reordering.', position: 'bottom' },
    { id: 'inv-transfer', target: '[data-tour="transfer"]', title: 'Stock Transfers', description: 'Transfer stock between branches as needed.', position: 'left' },
  ],
  '/admin/employees': [
    { id: 'emp-welcome', target: '[data-tour="page-title"]', title: 'Employee Management', description: 'Manage all staff members and their access.', position: 'bottom' },
    { id: 'emp-list', target: '[data-tour="employee-list"]', title: 'Employee List', description: 'View all employees, their roles, and assigned branches.', position: 'right' },
    { id: 'emp-add', target: '[data-tour="add-employee"]', title: 'Add Employee', description: 'Create new employee accounts and assign roles.', position: 'left' },
  ],
  '/marketing': [
    { id: 'mkt-welcome', target: '[data-tour="page-title"]', title: 'Marketing Dashboard', description: 'Manage campaigns and track marketing performance.', position: 'bottom' },
    { id: 'mkt-campaigns', target: '[data-tour="campaigns"]', title: 'Campaigns', description: 'View and manage all marketing campaigns.', position: 'right' },
    { id: 'mkt-leads', target: '[data-tour="leads"]', title: 'Leads', description: 'Track and follow up on potential patients.', position: 'bottom' },
  ],
  '/accounting': [
    { id: 'acc-welcome', target: '[data-tour="page-title"]', title: 'Accounting', description: 'Manage finances, expenses, and financial reports.', position: 'bottom' },
    { id: 'acc-summary', target: '[data-tour="summary"]', title: 'Financial Summary', description: 'View income, expenses, and profit overview.', position: 'right' },
    { id: 'acc-transactions', target: '[data-tour="transactions"]', title: 'Transactions', description: 'Review all financial transactions.', position: 'bottom' },
  ],
};

// Main onboarding tutorial steps for each role
export const adminTutorialSteps: TutorialStep[] = [
  { id: 'welcome', target: '[data-tour="sidebar-logo"]', title: 'Welcome to Kountry Eyecare!', description: 'This is your admin dashboard. Let\'s take a quick tour to help you get started with the system.', position: 'right' },
  { id: 'main-section', target: '[data-tour="section-main"]', title: 'Main Section', description: 'This section contains your primary daily tools: Dashboard, Front Desk, POS, Patients, and Messages.', position: 'right' },
  { id: 'dashboard', target: '[data-tour="nav-dashboard"]', title: 'Dashboard', description: 'Your central hub showing today\'s appointments, revenue metrics, and quick actions.', position: 'right' },
  { id: 'frontdesk', target: '[data-tour="nav-front-desk"]', title: 'Front Desk', description: 'Check in patients, create visits, and manage the patient queue.', position: 'right' },
  { id: 'pos', target: '[data-tour="nav-pos"]', title: 'Point of Sale', description: 'Process sales, apply discounts, and handle payments.', position: 'right' },
  { id: 'patients', target: '[data-tour="nav-patients"]', title: 'Patients', description: 'View all patient records, medical history, and visit details.', position: 'right' },
  { id: 'mgmt-section', target: '[data-tour="section-management"]', title: 'Management Section', description: 'Access sales reports, inventory, products, and asset management.', position: 'right' },
  { id: 'inventory', target: '[data-tour="nav-inventory"]', title: 'Inventory', description: 'Track stock levels, manage transfers, and monitor low stock items.', position: 'right' },
  { id: 'admin-section', target: '[data-tour="section-admin"]', title: 'Administration', description: 'Access marketing, accounting, revenue reports, branches, employees, and analytics.', position: 'right' },
  { id: 'employees', target: '[data-tour="nav-employees"]', title: 'Employees', description: 'Add staff, assign roles and permissions, and manage branches.', position: 'right' },
  { id: 'analytics', target: '[data-tour="nav-analytics"]', title: 'Analytics', description: 'View detailed reports, trends, and business insights.', position: 'right' },
  { id: 'profile', target: '[data-tour="nav-profile"]', title: 'Your Profile', description: 'Update your personal information and account settings.', position: 'right' },
  { id: 'help', target: '[data-tour="nav-help"]', title: 'Help Center', description: 'Access help documentation, FAQs, and restart tutorials for any page.', position: 'right' },
];

export const doctorTutorialSteps: TutorialStep[] = [
  { id: 'welcome', target: '[data-tour="sidebar-logo"]', title: 'Welcome, Doctor!', description: 'This is your clinical workspace. Let\'s explore the tools available to you.', position: 'right' },
  { id: 'main-section', target: '[data-tour="section-main"]', title: 'Your Main Tools', description: 'Access your queue, patient records, and messages from here.', position: 'right' },
  { id: 'queue', target: '[data-tour="nav-doctor-queue"]', title: 'Doctor Queue', description: 'View patients waiting for consultation. Click to start an examination.', position: 'right' },
  { id: 'patients', target: '[data-tour="nav-patients"]', title: 'Patient Records', description: 'Access complete patient history, prescriptions, and medical records.', position: 'right' },
  { id: 'messages', target: '[data-tour="nav-messages"]', title: 'Messages', description: 'Communicate with front desk and staff about patient needs.', position: 'right' },
  { id: 'profile', target: '[data-tour="nav-profile"]', title: 'Your Profile', description: 'Manage your profile and view consultation history.', position: 'right' },
  { id: 'help', target: '[data-tour="nav-help"]', title: 'Help Center', description: 'Access help documentation and page-specific tutorials.', position: 'right' },
];

export const frontdeskTutorialSteps: TutorialStep[] = [
  { id: 'welcome', target: '[data-tour="sidebar-logo"]', title: 'Welcome to Front Desk!', description: 'You\'re the first point of contact for patients. Let\'s learn your tools.', position: 'right' },
  { id: 'main-section', target: '[data-tour="section-main"]', title: 'Your Main Tools', description: 'These are your primary tools for managing patients and visits.', position: 'right' },
  { id: 'frontdesk', target: '[data-tour="nav-front-desk"]', title: 'Front Desk', description: 'Check in patients, create visits, and manage the queue.', position: 'right' },
  { id: 'patients', target: '[data-tour="nav-patients"]', title: 'Patients', description: 'Register new patients and update contact information.', position: 'right' },
  { id: 'pos', target: '[data-tour="nav-pos"]', title: 'Point of Sale', description: 'Process payments for consultations and products.', position: 'right' },
  { id: 'messages', target: '[data-tour="nav-messages"]', title: 'Messages', description: 'Communicate with doctors and other staff.', position: 'right' },
  { id: 'profile', target: '[data-tour="nav-profile"]', title: 'Your Profile', description: 'Update your personal information.', position: 'right' },
  { id: 'help', target: '[data-tour="nav-help"]', title: 'Help Center', description: 'Access help and page tutorials anytime.', position: 'right' },
];

export const marketingTutorialSteps: TutorialStep[] = [
  { id: 'welcome', target: '[data-tour="sidebar-logo"]', title: 'Welcome to Marketing!', description: 'Manage campaigns, track leads, and grow the business.', position: 'right' },
  { id: 'main-section', target: '[data-tour="section-main"]', title: 'Your Tools', description: 'Access your marketing dashboard and patient data.', position: 'right' },
  { id: 'marketing', target: '[data-tour="nav-marketing"]', title: 'Marketing Dashboard', description: 'Create campaigns, manage leads, and track performance.', position: 'right' },
  { id: 'patients', target: '[data-tour="nav-patients"]', title: 'Patient Data', description: 'View patient data for targeted marketing campaigns.', position: 'right' },
  { id: 'messages', target: '[data-tour="nav-messages"]', title: 'Messages', description: 'Coordinate with team members on campaigns.', position: 'right' },
  { id: 'profile', target: '[data-tour="nav-profile"]', title: 'Your Profile', description: 'Update your account settings.', position: 'right' },
  { id: 'help', target: '[data-tour="nav-help"]', title: 'Help Center', description: 'Access help documentation and tutorials.', position: 'right' },
];

interface OnboardingContextType {
  isOnboarding: boolean;
  currentStep: number;
  steps: TutorialStep[];
  currentTutorialType: 'main' | 'page';
  startOnboarding: (role?: string) => void;
  startPageTutorial: (pagePath: string) => void;
  stopOnboarding: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  hasCompletedOnboarding: boolean;
  markOnboardingComplete: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<TutorialStep[]>([]);
  const [currentTutorialType, setCurrentTutorialType] = useState<'main' | 'page'>('main');
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true);

  // Check if user has completed onboarding on mount
  useEffect(() => {
    if (user?.id) {
      const completedKey = `onboarding_completed_${user.id}`;
      const completed = localStorage.getItem(completedKey);
      setHasCompletedOnboarding(completed === 'true');
    }
  }, [user?.id]);

  const getUserRole = useCallback((): string => {
    if (user?.is_superuser) return 'admin';
    const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name;
    return roleName?.toLowerCase() || 'staff';
  }, [user]);

  const getStepsForRole = useCallback((role: string): TutorialStep[] => {
    switch (role) {
      case 'admin':
        return adminTutorialSteps;
      case 'doctor':
      case 'optometrist':
        return doctorTutorialSteps;
      case 'frontdesk':
      case 'front_desk':
      case 'receptionist':
        return frontdeskTutorialSteps;
      case 'marketing':
        return marketingTutorialSteps;
      default:
        return frontdeskTutorialSteps; // Default to frontdesk for other roles
    }
  }, []);

  const startOnboarding = useCallback((role?: string) => {
    const userRole = role || getUserRole();
    const tutorialSteps = getStepsForRole(userRole);
    setSteps(tutorialSteps);
    setCurrentStep(0);
    setCurrentTutorialType('main');
    setIsOnboarding(true);
  }, [getUserRole, getStepsForRole]);

  const startPageTutorial = useCallback((pagePath: string) => {
    const pageSteps = pageTutorials[pagePath];
    if (pageSteps && pageSteps.length > 0) {
      setSteps(pageSteps);
      setCurrentStep(0);
      setCurrentTutorialType('page');
      setIsOnboarding(true);
    }
  }, []);

  const stopOnboarding = useCallback(() => {
    setIsOnboarding(false);
    setCurrentStep(0);
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      stopOnboarding();
      markOnboardingComplete();
    }
  }, [currentStep, steps.length, stopOnboarding]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < steps.length) {
      setCurrentStep(step);
    }
  }, [steps.length]);

  const markOnboardingComplete = useCallback(() => {
    if (user?.id) {
      const completedKey = `onboarding_completed_${user.id}`;
      localStorage.setItem(completedKey, 'true');
      setHasCompletedOnboarding(true);
    }
  }, [user?.id]);

  // Auto-start onboarding for first-time users
  useEffect(() => {
    if (user?.id && !hasCompletedOnboarding && !isOnboarding) {
      // Small delay to let the UI render first
      const timer = setTimeout(() => {
        startOnboarding();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user?.id, hasCompletedOnboarding, isOnboarding, startOnboarding]);

  return (
    <OnboardingContext.Provider
      value={{
        isOnboarding,
        currentStep,
        steps,
        currentTutorialType,
        startOnboarding,
        startPageTutorial,
        stopOnboarding,
        nextStep,
        prevStep,
        goToStep,
        hasCompletedOnboarding,
        markOnboardingComplete,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
