"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

interface CollapsibleProps {
  children: React.ReactNode
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

interface CollapsibleTriggerProps {
  children: React.ReactNode
  className?: string
  asChild?: boolean
}

interface CollapsibleContentProps {
  children: React.ReactNode
  className?: string
}

const CollapsibleContext = React.createContext<{
  open: boolean
  setOpen: (open: boolean) => void
}>({ open: true, setOpen: () => {} })

const Collapsible = React.forwardRef<HTMLDivElement, CollapsibleProps>(
  ({ children, defaultOpen = true, open: controlledOpen, onOpenChange, className }, ref) => {
    const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
    const open = controlledOpen !== undefined ? controlledOpen : internalOpen
    
    const setOpen = React.useCallback((value: boolean) => {
      setInternalOpen(value)
      onOpenChange?.(value)
    }, [onOpenChange])

    return (
      <CollapsibleContext.Provider value={{ open, setOpen }}>
        <div ref={ref} className={className}>
          {children}
        </div>
      </CollapsibleContext.Provider>
    )
  }
)
Collapsible.displayName = "Collapsible"

const CollapsibleTrigger = React.forwardRef<HTMLButtonElement, CollapsibleTriggerProps>(
  ({ children, className, asChild }, ref) => {
    const { open, setOpen } = React.useContext(CollapsibleContext)
    
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        onClick: (e: React.MouseEvent) => {
          setOpen(!open)
          // Call original onClick if exists
          const originalOnClick = (children as React.ReactElement<any>).props?.onClick
          if (originalOnClick) originalOnClick(e)
        },
        ref,
      })
    }
    
    return (
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen(!open)}
        className={cn("flex w-full items-center justify-between", className)}
      >
        {children}
        <ChevronDown 
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )} 
        />
      </button>
    )
  }
)
CollapsibleTrigger.displayName = "CollapsibleTrigger"

const CollapsibleContent = React.forwardRef<HTMLDivElement, CollapsibleContentProps>(
  ({ children, className }, ref) => {
    const { open } = React.useContext(CollapsibleContext)
    
    if (!open) return null
    
    return (
      <div 
        ref={ref} 
        className={cn("overflow-hidden", className)}
      >
        {children}
      </div>
    )
  }
)
CollapsibleContent.displayName = "CollapsibleContent"

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
