export interface CartItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  discount: number;
  maxDiscount: number;
}

export type ViewName =
  | 'pos'
  | 'dashboard'
  | 'products'
  | 'customers'
  | 'suppliers'
  | 'sales'
  | 'purchases'
  | 'inventory'
  | 'expenses'
  | 'reports'
  | 'settings'
  | 'error-log';

export interface NavItem {
  key: ViewName;
  label: string;
  icon: string;
  badge?: number;
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'pos', label: 'POS Terminal', icon: 'ShoppingCart' },
  { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { key: 'products', label: 'Products', icon: 'Package' },
  { key: 'customers', label: 'Customers', icon: 'Users' },
  { key: 'suppliers', label: 'Suppliers', icon: 'Truck' },
  { key: 'sales', label: 'Sales', icon: 'Receipt' },
  { key: 'purchases', label: 'Purchases', icon: 'ShoppingBag' },
  { key: 'inventory', label: 'Inventory', icon: 'Warehouse' },
  { key: 'expenses', label: 'Expenses', icon: 'Wallet' },
  { key: 'reports', label: 'Reports', icon: 'BarChart3' },
  { key: 'error-log', label: 'Error Log', icon: 'Bug' },
  { key: 'settings', label: 'Settings', icon: 'Settings' },
];
