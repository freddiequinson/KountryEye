import api from './api';
import { offlineStorage, SyncQueueItem } from './offline-storage';

class SyncManager {
  private isOnline: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  private syncInterval: number | null = null;

  constructor() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  private handleOnline() {
    this.isOnline = true;
    this.startSync();
  }

  private handleOffline() {
    this.isOnline = false;
    this.stopSync();
  }

  async init() {
    await offlineStorage.init();
    if (this.isOnline) {
      this.startSync();
    }
  }

  startSync() {
    if (this.syncInterval) return;
    this.syncInterval = window.setInterval(() => this.processQueue(), 30000);
    this.processQueue();
  }

  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async processQueue() {
    if (this.isSyncing || !this.isOnline) return;

    this.isSyncing = true;
    try {
      const queue = await offlineStorage.getSyncQueue();
      const sortedQueue = queue.sort((a, b) => a.timestamp - b.timestamp);

      for (const item of sortedQueue) {
        try {
          await this.syncItem(item);
          await offlineStorage.removeSyncQueueItem(item.id);
        } catch (error) {
          item.retries += 1;
          if (item.retries >= 3) {
            console.error('Max retries reached for sync item:', item);
            await offlineStorage.removeSyncQueueItem(item.id);
          } else {
            await offlineStorage.updateSyncQueueItem(item);
          }
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncItem(item: SyncQueueItem) {
    switch (item.method) {
      case 'POST':
        await api.post(item.endpoint, item.data);
        break;
      case 'PUT':
        await api.put(item.endpoint, item.data);
        break;
      case 'DELETE':
        await api.delete(item.endpoint);
        break;
    }
  }

  async cacheData(storeName: string, endpoint: string) {
    if (!this.isOnline) return;

    try {
      const response = await api.get(endpoint);
      const data = response.data;

      if (Array.isArray(data)) {
        await offlineStorage.clear(storeName);
        for (const item of data) {
          await offlineStorage.put(storeName, item);
        }
      }

      await offlineStorage.setLastSyncTime(storeName, Date.now());
    } catch (error) {
      console.error(`Failed to cache ${storeName}:`, error);
    }
  }

  async getData<T>(storeName: string, endpoint: string): Promise<T[]> {
    if (this.isOnline) {
      try {
        const response = await api.get(endpoint);
        const data = response.data;

        if (Array.isArray(data)) {
          await offlineStorage.clear(storeName);
          for (const item of data) {
            await offlineStorage.put(storeName, item);
          }
        }

        return data;
      } catch (error) {
        console.warn('Online fetch failed, using cached data');
      }
    }

    return offlineStorage.getAll<T>(storeName);
  }

  async saveData<T extends { id?: number }>(
    storeName: string,
    endpoint: string,
    data: T,
    method: 'POST' | 'PUT' = 'POST'
  ): Promise<T> {
    if (this.isOnline) {
      try {
        const response = method === 'POST'
          ? await api.post(endpoint, data)
          : await api.put(endpoint, data);
        
        await offlineStorage.put(storeName, response.data);
        return response.data;
      } catch (error) {
        console.warn('Online save failed, queuing for sync');
      }
    }

    const offlineData = {
      ...data,
      id: data.id || Date.now(),
      _offline: true,
    };

    await offlineStorage.put(storeName, offlineData);
    await offlineStorage.addToSyncQueue({ endpoint, method, data });

    return offlineData as T;
  }

  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  async getPendingSyncCount(): Promise<number> {
    const queue = await offlineStorage.getSyncQueue();
    return queue.length;
  }
}

export const syncManager = new SyncManager();
