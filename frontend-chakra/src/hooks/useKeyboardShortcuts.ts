import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface ShortcutAction {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  const shortcuts: ShortcutAction[] = [
    {
      key: 'k',
      ctrl: true,
      action: () => {
        // Focus on search input if exists, or navigate to patients
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        } else {
          navigate('/patients');
        }
      },
      description: 'Search patients',
    },
    {
      key: 'n',
      ctrl: true,
      action: () => {
        navigate('/frontdesk/register');
      },
      description: 'New patient',
    },
    {
      key: 'p',
      ctrl: true,
      shift: true,
      action: () => {
        navigate('/sales/pos');
      },
      description: 'Open POS',
    },
    {
      key: 'd',
      ctrl: true,
      action: () => {
        navigate('/');
      },
      description: 'Go to Dashboard',
    },
    {
      key: 'f',
      ctrl: true,
      shift: true,
      action: () => {
        navigate('/frontdesk');
      },
      description: 'Go to Front Desk',
    },
    {
      key: 'i',
      ctrl: true,
      shift: true,
      action: () => {
        navigate('/inventory');
      },
      description: 'Go to Inventory',
    },
    {
      key: 'm',
      ctrl: true,
      shift: true,
      action: () => {
        navigate('/messages');
      },
      description: 'Go to Messages',
    },
    {
      key: 'h',
      ctrl: true,
      action: () => {
        navigate('/help');
      },
      description: 'Open Help',
    },
    {
      key: 'Escape',
      action: () => {
        // Close any open dialogs by clicking backdrop or pressing escape
        const closeButton = document.querySelector('[data-state="open"] button[aria-label="Close"]') as HTMLButtonElement;
        if (closeButton) {
          closeButton.click();
        }
      },
      description: 'Close dialog',
    },
  ];

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      // Only allow Escape in inputs
      if (event.key !== 'Escape') {
        return;
      }
    }

    for (const shortcut of shortcuts) {
      const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

      if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
        event.preventDefault();
        shortcut.action();
        return;
      }
    }
  }, [navigate]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return shortcuts;
}

export const shortcutsList = [
  { keys: 'Ctrl + K', description: 'Search patients' },
  { keys: 'Ctrl + N', description: 'New patient registration' },
  { keys: 'Ctrl + Shift + P', description: 'Open POS' },
  { keys: 'Ctrl + D', description: 'Go to Dashboard' },
  { keys: 'Ctrl + Shift + F', description: 'Go to Front Desk' },
  { keys: 'Ctrl + Shift + I', description: 'Go to Inventory' },
  { keys: 'Ctrl + Shift + M', description: 'Go to Messages' },
  { keys: 'Ctrl + H', description: 'Open Help' },
  { keys: 'Escape', description: 'Close dialog' },
];
