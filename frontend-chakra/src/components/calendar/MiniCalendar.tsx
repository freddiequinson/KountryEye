import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import './MiniCalendar.css'
import { Box, Icon, type BoxProps } from '@chakra-ui/react'
import { MdChevronLeft, MdChevronRight } from 'react-icons/md'

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Ported from Horizon components/calendar/MiniCalendar.js.
// `marks` colours individual days: { '2026-01-29': 'present' | 'late' | 'absent' }.
export default function MiniCalendar({ marks = {}, ...rest }: { marks?: Record<string, string> } & BoxProps) {
  return (
    <Box w="100%" maxW="360px" {...rest}>
      <Calendar
        view="month"
        tileClassName={({ date }) => (marks[dayKey(date)] ? `cal-${marks[dayKey(date)]}` : null)}
        prevLabel={<Icon as={MdChevronLeft} w="24px" h="24px" mt="4px" />}
        nextLabel={<Icon as={MdChevronRight} w="24px" h="24px" mt="4px" />}
      />
    </Box>
  )
}
