import { useNavigate } from 'react-router-dom'
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  Icon,
  Kbd,
  ListItem,
  SimpleGrid,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  UnorderedList,
  useColorModeValue,
} from '@chakra-ui/react'
import type { IconType } from 'react-icons'
import {
  MdAccessTime,
  MdApartment,
  MdAssignment,
  MdBarChart,
  MdCampaign,
  MdChevronRight,
  MdDashboard,
  MdDescription,
  MdDocumentScanner,
  MdHelpOutline,
  MdInventory2,
  MdLightbulbOutline,
  MdLocalHospital,
  MdMenuBook,
  MdMessage,
  MdOndemandVideo,
  MdPeople,
  MdPersonAdd,
  MdPlayArrow,
  MdReceipt,
  MdSettings,
  MdShoppingCart,
  MdVisibility,
} from 'react-icons/md'
import { useAuthStore } from '@/stores/auth'
import { getUserRole } from '@/config/nav'
import { useOnboarding } from '@/contexts/OnboardingContext'
import { shortcutsList } from '@/hooks/useKeyboardShortcuts'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import SectionCard from '@/components/card/SectionCard'

interface HelpSection {
  id: string
  title: string
  icon: IconType
  description: string
  details: string[]
  tips?: string[]
}

const adminHelpSections: HelpSection[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: MdDashboard,
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
    icon: MdAssignment,
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
    icon: MdShoppingCart,
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
    icon: MdPeople,
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
    icon: MdLocalHospital,
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
    icon: MdInventory2,
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
    icon: MdReceipt,
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
    icon: MdPeople,
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
    icon: MdApartment,
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
    icon: MdCampaign,
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
    icon: MdBarChart,
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
    icon: MdMessage,
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
    icon: MdDescription,
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
    icon: MdAccessTime,
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
    icon: MdSettings,
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
]

const doctorHelpSections: HelpSection[] = [
  {
    id: 'queue',
    title: 'Doctor Queue',
    icon: MdLocalHospital,
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
    icon: MdAssignment,
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
    icon: MdPeople,
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
]

const frontdeskHelpSections: HelpSection[] = [
  {
    id: 'frontdesk',
    title: 'Front Desk Dashboard',
    icon: MdAssignment,
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
    icon: MdPeople,
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
    icon: MdShoppingCart,
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
]

const technicianHelpSections: HelpSection[] = [
  {
    id: 'technician-dashboard',
    title: 'Technician Dashboard',
    icon: MdVisibility,
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
    icon: MdDocumentScanner,
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
    icon: MdAssignment,
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
    icon: MdPersonAdd,
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
]

const marketingHelpSections: HelpSection[] = [
  {
    id: 'marketing',
    title: 'Marketing Dashboard',
    icon: MdCampaign,
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
    icon: MdPeople,
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
]

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
    answer: 'Go to your Profile page and click on "Change Password". Enter your current password and your new password twice to confirm. If you forgot it, use "Forgot password" on the sign-in page to get a reset link by email.',
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
]

// Page tutorials available
const availablePageTutorials = [
  { path: '/', title: 'Dashboard', icon: MdDashboard },
  { path: '/frontdesk', title: 'Front Desk', icon: MdAssignment },
  { path: '/sales/pos', title: 'Point of Sale', icon: MdShoppingCart },
  { path: '/patients', title: 'Patients', icon: MdPeople },
  { path: '/doctor/queue', title: 'Doctor Queue', icon: MdLocalHospital },
  { path: '/inventory', title: 'Inventory', icon: MdInventory2 },
  { path: '/admin/employees', title: 'Employees', icon: MdPeople },
  { path: '/marketing', title: 'Marketing', icon: MdCampaign },
  { path: '/accounting', title: 'Accounting', icon: MdBarChart },
  { path: '/technician', title: 'Technician Dashboard', icon: MdVisibility },
  { path: '/technician/scans', title: 'Scans', icon: MdDocumentScanner },
  { path: '/technician/scan-requests', title: 'Scan Requests', icon: MdAssignment },
  { path: '/technician/referrals', title: 'Referrals', icon: MdPersonAdd },
];


const ROLE_SECTIONS: Record<string, [string, HelpSection[]]> = {
  admin: ['Administrator', adminHelpSections],
  doctor: ['Doctor / Optometrist', doctorHelpSections],
  optometrist: ['Doctor / Optometrist', doctorHelpSections],
  frontdesk: ['Front Desk', frontdeskHelpSections],
  front_desk: ['Front Desk', frontdeskHelpSections],
  receptionist: ['Front Desk', frontdeskHelpSections],
  marketing: ['Marketing', marketingHelpSections],
  technician: ['Technician', technicianHelpSections],
}

function IconTile({ icon }: { icon: IconType }) {
  return (
    <Flex w="40px" h="40px" borderRadius="12px" bg="brand.50" _dark={{ bg: 'whiteAlpha.100' }} color="brand.500" align="center" justify="center" flexShrink={0}>
      <Icon as={icon} w="20px" h="20px" />
    </Flex>
  )
}

export default function HelpPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { startOnboarding, startPageTutorial } = useOnboarding()
  const itemBorder = useColorModeValue('gray.200', 'whiteAlpha.200')
  const itemBg = useColorModeValue('white', 'navy.800')
  const mutedBg = useColorModeValue('secondaryGray.100', 'whiteAlpha.50')

  const handlePageTutorial = (path: string) => {
    navigate(path)
    setTimeout(() => startPageTutorial(path), 500)
  }

  const userRole = getUserRole(user)
  const [roleTitle, helpSections] = ROLE_SECTIONS[userRole] || ['Staff', frontdeskHelpSections]

  const cardTitle = (icon: IconType, text: string) => (
    <Flex align="center" gap="8px">
      <Icon as={icon} color="brand.500" />
      {text}
    </Flex>
  )

  return (
    <>
      <PageHeader
        title="Help Center"
        description={`Welcome, ${user?.first_name}! Here's everything you need to know about using Kountry Eyecare.`}
        actions={
          <Button variant="brand" leftIcon={<MdPlayArrow />} onClick={() => startOnboarding()}>
            Start Tutorial
          </Button>
        }
      />

      <Card mb="20px" bgGradient="linear(to-r, rgba(76,155,79,0.12), rgba(76,155,79,0.04))" border="1px solid" borderColor="brand.100" _dark={{ borderColor: 'whiteAlpha.200' }}>
        <Flex align="center" gap="16px" wrap="wrap">
          <Flex w="48px" h="48px" borderRadius="full" bg="brand.100" color="brand.500" align="center" justify="center">
            <Icon as={MdOndemandVideo} w="24px" h="24px" />
          </Flex>
          <Box flex="1" minW="200px">
            <Heading size="sm">Interactive Tutorial</Heading>
            <Text fontSize="sm" color="secondaryGray.600">
              New to the system? Take our guided tour to learn the basics in just a few minutes.
            </Text>
          </Box>
          <Button variant="light" leftIcon={<MdPlayArrow />} onClick={() => startOnboarding()}>
            Watch Tutorial
          </Button>
        </Flex>
      </Card>

      <Tabs variant="soft-rounded" isLazy>
        <TabList gap="8px" mb="20px" flexWrap="wrap">
          {[
            { icon: MdMenuBook, label: 'User Guide' },
            { icon: MdOndemandVideo, label: 'Page Tutorials' },
            { icon: MdHelpOutline, label: 'FAQs' },
            { icon: MdLightbulbOutline, label: 'Quick Tips' },
          ].map((t) => (
            <Tab key={t.label}>
              <Icon as={t.icon} me="8px" />
              {t.label}
            </Tab>
          ))}
        </TabList>

        <TabPanels>
          <TabPanel p="0">
            <Flex align="center" gap="8px" mb="16px">
              <Badge colorScheme="green">{roleTitle} Guide</Badge>
              <Text fontSize="sm" color="secondaryGray.600">
                Showing help topics relevant to your role
              </Text>
            </Flex>
            <Accordion allowToggle>
              <Stack spacing="8px">
                {helpSections.map((section) => (
                  <AccordionItem key={section.id} border="1px solid" borderColor={itemBorder} borderRadius="16px" bg={itemBg}>
                    <AccordionButton py="14px" borderRadius="16px" _hover={{ bg: 'transparent' }}>
                      <Flex flex="1" align="center" gap="12px" textAlign="left">
                        <IconTile icon={section.icon} />
                        <Box>
                          <Text fontWeight="700">{section.title}</Text>
                          <Text fontSize="sm" color="secondaryGray.600">
                            {section.description}
                          </Text>
                        </Box>
                      </Flex>
                      <AccordionIcon />
                    </AccordionButton>
                    <AccordionPanel pb="20px" ps={{ base: '16px', md: '68px' }}>
                      <Text fontWeight="600" mb="8px">
                        What you can do:
                      </Text>
                      <UnorderedList spacing="6px" fontSize="sm" mb="16px">
                        {section.details.map((detail, index) => (
                          <ListItem key={index}>{detail}</ListItem>
                        ))}
                      </UnorderedList>
                      {section.tips && section.tips.length > 0 && (
                        <Box bg="brand.50" _dark={{ bg: 'whiteAlpha.100' }} border="1px solid" borderColor="brand.100" borderRadius="12px" p="16px">
                          <Flex align="center" gap="8px" color="brand.500" fontWeight="600" mb="8px">
                            <Icon as={MdLightbulbOutline} />
                            Pro Tips
                          </Flex>
                          <Stack spacing="4px">
                            {section.tips.map((tip, index) => (
                              <Text key={index} fontSize="sm" color="secondaryGray.600">
                                • {tip}
                              </Text>
                            ))}
                          </Stack>
                        </Box>
                      )}
                    </AccordionPanel>
                  </AccordionItem>
                ))}
              </Stack>
            </Accordion>
          </TabPanel>

          <TabPanel p="0">
            <Text color="secondaryGray.600" mb="16px">
              Click on any page below to navigate there and start an interactive tutorial for that specific page.
            </Text>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing="12px">
              {availablePageTutorials.map((tutorial) => (
                <Card
                  key={tutorial.path}
                  p="16px"
                  cursor="pointer"
                  border="1px solid"
                  borderColor="transparent"
                  _hover={{ borderColor: 'brand.300' }}
                  onClick={() => handlePageTutorial(tutorial.path)}
                >
                  <Flex align="center" justify="space-between">
                    <Flex align="center" gap="12px">
                      <IconTile icon={tutorial.icon} />
                      <Box>
                        <Text fontWeight="600">{tutorial.title}</Text>
                        <Text fontSize="xs" color="secondaryGray.600">
                          Click to start tutorial
                        </Text>
                      </Box>
                    </Flex>
                    <Icon as={MdChevronRight} w="20px" h="20px" color="secondaryGray.600" />
                  </Flex>
                </Card>
              ))}
            </SimpleGrid>
          </TabPanel>

          <TabPanel p="0">
            <Accordion allowToggle>
              <Stack spacing="8px">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} border="1px solid" borderColor={itemBorder} borderRadius="16px" bg={itemBg}>
                    <AccordionButton py="14px" borderRadius="16px" _hover={{ bg: 'transparent' }}>
                      <Text flex="1" textAlign="left" fontWeight="600">
                        {faq.question}
                      </Text>
                      <AccordionIcon />
                    </AccordionButton>
                    <AccordionPanel pb="16px" color="secondaryGray.600">
                      {faq.answer}
                    </AccordionPanel>
                  </AccordionItem>
                ))}
              </Stack>
            </Accordion>
          </TabPanel>

          <TabPanel p="0">
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing="20px">
              <SectionCard gridColumn={{ md: 'span 2', lg: 'span 3' }} title={cardTitle(MdLightbulbOutline, 'Keyboard Shortcuts')} description="Use these shortcuts to navigate faster">
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing="8px">
                  {shortcutsList.map((shortcut, index) => (
                    <Flex key={index} justify="space-between" align="center" p="8px" borderRadius="8px" bg={mutedBg}>
                      <Text fontSize="sm">{shortcut.description}</Text>
                      <Kbd>{shortcut.keys}</Kbd>
                    </Flex>
                  ))}
                </SimpleGrid>
              </SectionCard>

              <SectionCard title={cardTitle(MdAccessTime, 'Daily Checklist')}>
                <Stack spacing="8px" fontSize="sm" color="secondaryGray.600">
                  <Text>• Clock in when you arrive</Text>
                  <Text>• Check dashboard for today's overview</Text>
                  <Text>• Review pending tasks and messages</Text>
                  <Text>• Clock out before leaving</Text>
                </Stack>
              </SectionCard>

              <SectionCard title={cardTitle(MdHelpOutline, 'Need More Help?')}>
                <Stack spacing="8px" fontSize="sm" color="secondaryGray.600">
                  <Text>Contact your supervisor or administrator for:</Text>
                  <Text>• Permission issues</Text>
                  <Text>• Technical problems</Text>
                  <Text>• Training requests</Text>
                </Stack>
              </SectionCard>
            </SimpleGrid>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </>
  )
}
