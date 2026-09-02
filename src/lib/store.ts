import { create } from 'zustand';
import type { CartItem, ViewName } from './types';
export { STORE_LIST, DEFAULT_STORE_ID, type StoreLocation } from './types';

/* ------------------------------------------------------------------
   Navigation Store — includes sidebar collapsed state
   ------------------------------------------------------------------ */
interface NavState {
  currentView: ViewName;
  sidebarCollapsed: boolean;
  sidebarMobileOpen: boolean;
  setView: (view: ViewName) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  setSidebarMobileOpen: (v: boolean) => void;
}

export const useNavStore = create<NavState>((set) => ({
  currentView: 'pos',
  sidebarCollapsed: false,
  sidebarMobileOpen: false,
  setView: (view) => set({ currentView: view, sidebarMobileOpen: false }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setSidebarMobileOpen: (v) => set({ sidebarMobileOpen: v }),
}));

/* ------------------------------------------------------------------
   POS Cart Store
   ------------------------------------------------------------------ */
interface POSCartState {
  items: CartItem[];
  customerId: string | null;
  discountAmount: number;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, qty: number) => void;
  updateDiscount: (productId: string, discount: number) => void;
  setCustomer: (id: string | null) => void;
  setDiscountAmount: (amount: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
}

export const usePOSCartStore = create<POSCartState>((set, get) => ({
  items: [],
  customerId: null,
  discountAmount: 0,

  addItem: (item) =>
    set((s) => {
      const existing = s.items.find((i) => i.productId === item.productId);
      if (existing) {
        return {
          items: s.items.map((i) =>
            i.productId === item.productId
              ? { ...i, quantity: i.quantity + item.quantity }
              : i,
          ),
        };
      }
      return { items: [...s.items, item] };
    }),

  removeItem: (productId) =>
    set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),

  updateQuantity: (productId, qty) =>
    set((s) => ({
      items: qty <= 0
        ? s.items.filter((i) => i.productId !== productId)
        : s.items.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i)),
    })),

  updateDiscount: (productId, discount) =>
    set((s) => ({
      items: s.items.map((i) =>
        i.productId === productId
          ? { ...i, discount: Math.max(0, Math.min(discount, i.maxDiscount)) }
          : i,
      ),
    })),

  setCustomer: (id) => set({ customerId: id }),
  setDiscountAmount: (amount) => set({ discountAmount: Math.max(0, amount) }),
  clearCart: () => set({ items: [], customerId: null, discountAmount: 0 }),

  getSubtotal: () => {
    return get().items.reduce(
      (sum, i) => sum + i.unitPrice * i.quantity * (1 - (i.discount || 0) / 100),
      0,
    );
  },
}));

/* ------------------------------------------------------------------
   Settings Store (cached)
   ------------------------------------------------------------------ */
interface SettingsState {
  storeName: string;
  taxRate: number;
  currencySymbol: string;
  address: string;
  phone: string;
  invoicePrefix: string;
  receiptFooter: string;
  loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  storeName: 'Hardware Store',
  taxRate: 0,
  currencySymbol: '₵',
  address: '',
  phone: '',
  invoicePrefix: 'INV',
  receiptFooter: '',
  loadSettings: async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        const s = data.settings || data;
        set({
          storeName: s.storeName || 'Hardware Store',
          taxRate: s.taxRate || 0,
          currencySymbol: s.currencySymbol || '₵',
          address: s.address || '',
          phone: s.phone || '',
          invoicePrefix: s.invoicePrefix || 'INV',
          receiptFooter: s.receiptFooter || '',
        });
      }
    } catch { /* ignore */ }
  },
}));
