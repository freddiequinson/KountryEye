import { useState, useEffect } from 'react';
import { syncManager } from '@/lib/sync-manager';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export function usePendingSync() {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const checkPending = async () => {
      const count = await syncManager.getPendingSyncCount();
      setPendingCount(count);
    };

    checkPending();
    const interval = setInterval(checkPending, 5000);

    return () => clearInterval(interval);
  }, []);

  return pendingCount;
}

export function useOfflineData<T>(
  storeName: string,
  endpoint: string,
  enabled: boolean = true
) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (!enabled) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const result = await syncManager.getData<T>(storeName, endpoint);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [storeName, endpoint, enabled, isOnline]);

  return { data, isLoading, error, isOnline };
}
