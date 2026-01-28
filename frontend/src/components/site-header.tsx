"use client"

import { useAuthStore } from "@/stores/auth"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { useLocation } from "react-router-dom"
import NotificationDropdown from "@/components/NotificationDropdown"

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/frontdesk": "Front Desk",
  "/doctor/queue": "Doctor Queue",
  "/patients": "Patients",
  "/sales": "Sales",
  "/inventory": "Inventory",
  "/assets": "Assets",
  "/marketing": "Marketing",
  "/accounting": "Accounting",
  "/admin/branches": "Branches",
}

export function SiteHeader() {
  const location = useLocation()
  const { user } = useAuthStore()
  
  const pageTitle = pageTitles[location.pathname] || "Kountry Eyecare"

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex flex-1 items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex items-center gap-3">
        <NotificationDropdown />
        {user?.branch && (
          <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
            <span className="text-xs font-medium text-primary">
              {typeof user.branch === 'string' ? user.branch : user.branch.name}
            </span>
          </div>
        )}
        <span className="text-sm text-muted-foreground">
          {user?.first_name} {user?.last_name}
        </span>
      </div>
    </header>
  )
}
