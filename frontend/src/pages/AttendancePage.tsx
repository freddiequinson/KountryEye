import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, MapPin, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

interface AttendanceRecord {
  id: number;
  date: string;
  clock_in?: string;
  clock_out?: string;
  status: string;
  clock_in_within_geofence?: boolean;
  clock_out_within_geofence?: boolean;
}

interface BranchSettings {
  latitude?: number;
  longitude?: number;
  geofence_radius: number;
  work_start_time: string;
  work_end_time: string;
  require_geolocation: boolean;
}

export default function AttendancePage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [showClockOutConfirm, setShowClockOutConfirm] = useState(false);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Get today's attendance for current user
  const { data: todayAttendance, isLoading } = useQuery({
    queryKey: ['my-attendance-today'],
    queryFn: async () => {
      const response = await api.get('/employees/attendance/my-status');
      return response.data as AttendanceRecord | null;
    },
  });

  // Get recent attendance history
  const { data: attendanceHistory = [] } = useQuery({
    queryKey: ['my-attendance-history'],
    queryFn: async () => {
      const response = await api.get(`/employees/${user?.id}/attendance?limit=10`);
      return response.data as AttendanceRecord[];
    },
    enabled: !!user?.id,
  });

  // Get branch settings
  const { data: branchSettings } = useQuery({
    queryKey: ['branch-settings', user?.branch_id],
    queryFn: async () => {
      const response = await api.get(`/branches/${user?.branch_id}`);
      return response.data as BranchSettings;
    },
    enabled: !!user?.branch_id,
  });

  const clockInMutation = useMutation({
    mutationFn: async (data: { latitude?: number; longitude?: number }) => {
      return api.post('/employees/attendance/clock-in', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['my-attendance-history'] });
      toast({ title: 'Clocked in successfully!' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to clock in', 
        description: error.response?.data?.detail || 'Please try again',
        variant: 'destructive' 
      });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async (data: { latitude?: number; longitude?: number }) => {
      return api.post('/employees/attendance/clock-out', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['my-attendance-history'] });
      toast({ title: 'Clocked out successfully!' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to clock out', 
        description: error.response?.data?.detail || 'Please try again',
        variant: 'destructive' 
      });
    },
  });

  const getLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'));
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const handleClockIn = async () => {
    setIsGettingLocation(true);
    setLocationError(null);
    
    try {
      let locationData = {};
      
      if (branchSettings?.require_geolocation) {
        const loc = await getLocation();
        setLocation(loc);
        locationData = { latitude: loc.lat, longitude: loc.lng };
      }
      
      clockInMutation.mutate(locationData);
    } catch (error: any) {
      if (branchSettings?.require_geolocation) {
        setLocationError('Location access is required to clock in. Please enable location services.');
        toast({ 
          title: 'Location required', 
          description: 'Please enable location services to clock in',
          variant: 'destructive' 
        });
      } else {
        clockInMutation.mutate({});
      }
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleClockOut = async () => {
    setShowClockOutConfirm(false);
    setIsGettingLocation(true);
    setLocationError(null);
    
    try {
      let locationData = {};
      
      if (branchSettings?.require_geolocation) {
        const loc = await getLocation();
        setLocation(loc);
        locationData = { latitude: loc.lat, longitude: loc.lng };
      }
      
      clockOutMutation.mutate(locationData);
    } catch (error: any) {
      if (branchSettings?.require_geolocation) {
        setLocationError('Location access is required to clock out. Please enable location services.');
      } else {
        clockOutMutation.mutate({});
      }
    } finally {
      setIsGettingLocation(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      present: 'default',
      late: 'secondary',
      absent: 'destructive',
      half_day: 'outline',
    };
    const colors: Record<string, string> = {
      present: 'bg-green-500',
      late: 'bg-yellow-500',
      absent: 'bg-red-500',
    };
    const displayStatus = status || 'pending';
    return (
      <Badge variant={variants[displayStatus] || 'secondary'} className={colors[displayStatus] || ''}>
        {displayStatus.replace('_', ' ')}
      </Badge>
    );
  };

  const isClockedIn = todayAttendance?.clock_in && !todayAttendance?.clock_out;
  const isClockedOut = todayAttendance?.clock_in && todayAttendance?.clock_out;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Attendance</h1>
        <p className="text-muted-foreground">Clock in and out for your shift</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Clock In/Out Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Today's Attendance
            </CardTitle>
            <CardDescription>
              {currentTime.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Current Time Display */}
            <div className="text-center">
              <div className="text-5xl font-bold font-mono">
                {currentTime.toLocaleTimeString()}
              </div>
              {branchSettings && (
                <p className="text-sm text-muted-foreground mt-2">
                  Work hours: {branchSettings.work_start_time} - {branchSettings.work_end_time}
                </p>
              )}
            </div>

            {/* Status Display */}
            <div className="flex justify-center gap-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Clock In</p>
                <p className="font-semibold">
                  {todayAttendance?.clock_in 
                    ? new Date(todayAttendance.clock_in).toLocaleTimeString() 
                    : '--:--:--'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Clock Out</p>
                <p className="font-semibold">
                  {todayAttendance?.clock_out 
                    ? new Date(todayAttendance.clock_out).toLocaleTimeString() 
                    : '--:--:--'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Status</p>
                {todayAttendance ? getStatusBadge(todayAttendance.status) : <span>-</span>}
              </div>
            </div>

            {/* Location Warning */}
            {branchSettings?.require_geolocation && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                <MapPin className="h-4 w-4" />
                <span>Location verification is required for this branch</span>
              </div>
            )}

            {locationError && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4" />
                <span>{locationError}</span>
              </div>
            )}

            {/* Clock In/Out Buttons */}
            <div className="flex gap-4">
              {!isClockedIn && !isClockedOut && (
                <Button 
                  className="flex-1 h-16 text-lg"
                  onClick={handleClockIn}
                  disabled={clockInMutation.isPending || isGettingLocation}
                >
                  <CheckCircle className="mr-2 h-5 w-5" />
                  {isGettingLocation ? 'Getting Location...' : 'Clock In'}
                </Button>
              )}
              
              {isClockedIn && (
                <Button 
                  className="flex-1 h-16 text-lg"
                  variant="destructive"
                  onClick={() => setShowClockOutConfirm(true)}
                  disabled={clockOutMutation.isPending || isGettingLocation}
                >
                  <XCircle className="mr-2 h-5 w-5" />
                  {isGettingLocation ? 'Getting Location...' : 'Clock Out'}
                </Button>
              )}
              
              {isClockedOut && (
                <div className="flex-1 h-16 flex items-center justify-center bg-green-100 text-green-700 rounded-lg">
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Shift Completed
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent History Card */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Attendance</CardTitle>
            <CardDescription>Your last 10 attendance records</CardDescription>
          </CardHeader>
          <CardContent>
            {attendanceHistory.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No attendance records yet</p>
            ) : (
              <div className="space-y-3">
                {attendanceHistory.map((record) => (
                  <div 
                    key={record.id} 
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <p className="font-medium">
                        {new Date(record.date).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {record.clock_in ? new Date(record.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                        {' → '}
                        {record.clock_out ? new Date(record.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {record.clock_in_within_geofence === false && (
                        <span title="Clocked in outside geofence"><MapPin className="h-4 w-4 text-yellow-500" /></span>
                      )}
                      {getStatusBadge(record.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Clock Out Confirmation Dialog */}
      <Dialog open={showClockOutConfirm} onOpenChange={setShowClockOutConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Clock Out</DialogTitle>
            <DialogDescription>
              Are you sure you want to clock out? This will end your shift for today.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClockOutConfirm(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleClockOut}
              disabled={clockOutMutation.isPending || isGettingLocation}
            >
              {isGettingLocation ? 'Getting Location...' : 'Yes, Clock Out'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
