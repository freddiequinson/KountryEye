"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export interface AttendanceEvent {
  id: string
  date: Date
  status: "present" | "absent" | "late" | "half_day" | "on_leave"
  clockIn?: string
  clockOut?: string
  notes?: string
}

export interface AttendanceCalendarProps {
  events?: AttendanceEvent[]
  onDateClick?: (date: Date) => void
  className?: string
}

const statusColors: Record<string, { bg: string; text: string }> = {
  present: { bg: "bg-green-500", text: "text-green-700" },
  absent: { bg: "bg-red-500", text: "text-red-700" },
  late: { bg: "bg-yellow-500", text: "text-yellow-700" },
  half_day: { bg: "bg-orange-500", text: "text-orange-700" },
  on_leave: { bg: "bg-blue-500", text: "text-blue-700" },
}

export function AttendanceCalendar({
  events = [],
  onDateClick,
  className,
}: AttendanceCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      newDate.setMonth(prev.getMonth() + (direction === "next" ? 1 : -1))
      return newDate
    })
  }

  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
  const startDate = new Date(firstDayOfMonth)
  startDate.setDate(startDate.getDate() - startDate.getDay())

  const days = []
  const currentDay = new Date(startDate)

  for (let i = 0; i < 42; i++) {
    days.push(new Date(currentDay))
    currentDay.setDate(currentDay.getDate() + 1)
  }

  const getEventForDay = (date: Date) => {
    return events.find((event) => {
      const eventDate = new Date(event.date)
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      )
    })
  }

  const stats = useMemo(() => {
    const monthEvents = events.filter((e) => {
      const d = new Date(e.date)
      return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear()
    })
    return {
      present: monthEvents.filter((e) => e.status === "present").length,
      absent: monthEvents.filter((e) => e.status === "absent").length,
      late: monthEvents.filter((e) => e.status === "late").length,
      onLeave: monthEvents.filter((e) => e.status === "on_leave").length,
    }
  }, [events, currentDate])

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateMonth("prev")} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateMonth("next")} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-green-500" />
          <span>Present: {stats.present}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-red-500" />
          <span>Absent: {stats.absent}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-yellow-500" />
          <span>Late: {stats.late}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-blue-500" />
          <span>Leave: {stats.onLeave}</span>
        </div>
      </div>

      {/* Calendar */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="border-r p-2 text-center text-xs font-medium last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const event = getEventForDay(day)
            const isCurrentMonth = day.getMonth() === currentDate.getMonth()
            const isToday = day.toDateString() === new Date().toDateString()
            const statusColor = event ? statusColors[event.status] : null

            return (
              <div
                key={index}
                className={cn(
                  "min-h-16 border-b border-r p-1 transition-colors last:border-r-0 cursor-pointer hover:bg-accent/50",
                  !isCurrentMonth && "bg-muted/30"
                )}
                onClick={() => onDateClick?.(day)}
              >
                <div className="flex items-start justify-between">
                  <div
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                      isToday && "bg-primary text-primary-foreground font-semibold"
                    )}
                  >
                    {day.getDate()}
                  </div>
                  {event && (
                    <div className={cn("h-2 w-2 rounded-full", statusColor?.bg)} />
                  )}
                </div>
                {event && (
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {event.clockIn && <div>In: {event.clockIn}</div>}
                    {event.clockOut && <div>Out: {event.clockOut}</div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
