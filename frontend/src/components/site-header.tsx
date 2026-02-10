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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Building2, ChevronDown } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

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
  const { user, setUser } = useAuthStore()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  
  const pageTitle = pageTitles[location.pathname] || "Kountry Eyecare"

  // Fetch user's accessible branches
  const { data: userBranches = [] } = useQuery({
    queryKey: ['user-branches'],
    queryFn: async () => {
      const response = await api.get('/users/me/branches')
      return response.data
    },
    enabled: !!user,
  })

  // Switch branch mutation
  const switchBranchMutation = useMutation({
    mutationFn: (branchId: number) => api.post(`/users/me/switch-branch/${branchId}`),
    onSuccess: (response) => {
      setUser(response.data.user)
      queryClient.invalidateQueries()
      toast({ title: 'Branch switched successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to switch branch', variant: 'destructive' })
    },
  })

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
          userBranches.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full hover:bg-primary/20 transition-colors cursor-pointer">
                <Building2 className="h-3 w-3 text-primary" />
                <span className="text-xs font-medium text-primary">
                  {typeof user.branch === 'string' ? user.branch : user.branch.name}
                </span>
                <ChevronDown className="h-3 w-3 text-primary" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {userBranches.map((branch: any) => (
                  <DropdownMenuItem
                    key={branch.id}
                    onClick={() => switchBranchMutation.mutate(branch.id)}
                    className={branch.id === (typeof user.branch === 'object' ? user.branch.id : null) ? 'bg-primary/10' : ''}
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    {branch.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
              <Building2 className="h-3 w-3 text-primary" />
              <span className="text-xs font-medium text-primary">
                {typeof user.branch === 'string' ? user.branch : user.branch.name}
              </span>
            </div>
          )
        )}
        <span className="text-sm text-muted-foreground">
          {user?.first_name} {user?.last_name}
        </span>
      </div>
    </header>
  )
}
