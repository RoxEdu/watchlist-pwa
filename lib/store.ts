import { create } from 'zustand'
import type { MediaType, Status, WatchlistItem } from './types'

interface UIState {
  // Quick add sheet
  quickAddOpen: boolean
  setQuickAddOpen: (v: boolean) => void

  // Detail sheet
  detailItem: WatchlistItem | null
  setDetailItem: (item: WatchlistItem | null) => void

  // Status picker
  statusPickerItem: WatchlistItem | null
  setStatusPickerItem: (item: WatchlistItem | null) => void

  // Active tab filter
  activeTab: 'home' | MediaType | 'discover'
  setActiveTab: (tab: 'home' | MediaType | 'discover') => void

  // Status filter per tab
  statusFilter: Status | 'all'
  setStatusFilter: (s: Status | 'all') => void

  // Profile / settings sheet
  profileSheetOpen: boolean
  setProfileSheetOpen: (v: boolean) => void

  // Smart paste sheet
  smartPasteOpen: boolean
  setSmartPasteOpen: (v: boolean) => void

  // Sort settings
  sortBy: SortOption
  setSortBy: (opt: SortOption) => void
}

export type SortOption =
  | 'newest_added'
  | 'oldest_added'
  | 'alphabetical_az'
  | 'alphabetical_za'
  | 'newest_release'
  | 'oldest_release'
  | 'my_rating_desc'
  | 'imdb_rating_desc'


export const useUIStore = create<UIState>((set) => ({
  quickAddOpen: false,
  setQuickAddOpen: (v) => set({ quickAddOpen: v }),

  detailItem: null,
  setDetailItem: (item) => set({ detailItem: item }),

  statusPickerItem: null,
  setStatusPickerItem: (item) => set({ statusPickerItem: item }),

  activeTab: 'home',
  setActiveTab: (tab) => set({ activeTab: tab, statusFilter: 'all' }),

  statusFilter: 'all',
  setStatusFilter: (s) => set({ statusFilter: s }),

  profileSheetOpen: false,
  setProfileSheetOpen: (v) => set({ profileSheetOpen: v }),

  smartPasteOpen: false,
  setSmartPasteOpen: (v) => set({ smartPasteOpen: v }),

  sortBy: 'newest_added',
  setSortBy: (opt) => set({ sortBy: opt }),
}))
