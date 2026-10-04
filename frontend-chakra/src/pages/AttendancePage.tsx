import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge, Box, Button, Flex, HStack, Icon, SimpleGrid, Stack, Text, Tooltip } from '@chakra-ui/react'
import { MdAccessTime, MdCancel, MdCheckCircle, MdErrorOutline, MdLocationOn } from 'react-icons/md'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/hooks/use-toast'
import PageHeader from '@/components/PageHeader'
import SectionCard from '@/components/card/SectionCard'
import { ConfirmDialog } from '@/components/ui'

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
    queryFn: async () => (await api.get(`/employees/${user?.id}/attendance?limit=10`)).data as AttendanceRecord[],
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
  const fmtTime = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString() : '--:--:--')
  const fmtShort = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-')

  return (
    <>
      <PageHeader title="Attendance" description="Clock in and out for your shift" />

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing="20px">
        <SectionCard
          title={
            <Flex align="center" gap="8px">
              <Icon as={MdAccessTime} />
              Today's Attendance
            </Flex>
          }
          description={currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        >
          <Stack spacing="24px">
            <Box textAlign="center">
              <Text fontSize="5xl" fontWeight="700" fontFamily="mono">
                {currentTime.toLocaleTimeString()}
              </Text>
              {branchSettings && (
                <Text fontSize="sm" color="secondaryGray.600" mt="8px">
                  Work hours: {branchSettings.work_start_time} - {branchSettings.work_end_time}
                </Text>
              )}
            </Box>

            <HStack justify="center" spacing="24px">
              <Box textAlign="center">
                <Text fontSize="sm" color="secondaryGray.600">
                  Clock In
                </Text>
                <Text fontWeight="600">{fmtTime(todayAttendance?.clock_in)}</Text>
              </Box>
              <Box textAlign="center">
                <Text fontSize="sm" color="secondaryGray.600">
                  Clock Out
                </Text>
                <Text fontWeight="600">{fmtTime(todayAttendance?.clock_out)}</Text>
              </Box>
              <Box textAlign="center">
                <Text fontSize="sm" color="secondaryGray.600">
                  Status
                </Text>
                {todayAttendance ? statusBadge(todayAttendance.status) : <Text>-</Text>}
              </Box>
            </HStack>

            {branchSettings?.require_geolocation && (
              <Flex align="center" gap="8px" fontSize="sm" color="secondaryGray.600" bg="secondaryGray.100" _dark={{ bg: 'whiteAlpha.100' }} p="12px" borderRadius="12px">
                <Icon as={MdLocationOn} />
                Location verification is required for this branch
              </Flex>
            )}

            {locationError && (
              <Flex align="center" gap="8px" fontSize="sm" color="red.500" bg="rgba(229,62,62,0.1)" p="12px" borderRadius="12px">
                <Icon as={MdErrorOutline} />
                {locationError}
              </Flex>
            )}

            {!isClockedIn && !isClockedOut && (
              <Button
                variant="brand"
                h="64px"
                fontSize="lg"
                leftIcon={<MdCheckCircle />}
                onClick={handleClockIn}
                isLoading={clockInMutation.isPending || isGettingLocation}
                loadingText={isGettingLocation ? 'Getting Location...' : undefined}
              >
                Clock In
              </Button>
            )}
            {isClockedIn && (
              <Button
                colorScheme="red"
                h="64px"
                fontSize="lg"
                leftIcon={<MdCancel />}
                onClick={() => setShowClockOutConfirm(true)}
                isLoading={clockOutMutation.isPending || isGettingLocation}
                loadingText={isGettingLocation ? 'Getting Location...' : undefined}
              >
                Clock Out
              </Button>
            )}
            {isClockedOut && (
              <Flex h="64px" align="center" justify="center" gap="8px" bg="green.100" color="green.700" borderRadius="12px" fontWeight="600">
                <Icon as={MdCheckCircle} w="20px" h="20px" />
                Shift Completed
              </Flex>
            )}
          </Stack>
        </SectionCard>

        <SectionCard title="Recent Attendance" description="Your last 10 attendance records">
          {attendanceHistory.length === 0 ? (
            <Text color="secondaryGray.600" textAlign="center" py="32px">
              No attendance records yet
            </Text>
          ) : (
            <Stack spacing="0">
              {attendanceHistory.map((record, i) => (
                <Flex key={record.id} justify="space-between" align="center" py="10px" borderBottom={i < attendanceHistory.length - 1 ? '1px solid' : undefined} borderColor="secondaryGray.100">
                  <Box>
                    <Text fontWeight="600">{new Date(record.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                    <Text fontSize="sm" color="secondaryGray.600">
                      {fmtShort(record.clock_in)} → {fmtShort(record.clock_out)}
                    </Text>
                  </Box>
                  <HStack spacing="8px">
                    {record.clock_in_within_geofence === false && (
                      <Tooltip label="Clocked in outside geofence">
                        <span>
                          <Icon as={MdLocationOn} color="yellow.500" />
                        </span>
                      </Tooltip>
                    )}
                    {statusBadge(record.status)}
                  </HStack>
                </Flex>
              ))}
            </Stack>
          )}
        </SectionCard>
      </SimpleGrid>

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
