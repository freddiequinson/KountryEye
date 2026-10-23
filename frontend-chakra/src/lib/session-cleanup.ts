import type { QueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'

// Kept: the login itself and per-device preferences (theme, sidebar, "keep me logged in")
const KEEP_SESSION_KEYS = new Set(['kountry-auth'])
const PRIVATE_LOCAL_KEYS = ['kountry_recent_searches']
const OFFLINE_DB = 'kountry_eyecare_offline' // lib/offline-storage.ts

/** Forget everything the last person loaded: cached API data, drafts, recent searches, offline copies. */
export async function clearSessionData(queryClient: QueryClient) {
  queryClient.clear()
  try {
    const keys: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) keys.push(sessionStorage.key(i) as string)
    for (const key of keys) if (key && !KEEP_SESSION_KEYS.has(key)) sessionStorage.removeItem(key)
    for (const key of PRIVATE_LOCAL_KEYS) localStorage.removeItem(key)
  } catch {
    /* storage blocked: nothing stored either */
  }
  try {
    indexedDB.deleteDatabase(OFFLINE_DB)
  } catch {
    /* no IndexedDB */
  }
}

/** Run the cleanup whenever someone logs out or a different person logs in. */
export function clearOnAccountChange(queryClient: QueryClient) {
  return useAuthStore.subscribe((state, prev) => {
    if (prev.user && state.user?.id !== prev.user.id) void clearSessionData(queryClient)
  })
}
