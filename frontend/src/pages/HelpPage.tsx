import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { useOnboarding, pageTutorials } from '@/contexts/OnboardingContext';
import { shortcutsList } from '@/hooks/useKeyboardShortcuts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Play,
  LayoutDashboard,
  Users,
  Package,
  Receipt,
  Stethoscope,
  ClipboardList,
  Building2,
  Megaphone,
  BarChart3,
  ShoppingCart,
  Clock,
  MessageSquare,
  FileText,
  Settings,
  HelpCircle,
  BookOpen,
  Video,
  Lightbulb,
  ChevronRight,
  Eye,
  Scan,
  UserPlus,
} from 'lucide-react';

interface HelpSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  details: string[];
  tips?: string[];
}

const adminHelpSections: HelpSection[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    description: 'Your central command center showing key business metrics and quick actions.',
    details: [
      'View today\'s appointments and patient count',
      'Monitor daily, weekly, and monthly revenue',
      'See pending tasks and notifications',
      'Quick access to common actions like registering patients',
      'Overview of staff attendance and branch performance',
    ],
    tips: [
      'Check the dashboard first thing in the morning for an overview',
      'Use the date filters to compare performance across periods',
    ],
  },
  {
    id: 'frontdesk',
    title: 'Front Desk',
    icon: <ClipboardList className="h-5 w-5" />,
    description: 'Manage patient check-ins, appointments, and the daily queue.',
    details: [
      'Register new patients with complete demographic information',
      'Check in existing patients for their appointments',
      'Create new visits and assign to doctors',
      'View and manage the patient queue',
      'Update patient contact information',
      'Print patient cards and receipts',
      'Review and approve self-registered patients from the Registrations tab',
    ],
    tips: [
      'Always verify patient phone numbers during check-in',
      'Use the search function to quickly find returning patients',
      'Check the New Registrations card on your dashboard for patients who registered via the public form',
      'Click on the New Registrations card to go directly to pending registrations',
    ],
  },
  {
    id: 'pos',
    title: 'Point of Sale (POS)',
    icon: <ShoppingCart className="h-5 w-5" />,
    description: 'Process sales transactions for products and services.',
    details: [
      'Add products to cart by scanning or searching',
      'Apply discounts (percentage or fixed amount)',
      'Process multiple payment methods (cash, card, mobile money)',
      'Generate and print receipts',
      'Handle returns and refunds',
      'View transaction history',
    ],
    tips: [
      'Always confirm the total with the customer before processing',
      'Use the barcode scanner for faster product entry',
    ],
  },
  {
    id: 'patients',
    title: 'Patient Management',
    icon: <Users className="h-5 w-5" />,
    description: 'Complete patient records, history, and medical information.',
    details: [
      'View complete patient profiles with contact info',
      'Access visit history and consultation notes',
      'Review prescriptions and lens orders',
      'Track patient purchases and payments',
      'Export patient data for reports',
      'Manage patient documents and images',
    ],
    tips: [
      'Keep patient records updated after each visit',
      'Use tags to categorize patients (VIP, insurance, etc.)',
    ],
  },
  {
    id: 'doctor-queue',
    title: 'Doctor Queue',
    icon: <Stethoscope className="h-5 w-5" />,
    description: 'Clinical queue management for doctors and optometrists.',
    details: [
      'View patients waiting for consultation',
      'Start consultations with one click',
      'Record clinical findings and measurements',
      'Prescribe lenses and treatments',
      'Add clinical notes and recommendations',
      'Complete visits and send to dispensing',
    ],
    tips: [
      'Review patient history before starting consultation',
      'Use templates for common prescriptions',
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory Management',
    icon: <Package className="h-5 w-5" />,
    description: 'Track stock levels, manage products, and handle transfers.',
    details: [
      'View real-time stock levels across all branches',
      'Add new products with pricing and categories',
      'Create stock transfers between branches',
      'Record stock imports and adjustments',
      'Set low stock alerts and reorder points',
      'Generate inventory reports',
    ],
    tips: [
      'Do regular stock counts to maintain accuracy',
      'Set up automatic low stock notifications',
    ],
  },
  {
    id: 'sales',
    title: 'Sales & Revenue',
    icon: <Receipt className="h-5 w-5" />,
    description: 'Track sales performance and revenue analytics.',
    details: [
      'View daily, weekly, and monthly sales reports',
      'Analyze revenue by product category',
      'Track payment methods and outstanding balances',
      'Compare performance across branches',
      'Export sales data for accounting',
      'Monitor staff sales performance',
    ],
    tips: [
      'Review sales reports weekly to identify trends',
      'Use filters to analyze specific product categories',
    ],
  },
  {
    id: 'employees',
    title: 'Employee Management',
    icon: <Users className="h-5 w-5" />,
    description: 'Manage staff, roles, permissions, and attendance.',
    details: [
      'Add new employees with role assignments',
      'Manage user permissions and access levels',
      'Track attendance and clock-in/out times',
      'Assign employees to branches',
      'View employee performance metrics',
      'Handle leave requests and schedules',
    ],
    tips: [
      'Review permissions regularly for security',
      'Set up branch-specific access for multi-location staff',
    ],
  },
  {
    id: 'branches',
    title: 'Branch Management',
    icon: <Building2 className="h-5 w-5" />,
    description: 'Configure and manage multiple clinic locations.',
    details: [
      'Add new branch locations',
      'Set branch-specific work hours',
      'Configure geolocation for attendance',
      'Manage branch inventory separately',
      'View branch-specific reports',
      'Transfer stock between branches',
    ],
    tips: [
      'Keep branch contact information updated',
      'Set appropriate geofence radius for attendance',
    ],
  },
  {
    id: 'marketing',
    title: 'Marketing',
    icon: <Megaphone className="h-5 w-5" />,
    description: 'Manage campaigns, leads, and patient outreach.',
    details: [
      'Create and track marketing campaigns',
      'Manage leads and follow-ups',
      'Send SMS and email campaigns',
      'Track campaign ROI and conversions',
      'Segment patients for targeted marketing',
      'Schedule automated reminders',
    ],
    tips: [
      'Follow up on leads within 24 hours',
      'Use patient segments for personalized campaigns',
    ],
  },
  {
    id: 'accounting',
    title: 'Accounting',
    icon: <BarChart3 className="h-5 w-5" />,
    description: 'Financial management, expenses, and reporting.',
    details: [
      'Track income and expenses',
      'Manage petty cash and fund requests',
      'Generate financial reports',
      'Record supplier payments',
      'Track outstanding receivables',
      'Export data for external accounting',
    ],
    tips: [
      'Reconcile accounts daily',
      'Keep receipts for all expenses',
    ],
  },
  {
    id: 'messages',
    title: 'Messages',
    icon: <MessageSquare className="h-5 w-5" />,
    description: 'Internal communication between staff members.',
    details: [
      'Send messages to individual staff or groups',
      'Create announcements for all staff',
      'Share files and documents',
      'Receive notifications for new messages',
      'Search message history',
    ],
    tips: [
      'Use announcements for important updates',
      'Check messages regularly throughout the day',
    ],
  },
  {
    id: 'memos',
    title: 'Memos & Fund Requests',
    icon: <FileText className="h-5 w-5" />,
    description: 'Submit and approve fund requests and memos.',
    details: [
      'Create fund requests with justification',
      'Attach supporting documents',
      'Track approval status',
      'Approve or reject requests (managers)',
      'View request history',
    ],
    tips: [
      'Provide detailed justification for faster approval',
      'Attach receipts or quotes when available',
    ],
  },
  {
    id: 'attendance',
    title: 'Attendance',
    icon: <Clock className="h-5 w-5" />,
    description: 'Clock in/out and track work hours.',
    details: [
      'Clock in at the start of your shift',
      'Clock out when leaving',
      'View your attendance history',
      'See late arrivals and early departures',
      'Request attendance corrections',
    ],
    tips: [
      'Clock in as soon as you arrive',
      'Enable location services for accurate check-in',
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: <Settings className="h-5 w-5" />,
    description: 'System configuration and preferences.',
    details: [
      'Configure system-wide settings',
      'Manage payment methods',
      'Set up receipt templates',
      'Configure notification preferences',
      'Manage integrations',
    ],
    tips: [
      'Backup settings before making major changes',
      'Test changes in a single branch first',
    ],
  },
];

const doctorHelpSections: HelpSection[] = [
  {
    id: 'queue',
    title: 'Doctor Queue',
    icon: <Stethoscope className="h-5 w-5" />,
    description: 'View and manage patients waiting for your consultation.',
    details: [
      'See all patients assigned to you',
      'View patient chief complaints before consultation',
      'Start consultation with one click',
      'Prioritize urgent cases',
      'Track consultation duration',
    ],
    tips: [
      'Review patient history before starting',
      'Keep notes concise but complete',
    ],
  },
  {
    id: 'consultation',
    title: 'Consultation',
    icon: <ClipboardList className="h-5 w-5" />,
    description: 'Conduct patient examinations and record findings.',
    details: [
      'Record visual acuity measurements',
      'Document refraction results',
      'Prescribe corrective lenses',
      'Add clinical notes and diagnoses',
      'Recommend treatments and follow-ups',
      'Order additional tests if needed',
    ],
    tips: [
      'Use the AI assistant for prescription suggestions',
      'Always verify prescription with patient',
    ],
  },
  {
    id: 'patients',
    title: 'Patient Records',
    icon: <Users className="h-5 w-5" />,
    description: 'Access complete patient medical history.',
    details: [
      'View previous consultations',
      'Review past prescriptions',
      'See lens and frame purchases',
      'Access uploaded documents and images',
      'Track patient progress over time',
    ],
    tips: [
      'Compare current findings with previous visits',
      'Note any significant changes in condition',
    ],
  },
];

const frontdeskHelpSections: HelpSection[] = [
  {
    id: 'frontdesk',
    title: 'Front Desk Dashboard',
    icon: <ClipboardList className="h-5 w-5" />,
    description: 'Your main workspace for patient management.',
    details: [
      'View today\'s appointments',
      'Check in arriving patients',
      'Register new patients',
      'Create visits and assign to doctors',
      'Manage the patient queue',
      'Handle walk-in patients',
    ],
    tips: [
      'Greet patients warmly',
      'Verify contact information at each visit',
    ],
  },
  {
    id: 'registration',
    title: 'Patient Registration',
    icon: <Users className="h-5 w-5" />,
    description: 'Register new patients in the system.',
    details: [
      'Collect patient demographics',
      'Record contact information',
      'Note insurance details if applicable',
      'Capture emergency contact',
      'Assign to appropriate branch',
    ],
    tips: [
      'Double-check phone numbers',
      'Ask for preferred contact method',
    ],
  },
  {
    id: 'pos',
    title: 'Payments',
    icon: <ShoppingCart className="h-5 w-5" />,
    description: 'Process patient payments.',
    details: [
      'Collect consultation fees',
      'Process product purchases',
      'Handle multiple payment methods',
      'Issue receipts',
      'Record partial payments',
    ],
    tips: [
      'Always give receipts',
      'Confirm amount before processing',
    ],
  },
];

const technicianHelpSections: HelpSection[] = [
  {
    id: 'technician-dashboard',
    title: 'Technician Dashboard',
    icon: <Eye className="h-5 w-5" />,
    description: 'Overview of your daily technician tasks and pending work.',
    details: [
      'View pending scan requests from doctors',
      'See today\'s completed scans',
      'Track external referrals',
      'Monitor scan revenue',
      'Quick access to new scan and referral forms',
    ],
    tips: [
      'Check the dashboard at the start of each shift',
      'Prioritize pending scan requests from doctors',
    ],
  },
  {
    id: 'scans',
    title: 'Scans Management',
    icon: <Scan className="h-5 w-5" />,
    description: 'Perform and manage OCT, VFT, Fundus, and Pachymeter scans.',
    details: [
      'Create new scans for patients',
      'Upload scan result PDFs',
      'Record scan findings and summaries',
      'Mark scans as completed or reviewed',
      'Process scan payments',
      'Set scan pricing for each type',
    ],
    tips: [
      'Always upload the PDF result after completing a scan',
      'Add detailed notes for the reviewing doctor',
    ],
  },
  {
    id: 'scan-requests',
    title: 'Scan Requests',
    icon: <ClipboardList className="h-5 w-5" />,
    description: 'View and process scan requests from doctors.',
    details: [
      'See all pending scan requests',
      'View requesting doctor and patient info',
      'Accept and perform requested scans',
      'Mark requests as completed',
      'Process payments for completed scans',
    ],
    tips: [
      'Process scan requests promptly',
      'Notify the doctor when scan is ready for review',
    ],
  },
  {
    id: 'referrals',
    title: 'External Referrals',
    icon: <UserPlus className="h-5 w-5" />,
    description: 'Manage patients referred from external doctors.',
    details: [
      'Register external referral doctors',
      'Record patient referrals with scan requests',
      'Track referral sources and payments',
      'Manage referral doctor commissions',
      'Generate referral reports',
    ],
    tips: [
      'Keep referral doctor contact info updated',
      'Track referral payments for accurate commission calculation',
    ],
  },
];

const marketingHelpSections: HelpSection[] = [
  {
    id: 'marketing',
    title: 'Marketing Dashboard',
    icon: <Megaphone className="h-5 w-5" />,
    description: 'Manage all marketing activities.',
    details: [
      'Create marketing campaigns',
      'Track campaign performance',
      'Manage leads and prospects',
      'Schedule follow-ups',
      'Analyze conversion rates',
    ],
    tips: [
      'Set clear campaign goals',
      'Track ROI for all campaigns',
    ],
  },
  {
    id: 'leads',
    title: 'Lead Management',
    icon: <Users className="h-5 w-5" />,
    description: 'Track and convert potential patients.',
    details: [
      'Add new leads from various sources',
      'Assign leads to team members',
      'Track lead status and progress',
      'Schedule follow-up calls',
      'Convert leads to patients',
    ],
    tips: [
      'Follow up within 24 hours',
      'Personalize your approach',
    ],
  },
];

// FAQs for all users
const faqs = [
  {
    question: 'How do I register a new patient?',
    answer: 'Go to Front Desk or Patients page and click "Register Patient" or "Add Patient". Fill in the required information including name, phone number, and any other details. The patient will be assigned a unique ID automatically.',
  },
  {
    question: 'How do I process a sale?',
    answer: 'Navigate to the POS (Point of Sale) page. Search for products or scan barcodes to add items to the cart. Apply any discounts if needed, then select the payment method and complete the transaction. A receipt will be generated automatically.',
  },
  {
    question: 'How do I clock in/out?',
    answer: 'Click on "Attendance" in the sidebar footer. You\'ll see a Clock In button when you arrive and Clock Out when leaving. If your branch requires location verification, make sure to allow location access.',
  },
  {
    question: 'How do I view a patient\'s history?',
    answer: 'Go to the Patients page and search for the patient by name, phone, or ID. Click on their name to view their full profile including visit history, prescriptions, and purchases.',
  },
  {
    question: 'How do I transfer stock between branches?',
    answer: 'Go to Inventory, then click on "Transfers" or "New Transfer". Select the source and destination branches, add the products and quantities, then submit the transfer request.',
  },
  {
    question: 'How do I reset my password?',
    answer: 'Go to your Profile page and click on "Change Password". Enter your current password and your new password twice to confirm. Contact your administrator if you forgot your current password.',
  },
  {
    question: 'How do I send a message to another staff member?',
    answer: 'Go to the Messages page from the sidebar. Click "New Message", select the recipient(s), type your message, and send. You can also attach files if needed.',
  },
  {
    question: 'How do I submit a fund request?',
    answer: 'Go to Memos/Fund Requests page. Click "New Request", fill in the amount, purpose, and attach any supporting documents. Submit for approval by your manager.',
  },
  {
    question: 'How do I perform a scan for a patient?',
    answer: 'Go to Technician > Scans and click "New Scan". Select the patient, scan type (OCT, VFT, Fundus, or Pachymeter), and fill in the details. After performing the scan, upload the PDF result and add any findings.',
  },
  {
    question: 'How do I view scan requests from doctors?',
    answer: 'Go to Technician > Scan Requests to see all pending scan requests. You can filter by status or scan type. Click on a request to view details and process it.',
  },
  {
    question: 'How do I record an external referral?',
    answer: 'Go to Technician > Referrals and click "New Referral". Select or add the referring doctor, enter patient details, and specify the requested scans. The referral will be tracked for payment and commission purposes.',
  },
];

// Page tutorials available
const availablePageTutorials = [
  { path: '/', title: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { path: '/frontdesk', title: 'Front Desk', icon: <ClipboardList className="h-4 w-4" /> },
  { path: '/sales/pos', title: 'Point of Sale', icon: <ShoppingCart className="h-4 w-4" /> },
  { path: '/patients', title: 'Patients', icon: <Users className="h-4 w-4" /> },
  { path: '/doctor/queue', title: 'Doctor Queue', icon: <Stethoscope className="h-4 w-4" /> },
  { path: '/inventory', title: 'Inventory', icon: <Package className="h-4 w-4" /> },
  { path: '/admin/employees', title: 'Employees', icon: <Users className="h-4 w-4" /> },
  { path: '/marketing', title: 'Marketing', icon: <Megaphone className="h-4 w-4" /> },
  { path: '/accounting', title: 'Accounting', icon: <BarChart3 className="h-4 w-4" /> },
  { path: '/technician', title: 'Technician Dashboard', icon: <Eye className="h-4 w-4" /> },
  { path: '/technician/scans', title: 'Scans', icon: <Scan className="h-4 w-4" /> },
  { path: '/technician/scan-requests', title: 'Scan Requests', icon: <ClipboardList className="h-4 w-4" /> },
  { path: '/technician/referrals', title: 'Referrals', icon: <UserPlus className="h-4 w-4" /> },
];

export default function HelpPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { startOnboarding, startPageTutorial } = useOnboarding();
  const [activeTab, setActiveTab] = useState('guide');

  const handlePageTutorial = (path: string) => {
    navigate(path);
    setTimeout(() => {
      startPageTutorial(path);
    }, 500);
  };

  const getUserRole = (): string => {
    if (user?.is_superuser) return 'admin';
    const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name;
    return roleName?.toLowerCase() || 'staff';
  };

  const userRole = getUserRole();

  const getHelpSections = (): HelpSection[] => {
    switch (userRole) {
      case 'admin':
        return adminHelpSections;
      case 'doctor':
      case 'optometrist':
        return doctorHelpSections;
      case 'frontdesk':
      case 'front_desk':
      case 'receptionist':
        return frontdeskHelpSections;
      case 'marketing':
        return marketingHelpSections;
      case 'technician':
        return technicianHelpSections;
      default:
        return frontdeskHelpSections;
    }
  };

  const helpSections = getHelpSections();

  const getRoleTitle = (): string => {
    switch (userRole) {
      case 'admin':
        return 'Administrator';
      case 'doctor':
      case 'optometrist':
        return 'Doctor / Optometrist';
      case 'frontdesk':
      case 'front_desk':
      case 'receptionist':
        return 'Front Desk';
      case 'marketing':
        return 'Marketing';
      case 'technician':
        return 'Technician';
      default:
        return 'Staff';
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <HelpCircle className="h-8 w-8 text-primary" />
            Help Center
          </h1>
          <p className="text-muted-foreground mt-1">
            Welcome, {user?.first_name}! Here's everything you need to know about using Kountry Eyecare.
          </p>
        </div>
        <Button onClick={() => startOnboarding()} className="gap-2">
          <Play className="h-4 w-4" />
          Start Tutorial
        </Button>
      </div>

      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Video className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">Interactive Tutorial</h3>
              <p className="text-sm text-muted-foreground">
                New to the system? Take our guided tour to learn the basics in just a few minutes.
              </p>
            </div>
            <Button variant="outline" onClick={() => startOnboarding()} className="gap-2">
              <Play className="h-4 w-4" />
              Watch Tutorial
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="guide" className="gap-2">
            <BookOpen className="h-4 w-4" />
            User Guide
          </TabsTrigger>
          <TabsTrigger value="tutorials" className="gap-2">
            <Video className="h-4 w-4" />
            Page Tutorials
          </TabsTrigger>
          <TabsTrigger value="faqs" className="gap-2">
            <HelpCircle className="h-4 w-4" />
            FAQs
          </TabsTrigger>
          <TabsTrigger value="tips" className="gap-2">
            <Lightbulb className="h-4 w-4" />
            Quick Tips
          </TabsTrigger>
        </TabsList>

        <TabsContent value="guide" className="mt-6">
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="secondary" className="text-sm">
              {getRoleTitle()} Guide
            </Badge>
            <span className="text-sm text-muted-foreground">
              Showing help topics relevant to your role
            </span>
          </div>

          <Accordion type="single" collapsible className="space-y-2">
            {helpSections.map((section) => (
              <AccordionItem
                key={section.id}
                value={section.id}
                className="border rounded-lg px-4"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      {section.icon}
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold">{section.title}</h3>
                      <p className="text-sm text-muted-foreground font-normal">
                        {section.description}
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4 pb-6">
                  <div className="space-y-4 pl-13">
                    <div>
                      <h4 className="font-medium mb-2">What you can do:</h4>
                      <ul className="space-y-2">
                        {section.details.map((detail, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
                            {detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {section.tips && section.tips.length > 0 && (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                        <h4 className="font-medium mb-2 flex items-center gap-2 text-primary">
                          <Lightbulb className="h-4 w-4" />
                          Pro Tips
                        </h4>
                        <ul className="space-y-1">
                          {section.tips.map((tip, index) => (
                            <li key={index} className="text-sm text-muted-foreground">
                              • {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>

        <TabsContent value="tutorials" className="mt-6">
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Click on any page below to navigate there and start an interactive tutorial for that specific page.
            </p>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {availablePageTutorials.map((tutorial) => (
                <Card
                  key={tutorial.path}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => handlePageTutorial(tutorial.path)}
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        {tutorial.icon}
                      </div>
                      <div>
                        <h3 className="font-medium">{tutorial.title}</h3>
                        <p className="text-xs text-muted-foreground">Click to start tutorial</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="faqs" className="mt-6">
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`faq-${index}`}
                className="border rounded-lg px-4"
              >
                <AccordionTrigger className="hover:no-underline text-left">
                  <span className="font-medium">{faq.question}</span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>

        <TabsContent value="tips" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="border-primary/20 md:col-span-2 lg:col-span-3">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  Keyboard Shortcuts
                </CardTitle>
                <CardDescription>Use these shortcuts to navigate faster</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {shortcutsList.map((shortcut, index) => (
                    <div key={index} className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                      <span className="text-sm">{shortcut.description}</span>
                      <kbd className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-mono">{shortcut.keys}</kbd>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Daily Checklist
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• Clock in when you arrive</p>
                <p>• Check dashboard for today's overview</p>
                <p>• Review pending tasks and messages</p>
                <p>• Clock out before leaving</p>
              </CardContent>
            </Card>

            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-primary" />
                  Need More Help?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Contact your supervisor or administrator for:</p>
                <p>• Permission issues</p>
                <p>• Technical problems</p>
                <p>• Training requests</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
