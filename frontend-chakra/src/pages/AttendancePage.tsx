import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge, Box, Button, Flex, Icon, SimpleGrid, Stack, Text, Tooltip } from '@chakra-ui/react'
import { MdAccessTime, MdCalendarMonth, MdCancel, MdCheckCircle, MdErrorOutline, MdEventBusy, MdHistory, MdLocationOn } from 'react-icons/md'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/hooks/use-toast'
import PageHeader from '@/components/PageHeader'
import TabCard from '@/components/card/TabCard'
import HistoryItem from '@/components/HistoryItem'
import MiniCalendar from '@/components/calendar/MiniCalendar'
import { ConfirmDialog, EmptyState } from '@/components/ui'

interface AttendanceRecord {
  id: number
  date: string
  clock_in?: string
  clock_out?: string
  status: string
  clock_in_within_geofence?: boolean
  clock_out_within_geofence?: boolean
}

interface BranchSettings {
  latitude?: number
  longitude?: number
  geofence_radius: number
  work_start_time: string
  work_end_time: string
  require_geolocation: boolean
}

const STATUS_SCHEME: Record<string, string> = { present: 'green', late: 'yellow', absent: 'red', half_day: 'gray' }

const statusBadge = (status: string) => {
  const displayStatus = status || 'pending'
  return (
    <Badge colorScheme={STATUS_SCHEME[displayStatus] || 'gray'} textTransform="capitalize">
      {displayStatus.replace('_', ' ')}
    </Badge>
  )
}

const getLocation = (): Promise<{ lat: number; lng: number }> =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 10000 }
    )
  })

export default function AttendancePage() {
  const { user } = useAuthStore()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [currentTime, setCurrentTime] = useState(new Date())
  const [locationError, setLocationError] = useState<string | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [showClockOutConfirm, setShowClockOutConfirm] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const { data: todayAttendance } = useQuery({
    queryKey: ['my-attendance-today'],
    queryFn: async () => (await api.get('/employees/attendance/my-status')).data as AttendanceRecord | null,
  })

  const { data: attendanceHistory = [] } = useQuery({
    queryKey: ['my-attendance-history'],
    queryFn: async () => (await api.get(`/employees/${user?.id}/attendance?limit=31`)).data as AttendanceRecord[],
    enabled: !!user?.id,
  })

  const { data: branchSettings } = useQuery({
    queryKey: ['branch-settings', user?.branch_id],
    queryFn: async () => (await api.get(`/branches/${user?.branch_id}`)).data as BranchSettings,
    enabled: !!user?.branch_id,
  })

  const onClockSuccess = (title: string) => () => {
    queryClient.invalidateQueries({ queryKey: ['my-attendance-today'] })
    queryClient.invalidateQueries({ queryKey: ['my-attendance-history'] })
    toast({ title })
  }

  const clockInMutation = useMutation({
    mutationFn: (data: { latitude?: number; longitude?: number }) => api.post('/employees/attendance/clock-in', data),
    onSuccess: onClockSuccess('Clocked in successfully!'),
    onError: (error: any) => {
      toast({ title: 'Failed to clock in', description: error.response?.data?.detail || 'Please try again', variant: 'destructive' })
    },
  })

  const clockOutMutation = useMutation({
    mutationFn: (data: { latitude?: number; longitude?: number }) => api.post('/employees/attendance/clock-out', data),
    onSuccess: onClockSuccess('Clocked out successfully!'),
    onError: (error: any) => {
      toast({ title: 'Failed to clock out', description: error.response?.data?.detail || 'Please try again', variant: 'destructive' })
    },
  })

  const handleClockIn = async () => {
    setIsGettingLocation(true)
    setLocationError(null)
    try {
      let locationData = {}
      if (branchSettings?.require_geolocation) {
        const loc = await getLocation()
        locationData = { latitude: loc.lat, longitude: loc.lng }
      }
      clockInMutation.mutate(locationData)
    } catch {
      if (branchSettings?.require_geolocation) {
        setLocationError('Location access is required to clock in. Please enable location services.')
        toast({ title: 'Location required', description: 'Please enable location services to clock in', variant: 'destructive' })
      } else {
        clockInMutation.mutate({})
      }
    } finally {
      setIsGettingLocation(false)
    }
  }

  const handleClockOut = async () => {
    setShowClockOutConfirm(false)
    setIsGettingLocation(true)
    setLocationError(null)
    try {
      let locationData = {}
      if (branchSettings?.require_geolocation) {
        const loc = await getLocation()
        locationData = { latitude: loc.lat, longitude: loc.lng }
      }
      clockOutMutation.mutate(locationData)
    } catch {
      if (branchSettings?.require_geolocation) {
        setLocationError('Location access is required to clock out. Please enable location services.')
      } else {
        clockOutMutation.mutate({})
      }
    } finally {
      setIsGettingLocation(false)
    }
  }

  const isClockedIn = todayAttendance?.clock_in && !todayAttendance?.clock_out
  const isClockedOut = todayAttendance?.clock_in && todayAttendance?.clock_out
  const fmtShort = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--')

  // hours between clock in and clock out (or now, while the shift is still running)
  const hoursWorked = (rec?: AttendanceRecord | null, live = false) => {
    if (!rec?.clock_in) return null
    const end = rec.clock_out ? new Date(rec.clock_out) : live ? currentTime : null
    if (!end) return null
    const mins = Math.max(0, Math.round((end.getTime() - new Date(rec.clock_in).getTime()) / 60000))
    return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`
  }

  const marks = Object.fromEntries(attendanceHistory.map((r) => [r.date.slice(0, 10), r.status]))
  const count = (status: string) => attendanceHistory.filter((r) => r.status === status).length
  const busy = clockInMutation.isPending || clockOutMutation.isPending || isGettingLocation
  const [time, meridiem] = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).split(' ')

  return (
    <>
      <PageHeader title="Attendance" description="Clock in and out for your shift" />

      {/* Clock card: the time, today's status and the one action that matters */}
      <Box position="relative" overflow="hidden" borderRadius="20px" mb="20px" color="white" bg="linear-gradient(120deg, #0B2415 0%, #14472A 50%, #2F7A3F 100%)" boxShadow="0 20px 40px -24px rgba(11, 36, 21, 0.7)">
        <Box position="absolute" top="-120px" right="-60px" w="340px" h="340px" borderRadius="full" border="1px solid rgba(255,255,255,0.08)" />
        <Box position="absolute" bottom="-90px" right="22%" w="220px" h="220px" borderRadius="full" bg="rgba(12, 192, 223, 0.2)" filter="blur(50px)" />
        <Flex position="relative" direction={{ base: 'column', lg: 'row' }} align={{ lg: 'center' }} justify="space-between" gap="24px" p={{ base: '22px', md: '30px' }}>
          <Box>
            <Text fontSize="sm" fontWeight="700" letterSpacing="0.1em" textTransform="uppercase" color="brand.200">
              {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
            <Flex align="baseline" gap="10px" mt="6px">
              <Text fontSize={{ base: '48px', md: '64px' }} fontWeight="800" lineHeight="1" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {time}
              </Text>
              <Text fontSize="2xl" fontWeight="700" color="whiteAlpha.700">
                {meridiem}
              </Text>
            </Flex>
            <Flex align="center" gap="12px" mt="12px" wrap="wrap" fontSize="md" fontWeight="500" color="whiteAlpha.800">
              {branchSettings && (
                <Flex align="center" gap="6px">
                  <Icon as={MdAccessTime} />
                  Work hours {branchSettings.work_start_time} - {branchSettings.work_end_time}
                </Flex>
              )}
              {todayAttendance && statusBadge(todayAttendance.status)}
            </Flex>
          </Box>

          <Box w={{ base: '100%', lg: '420px' }} flexShrink={0}>
            <SimpleGrid columns={3} spacing="10px" mb="14px">
              {[
                ['Clock in', fmtShort(todayAttendance?.clock_in)],
                ['Clock out', fmtShort(todayAttendance?.clock_out)],
                ['Hours', hoursWorked(todayAttendance, true) || '--'],
              ].map(([label, value]) => (
                <Box key={label} bg="whiteAlpha.200" border="1px solid" borderColor="whiteAlpha.300" backdropFilter="blur(8px)" borderRadius="16px" px="14px" py="12px">
                  <Text fontSize="sm" fontWeight="500" color="whiteAlpha.800">
                    {label}
                  </Text>
                  <Text fontSize="xl" fontWeight="700" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {value}
                  </Text>
                </Box>
              ))}
            </SimpleGrid>
            {!isClockedIn && !isClockedOut && (
              <Button w="100%" size="lg" bg="white" color="brand.700" _hover={{ bg: 'whiteAlpha.900', transform: 'translateY(-1px)' }} leftIcon={<MdCheckCircle />} onClick={handleClockIn} isLoading={busy} loadingText={isGettingLocation ? 'Getting location...' : 'Clocking in...'}>
                Clock In
              </Button>
            )}
            {isClockedIn && (
              <Button w="100%" size="lg" colorScheme="red" leftIcon={<MdCancel />} onClick={() => setShowClockOutConfirm(true)} isLoading={busy} loadingText={isGettingLocation ? 'Getting location...' : 'Clocking out...'}>
                Clock Out
              </Button>
            )}
            {isClockedOut && (
              <Flex h="48px" align="center" justify="center" gap="8px" borderRadius="12px" bg="whiteAlpha.200" border="1px solid" borderColor="whiteAlpha.300" fontWeight="700">
                <Icon as={MdCheckCircle} w="20px" h="20px" color="brand.200" />
                Shift completed
              </Flex>
            )}
          </Box>
        </Flex>
      </Box>

      {branchSettings?.require_geolocation && !locationError && (
        <Flex align="center" gap="8px" fontSize="sm" fontWeight="500" color="secondaryGray.700" bg="white" _dark={{ bg: 'whiteAlpha.100', color: 'secondaryGray.400' }} border="1px solid" borderColor="secondaryGray.100" px="14px" py="10px" borderRadius="12px" mb="20px">
          <Icon as={MdLocationOn} color="brand.500" />
          Location verification is required for this branch
        </Flex>
      )}
      {locationError && (
        <Flex align="center" gap="8px" fontSize="sm" fontWeight="600" color="red.500" bg="red.100" _dark={{ bg: 'rgba(238,93,80,0.15)' }} px="14px" py="10px" borderRadius="12px" mb="20px">
          <Icon as={MdErrorOutline} />
          {locationError}
        </Flex>
      )}

      <TabCard
        title="My attendance"
        tabs={[
          {
            label: 'History',
            icon: MdHistory,
            content:
              attendanceHistory.length === 0 ? (
                <EmptyState icon={MdEventBusy}>No attendance records yet</EmptyState>
              ) : (
                <Box mx={{ md: '-8px' }}>
                  {attendanceHistory.map((record) => {
                    const day = new Date(record.date)
                    return (
                      <HistoryItem
                        key={record.id}
                        tileColor={record.status === 'late' ? 'orange.500' : record.status === 'absent' ? 'red.500' : 'brand.500'}
                        tile={
                          <>
                            <Text fontSize="xl">{day.getDate()}</Text>
                            <Text fontSize="xs" textTransform="uppercase">
                              {day.toLocaleDateString('en-US', { month: 'short' })}
                            </Text>
                          </>
                        }
                        name={day.toLocaleDateString('en-US', { weekday: 'long' })}
                        sub={
                          <Flex align="center" gap="6px">
                            {fmtShort(record.clock_in)} → {fmtShort(record.clock_out)}
                            {record.clock_in_within_geofence === false && (
                              <Tooltip label="Clocked in outside geofence">
                                <span>
                                  <Icon as={MdLocationOn} color="orange.500" />
                                </span>
                              </Tooltip>
                            )}
                          </Flex>
                        }
                        value={hoursWorked(record) || '-'}
                        end={statusBadge(record.status)}
                      />
                    )
                  })}
                </Box>
              ),
          },
          {
            label: 'Calendar',
            icon: MdCalendarMonth,
            content: (
              <Flex direction={{ base: 'column', md: 'row' }} gap="32px" align={{ md: 'center' }}>
                <MiniCalendar marks={marks} />
                <Stack spacing="12px" flex="1" maxW="320px">
                  {[
                    ['Present', count('present'), 'green.500'],
                    ['Late', count('late'), 'orange.500'],
                    ['Absent', count('absent'), 'red.500'],
                  ].map(([label, n, color]) => (
                    <Flex key={label as string} align="center" justify="space-between" p="14px 16px" borderRadius="16px" bg="secondaryGray.300" _dark={{ bg: 'whiteAlpha.100' }}>
                      <Flex align="center" gap="10px" fontWeight="500">
                        <Box w="10px" h="10px" borderRadius="full" bg={color as string} />
                        {label}
                      </Flex>
                      <Text fontSize="xl" fontWeight="700">
                        {n}
                      </Text>
                    </Flex>
                  ))}
                  <Text fontSize="sm" color="secondaryGray.600">
                    Based on your last {attendanceHistory.length} records.
                  </Text>
                </Stack>
              </Flex>
            ),
          },
        ]}
      />

      <ConfirmDialog
        isOpen={showClockOutConfirm}
        onClose={() => setShowClockOutConfirm(false)}
        onConfirm={handleClockOut}
        isLoading={clockOutMutation.isPending || isGettingLocation}
        title="Confirm Clock Out"
        confirmLabel="Yes, Clock Out"
      >
        Are you sure you want to clock out? This will end your shift for today.
      </ConfirmDialog>
    </>
  )
}
