import { useState } from 'react'
import { Box, Button, Flex, Icon, Input, InputGroup, InputRightElement, Popover, PopoverAnchor, PopoverBody, PopoverContent, Select, SimpleGrid, Text, useDisclosure } from '@chakra-ui/react'
import { MdCalendarToday } from 'react-icons/md'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const iso = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

// "12 April 1990" from the ISO value the API uses
export const formatDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return year && month && day ? `${day} ${MONTHS[month - 1]} ${year}` : ''
}

// Date picker for dates far in the past, such as a date of birth: the field reads "12 April 1990" and opens a
// compact calendar where month and year are picked from lists instead of paging back month by month.
// `value` is ISO (yyyy-mm-dd), the same as a native date input. Future dates cannot be picked.
export function DateField({ value, onChange, placeholder = 'Select date' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const today = new Date()
  const [selYear, selMonth, selDay] = value ? value.split('-').map(Number) : [0, 0, 0]
  // Month on show: the picked date's, or thirty years back as a starting point for a birthday
  const [view, setView] = useState({ year: selYear || today.getFullYear() - 30, month: selYear ? selMonth - 1 : 0 })

  const open = () => {
    if (selYear) setView({ year: selYear, month: selMonth - 1 })
    onOpen()
  }

  const firstWeekday = new Date(view.year, view.month, 1).getDay()
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()
  const years = Array.from({ length: today.getFullYear() - 1899 }, (_, index) => today.getFullYear() - index)

  return (
    <Popover isOpen={isOpen} onClose={onClose} placement="bottom-start" isLazy>
      <PopoverAnchor>
        <InputGroup>
          <Input
            variant="main"
            readOnly
            cursor="pointer"
            placeholder={placeholder}
            value={formatDate(value)}
            onClick={open}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                open()
              }
            }}
          />
          <InputRightElement h="100%" pointerEvents="none">
            <Icon as={MdCalendarToday} color="secondaryGray.600" />
          </InputRightElement>
        </InputGroup>
      </PopoverAnchor>
      <PopoverContent w="264px" borderRadius="16px" boxShadow="pop" _focusVisible={{ outline: 'none' }}>
        <PopoverBody p="12px">
          <Flex gap="8px" mb="10px" sx={{ select: { h: '34px', fontSize: 'sm', borderRadius: '9px' } }}>
            <Select variant="main" size="sm" flex="1.4" aria-label="Month" value={view.month} onChange={(e) => setView({ ...view, month: Number(e.target.value) })}>
              {MONTHS.map((name, index) => (
                <option key={name} value={index}>
                  {name}
                </option>
              ))}
            </Select>
            <Select variant="main" size="sm" flex="1" aria-label="Year" value={view.year} onChange={(e) => setView({ ...view, year: Number(e.target.value) })}>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Select>
          </Flex>
          <SimpleGrid columns={7} spacing="2px" textAlign="center">
            {WEEKDAYS.map((day, index) => (
              <Text key={index} fontSize="11px" fontWeight="700" color="secondaryGray.600" py="4px">
                {day}
              </Text>
            ))}
            {Array.from({ length: firstWeekday }, (_, index) => (
              <Box key={`blank-${index}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1
              const selected = selYear === view.year && selMonth - 1 === view.month && selDay === day
              return (
                <Button
                  key={day}
                  variant={selected ? 'brand' : 'ghost'}
                  size="sm"
                  h="32px"
                  minW="0"
                  p="0"
                  fontSize="13px"
                  fontWeight={selected ? '800' : '500'}
                  borderRadius="9px"
                  boxShadow="none"
                  isDisabled={new Date(view.year, view.month, day) > today}
                  onClick={() => {
                    onChange(iso(view.year, view.month, day))
                    onClose()
                  }}
                >
                  {day}
                </Button>
              )
            })}
          </SimpleGrid>
          {value && (
            <Button
              variant="link"
              colorScheme="brandScheme"
              fontSize="13px"
              mt="8px"
              onClick={() => {
                onChange('')
                onClose()
              }}
            >
              Clear
            </Button>
          )}
        </PopoverBody>
      </PopoverContent>
    </Popover>
  )
}
