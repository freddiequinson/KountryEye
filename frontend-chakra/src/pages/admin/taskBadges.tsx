import { Badge } from '@chakra-ui/react'

// Shared by EmployeesPage and EmployeeDetailPage.
const statusScheme: Record<string, [string, string]> = {
  pending: ['gray', 'subtle'],
  in_progress: ['brand', 'subtle'],
  completed: ['gray', 'outline'],
  cancelled: ['red', 'subtle'],
}

const priorityScheme: Record<string, [string, string]> = {
  low: ['gray', 'outline'],
  medium: ['gray', 'subtle'],
  high: ['brand', 'subtle'],
  urgent: ['red', 'subtle'],
}

export function TaskStatusBadge({ status }: { status: string }) {
  const [scheme, variant] = statusScheme[status] || ['gray', 'subtle']
  return (
    <Badge colorScheme={scheme} variant={variant}>
      {status.replace('_', ' ')}
    </Badge>
  )
}

export function PriorityBadge({ priority }: { priority: string }) {
  const [scheme, variant] = priorityScheme[priority] || ['gray', 'subtle']
  return (
    <Badge colorScheme={scheme} variant={variant}>
      {priority}
    </Badge>
  )
}

export const TASK_STATUS_OPTIONS = (
  <>
    <option value="pending">Pending</option>
    <option value="in_progress">In Progress</option>
    <option value="completed">Completed</option>
    <option value="cancelled">Cancelled</option>
  </>
)

export const PRIORITY_OPTIONS = (
  <>
    <option value="low">Low</option>
    <option value="medium">Medium</option>
    <option value="high">High</option>
    <option value="urgent">Urgent</option>
  </>
)
