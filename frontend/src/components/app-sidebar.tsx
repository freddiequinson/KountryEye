"use client"

import * as React from "react"
import { useLocation, useNavigate } from "react-router-dom"
import {
  LayoutDashboard,
  Users,
  Package,
  Receipt,
  BarChart3,
  Megaphone,
  Wrench,
  Building2,
  Stethoscope,
  ClipboardList,
  Settings,
  HelpCircle,
  LogOut,
  UserCog,
  DollarSign,
  ShoppingBag,
  FolderOpen,
  UsersRound,
  User,
  Clock,
  ShoppingCart,
  KeyRound,
  Home,
  Briefcase,
  Shield,
  ChevronRight,
  TrendingUp,
  FileText,
  MessageSquare,
} from "lucide-react"

import { useAuthStore } from "@/stores/auth"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

type NavItem = {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  roles?: string[]
  permissions?: string[]  // Permission codes required
}

const allNavItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, permissions: ["dashboard.view"] },
  { title: "Attendance", url: "/attendance", icon: Clock, permissions: ["attendance.view"] },
  { title: "Front Desk", url: "/frontdesk", icon: ClipboardList, permissions: ["dashboard.frontdesk", "visits.create"] },
  { title: "POS", url: "/sales/pos", icon: ShoppingCart, permissions: ["pos.access"] },
  { title: "Doctor Queue", url: "/doctor/queue", icon: Stethoscope, permissions: ["clinical.queue"] },
  { title: "Patients", url: "/patients", icon: Users, permissions: ["patients.view"] },
  { title: "Sales", url: "/sales", icon: Receipt, permissions: ["sales.view"] },
  { title: "Inventory", url: "/inventory", icon: Package, permissions: ["inventory.view"] },
  { title: "Products", url: "/inventory/products", icon: ShoppingBag, permissions: ["inventory.view"] },
  { title: "Categories", url: "/inventory/categories", icon: FolderOpen, permissions: ["inventory.manage"] },
  { title: "Assets", url: "/inventory/assets", icon: Wrench, permissions: ["assets.view"] },
  { title: "Marketing", url: "/marketing", icon: Megaphone, permissions: ["marketing.view"] },
  { title: "Accounting", url: "/accounting", icon: BarChart3, permissions: ["accounting.view"] },
  { title: "Revenue", url: "/admin/revenue", icon: DollarSign, permissions: ["revenue.view"] },
  // Branches page removed - use Settings page instead
  // { title: "Branches", url: "/admin/branches", icon: Building2, permissions: ["branches.manage"] },
  { title: "Users", url: "/admin/users", icon: UserCog, permissions: ["employees.manage"] },
  { title: "Employees", url: "/admin/employees", icon: UsersRound, permissions: ["employees.view"] },
  { title: "Permissions", url: "/admin/permissions", icon: KeyRound, permissions: ["permissions.manage"] },
  { title: "Analytics", url: "/admin/analytics", icon: TrendingUp, permissions: ["analytics.view"] },
  { title: "Memos", url: "/fund-requests", icon: FileText, permissions: ["fund_requests.view"] },
  { title: "Messages", url: "/messages", icon: MessageSquare, permissions: ["messages.view"] },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarInnerContent />
      <SidebarRail />
    </Sidebar>
  )
}

function SidebarInnerContent() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'
  const [openSection, setOpenSection] = React.useState<string | null>('main')
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false)

  const handleLogout = () => {
    setShowLogoutConfirm(false)
    logout()
    navigate("/login")
  }

  const getUserRole = (): string => {
    if (user?.is_superuser) return "admin"
    // role can be string or object with name property
    const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name
    return roleName?.toLowerCase() || "staff"
  }

  const userRole = getUserRole()
  
  // Get user permissions - from the permissions array in user object
  const userPermissions: string[] = user?.permissions || []
  
  // If user has no permissions assigned, they should still see basic navigation
  const hasNoPermissions = userPermissions.length === 0 && !user?.is_superuser
  
  // Debug: log permissions
  console.log('User permissions:', userPermissions, 'Role:', userRole, 'Is superuser:', user?.is_superuser, 'Has no permissions:', hasNoPermissions)
  
  // Check if user has any of the required permissions
  const hasPermission = (permCodes: string[] | undefined): boolean => {
    if (!permCodes || permCodes.length === 0) return true
    if (user?.is_superuser) return true
    // If user has no permissions at all, show basic items (Dashboard, Attendance, Messages)
    if (hasNoPermissions) {
      const basicPermissions = ["dashboard.view", "attendance.view", "messages.view"]
      return permCodes.some(code => basicPermissions.includes(code))
    }
    // Check if user has any of the required permissions
    return permCodes.some(code => userPermissions.includes(code))
  }

  const filterByPermission = (items: NavItem[]) => {
    return items.filter((item) => {
      // Check permissions first
      if (item.permissions) {
        return hasPermission(item.permissions)
      }
      // Fallback to role-based filtering
      if (!item.roles) return true
      if (userRole === "admin") return true
      return item.roles.includes(userRole)
    })
  }

  const mainItems = filterByPermission(allNavItems.filter(i => 
    ["/", "/attendance", "/frontdesk", "/sales/pos", "/doctor/queue", "/patients", "/fund-requests", "/messages"].includes(i.url)
  ))
  
  const managementItems = filterByPermission(allNavItems.filter(i => 
    ["/sales", "/inventory", "/inventory/products", "/inventory/categories", "/inventory/assets"].includes(i.url)
  ))
  
  const adminItems = filterByPermission(allNavItems.filter(i => 
    ["/marketing", "/accounting", "/admin/revenue", "/admin/users", "/admin/employees", "/admin/permissions", "/admin/analytics"].includes(i.url)
  ))

  const getRoleDisplayName = () => {
    if (user?.is_superuser) return "System Administrator"
    switch (userRole) {
      case "doctor": return "Doctor"
      case "optometrist": return "Optometrist"
      case "front_desk": return "Front Desk"
      case "receptionist": return "Receptionist"
      case "sales": return "Sales Staff"
      case "inventory": return "Inventory Manager"
      case "manager": return "Manager"
      case "accounting": return "Accountant"
      case "marketing": return "Marketing"
      default: return "Staff"
    }
  }

  return (
    <>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              onClick={() => navigate("/")}
            >
              <img src="/kountry-sidebarilogo.png" alt="Kountry Eyecare" className="h-8 w-8 rounded" data-tour="sidebar-logo" />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Kountry Eyecare</span>
                <span className="truncate text-xs text-muted-foreground">
                  {getRoleDisplayName()}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {mainItems.length > 0 && (
          <Collapsible 
            open={!isCollapsed && openSection === 'main'} 
            onOpenChange={(open) => setOpenSection(open ? 'main' : null)}
          >
            <SidebarGroup>
              <SidebarMenu>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip="Main"
                      className="w-full justify-center group-data-[collapsible=icon]:justify-center"
                      data-tour="section-main"
                    >
                      <Home className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">Main</span>
                      <ChevronRight className={`h-4 w-4 shrink-0 transition-transform duration-200 group-data-[collapsible=icon]:hidden ${openSection === 'main' ? 'rotate-90' : ''}`} />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                </SidebarMenuItem>
              </SidebarMenu>
              <CollapsibleContent>
                <SidebarGroupContent className="pl-4">
                  <SidebarMenu>
                    {mainItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          tooltip={item.title}
                          isActive={location.pathname === item.url}
                          onClick={() => navigate(item.url)}
                          data-tour={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <item.icon />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}

        {managementItems.length > 0 && (
          <Collapsible 
            open={!isCollapsed && openSection === 'management'} 
            onOpenChange={(open) => setOpenSection(open ? 'management' : null)}
          >
            <SidebarGroup>
              <SidebarMenu>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip="Management"
                      className="w-full justify-center group-data-[collapsible=icon]:justify-center"
                      data-tour="section-management"
                    >
                      <Briefcase className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">Management</span>
                      <ChevronRight className={`h-4 w-4 shrink-0 transition-transform duration-200 group-data-[collapsible=icon]:hidden ${openSection === 'management' ? 'rotate-90' : ''}`} />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                </SidebarMenuItem>
              </SidebarMenu>
              <CollapsibleContent>
                <SidebarGroupContent className="pl-4">
                  <SidebarMenu>
                    {managementItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          tooltip={item.title}
                          isActive={location.pathname === item.url}
                          onClick={() => navigate(item.url)}
                          data-tour={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <item.icon />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}

        {adminItems.length > 0 && (
          <Collapsible 
            open={!isCollapsed && openSection === 'admin'} 
            onOpenChange={(open) => setOpenSection(open ? 'admin' : null)}
          >
            <SidebarGroup>
              <SidebarMenu>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip="Administration"
                      className="w-full justify-center group-data-[collapsible=icon]:justify-center"
                      data-tour="section-admin"
                    >
                      <Shield className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">Administration</span>
                      <ChevronRight className={`h-4 w-4 shrink-0 transition-transform duration-200 group-data-[collapsible=icon]:hidden ${openSection === 'admin' ? 'rotate-90' : ''}`} />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                </SidebarMenuItem>
              </SidebarMenu>
              <CollapsibleContent>
                <SidebarGroupContent className="pl-4">
                  <SidebarMenu>
                    {adminItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          tooltip={item.title}
                          isActive={location.pathname === item.url}
                          onClick={() => navigate(item.url)}
                          data-tour={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <item.icon />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="My Profile"
              isActive={location.pathname === "/profile"}
              onClick={() => navigate("/profile")}
              data-tour="nav-profile"
            >
              <User />
              <span>My Profile</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Clock In/Out"
              isActive={location.pathname === "/attendance"}
              onClick={() => navigate("/attendance")}
            >
              <Clock />
              <span>Attendance</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {userRole === "admin" && (
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Settings"
                isActive={location.pathname === "/admin/settings"}
                onClick={() => navigate("/admin/settings")}
              >
                <Settings />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Help"
              isActive={location.pathname === "/help"}
              onClick={() => navigate("/help")}
              data-tour="nav-help"
            >
              <HelpCircle />
              <span>Help</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Logout" onClick={() => setShowLogoutConfirm(true)}>
              <LogOut />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      {/* Logout Confirmation Dialog */}
      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>
              Are you sure you want to logout? You will need to sign in again to access the system.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogoutConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              Yes, Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
