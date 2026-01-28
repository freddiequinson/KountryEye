import { WifiOff, RefreshCw } from 'lucide-react';
import { useOnlineStatus, usePendingSync } from '@/hooks/use-offline';
import { Badge } from '@/components/ui/badge';

export default function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const pendingCount = usePendingSync();

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
      {!isOnline && (
        <Badge variant="destructive" className="flex items-center gap-2 px-3 py-2">
          <WifiOff className="h-4 w-4" />
          Offline Mode
        </Badge>
      )}
      {pendingCount > 0 && (
        <Badge variant="warning" className="flex items-center gap-2 px-3 py-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          {pendingCount} pending sync
        </Badge>
      )}
    </div>
  );
}
