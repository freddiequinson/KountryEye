declare global {
  interface Window {
    electronAPI?: {
      getAppVersion: () => Promise<string>;
      getPlatform: () => string;
      isElectron: boolean;
      getStoreValue: (key: string) => Promise<any>;
      setStoreValue: (key: string, value: any) => Promise<void>;
      showNotification: (title: string, body: string) => Promise<void>;
      getAutoStart: () => Promise<boolean>;
      setAutoStart: (enable: boolean) => Promise<void>;
    };
  }
}

export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
};

export const getAppVersion = async (): Promise<string> => {
  if (!isElectron()) return '1.0.0';
  return window.electronAPI!.getAppVersion();
};

export const getPlatform = (): string => {
  if (!isElectron()) return 'web';
  return window.electronAPI!.getPlatform();
};

export const showNotification = async (title: string, body: string): Promise<void> => {
  if (isElectron()) {
    await window.electronAPI!.showNotification(title, body);
  } else if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
};

export const getStoreValue = async <T>(key: string): Promise<T | null> => {
  if (!isElectron()) {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  }
  return window.electronAPI!.getStoreValue(key);
};

export const setStoreValue = async (key: string, value: any): Promise<void> => {
  if (!isElectron()) {
    localStorage.setItem(key, JSON.stringify(value));
    return;
  }
  await window.electronAPI!.setStoreValue(key, value);
};

export const getAutoStart = async (): Promise<boolean> => {
  if (!isElectron()) return false;
  return window.electronAPI!.getAutoStart();
};

export const setAutoStart = async (enable: boolean): Promise<void> => {
  if (!isElectron()) return;
  await window.electronAPI!.setAutoStart(enable);
};
