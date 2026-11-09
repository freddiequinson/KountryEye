import { create } from 'zustand'

// Search terms stay in memory; they can contain patient details.
export const useSearchStore = create<{ term: string; setTerm: (term: string) => void }>((set) => ({
  term: '', setTerm: (term) => set({ term }),
}))
