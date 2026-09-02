'use client';

import { useEffect, useCallback } from 'react';
import { useNavStore, useSettingsStore } from '@/lib/store';
import { NAV_ITEMS, type ViewName } from '@/lib/types';
import { initGlobalErrorReporting, reportApiError, reportError } from '@/lib/error-reporter';
import { cn } from '@/lib/utils';
import { SectionErrorBoundary } from '@/components/error-boundary';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ShoppingCart, LayoutDashboard, Package, Users, Truck, Receipt,
  ShoppingBag, Warehouse, Wallet, BarChart3, Settings, Bug,
  PanelLeftClose, PanelLeftOpen, Menu, Moon, Sun, Store,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';

/* ---------- Icon map ---------- */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  ShoppingCart, LayoutDashboard, Package, Users, Truck, Receipt,
  ShoppingBag, Warehouse, Wallet, BarChart3, Settings, Bug,
};

/* ---------- View Components (lazy) ---------- */
import { POSTerminal } from '@/components/pos/pos-terminal';
import { Dashboard } from '@/components/dashboard/dashboard';
import { ProductList } from '@/components/products/product-list';
import { CustomerList } from '@/components/customers/customer-list';
import { SupplierList } from '@/components/suppliers/supplier-list';
import { SaleList } from '@/components/sales/sale-list';
import { PurchaseList } from '@/components/purchases/purchase-list';
import { InventoryView } from '@/components/inventory/inventory-view';
import { ExpenseList } from '@/components/expenses/expense-list';
import { Reports } from '@/components/reports/reports';
import { ErrorLogView } from '@/components/error-log/error-log-view';
import { SettingsView } from '@/components/settings/settings';

const VIEW_COMPONENTS: Record<ViewName, React.ComponentType> = {
  pos: POSTerminal,
  dashboard: Dashboard,
  products: ProductList,
  customers: CustomerList,
  suppliers: SupplierList,
  sales: SaleList,
  purchases: PurchaseList,
  inventory: InventoryView,
  expenses: ExpenseList,
  reports: Reports,
  'error-log': ErrorLogView,
  settings: SettingsView,
};

/* ---------- Sidebar Nav Item ---------- */
function SidebarNavItem({ item, collapsed }: { item: typeof NAV_ITEMS[number]; collapsed: boolean }) {
  const currentView = useNavStore((s) => s.currentView);
  const setView = useNavStore((s) => s.setView);
  const Icon = ICON_MAP[item.icon] || ShoppingCart;
  const isActive = currentView === item.key;

  const btn = (
    <button
      onClick={() => setView(item.key)}
      className={cn(
        'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive
          ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary'
          : 'text-muted-foreground',
        collapsed && 'justify-center px-2',
      )}
    >
      <Icon className={cn('h-5 w-5 shrink-0', isActive && 'text-primary')} />
      {!collapsed && <span className='truncate'>{item.label}</span>}
      {!collapsed && item.badge && item.badge > 0 && (
        <Badge variant='destructive' className='ml-auto text-[10px] px-1.5 py-0'>
          {item.badge > 99 ? '99+' : item.badge}
        </Badge>
      )}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent side='right' className='font-medium'>
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return btn;
}

/* ---------- Sidebar ---------- */
function Sidebar({ className }: { className?: string }) {
  const collapsed = useNavStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useNavStore((s) => s.toggleSidebar);
  const storeName = useSettingsStore((s) => s.storeName);

  return (
    <aside
      className={cn(
        'relative flex flex-col border-r border-border bg-card transition-all duration-300 ease-in-out',
        collapsed ? 'w-[68px]' : 'w-[260px]',
        className,
      )}
    >
      {/* Header */}
      <div className={cn(
        'flex h-16 items-center gap-3 border-b border-border px-4',
        collapsed && 'justify-center px-2',
      )}>
        <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground'>
          <Store className='h-5 w-5' />
        </div>
        {!collapsed && (
          <div className='flex flex-col overflow-hidden'>
            <span className='truncate text-sm font-bold leading-tight'>{storeName}</span>
            <span className='truncate text-[11px] text-muted-foreground'>Hardware POS</span>
          </div>
        )}
      </div>

      {/* Nav Items */}
      <ScrollArea className='flex-1 px-3 py-3'>
        <nav className='flex flex-col gap-1'>
          {NAV_ITEMS.map((item) => (
            <SidebarNavItem key={item.key} item={item} collapsed={collapsed} />
          ))}
        </nav>
      </ScrollArea>

      {/* Collapse Toggle */}
      <div className='border-t border-border p-3'>
        <Button
          variant='ghost'
          size='sm'
          onClick={toggleSidebar}
          className={cn('w-full', collapsed ? 'justify-center px-2' : 'justify-start gap-2')}
        >
          {collapsed ? <PanelLeftOpen className='h-4 w-4' /> : <PanelLeftClose className='h-4 w-4' />}
          {!collapsed && <span className='text-xs'>Collapse</span>}
        </Button>
      </div>
    </aside>
  );
}

/* ---------- Mobile Sidebar (Sheet) ---------- */
function MobileSidebar() {
  const mobileOpen = useNavStore((s) => s.sidebarMobileOpen);
  const setMobileOpen = useNavStore((s) => s.setSidebarMobileOpen);
  const storeName = useSettingsStore((s) => s.storeName);

  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent side='left' className='w-[280px] p-0'>
        <SheetHeader className='flex h-16 flex-row items-center gap-3 border-b px-4'>
          <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground'>
            <Store className='h-5 w-5' />
          </div>
          <SheetTitle className='text-left'>{storeName}</SheetTitle>
        </SheetHeader>
        <ScrollArea className='flex-1 px-3 py-3'>
          <nav className='flex flex-col gap-1'>
            {NAV_ITEMS.map((item) => {
              const currentView = useNavStore.getState().currentView;
              const Icon = ICON_MAP[item.icon] || ShoppingCart;
              const isActive = currentView === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => useNavStore.getState().setView(item.key)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                    'hover:bg-accent hover:text-accent-foreground',
                    isActive
                      ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary'
                      : 'text-muted-foreground',
                  )}
                >
                  <Icon className={cn('h-5 w-5 shrink-0', isActive && 'text-primary')} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

/* ---------- Main App ---------- */
export default function Home() {
  const { currentView, sidebarCollapsed, setSidebarMobileOpen } = useNavStore();
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    loadSettings();
    initGlobalErrorReporting();
  }, [loadSettings]);

  /* Global fetch error interceptor — uses MbumahErrorHandler for structured errors */
  const originalFetch = useCallback(() => {
    const orig = window.fetch;
    window.fetch = async (...args) => {
      try {
        const res = await orig(...args);
        if (!res.ok && res.status >= 500) {
          const url = typeof args[0] === 'string' ? args[0] : 'unknown';
          // Use structured error reporting
          reportApiError(res, {
            component: 'FetchInterceptor',
            action: url,
          });
        }
        return res;
      } catch (err) {
        reportError({
          level: 'error',
          message: `Network error: ${err instanceof Error ? err.message : String(err)}`,
          stack: err instanceof Error ? err.stack : undefined,
          component: 'FetchInterceptor',
        });
        throw err;
      }
    };
  }, []);

  useEffect(() => {
    originalFetch();
  }, [originalFetch]);

  const ViewComponent = VIEW_COMPONENTS[currentView];

  return (
    <div className='flex h-dvh w-full overflow-hidden bg-background'>
      {/* Desktop Sidebar */}
      <div className='hidden md:flex'>
        <Sidebar />
      </div>

      {/* Mobile Sidebar (Sheet overlay) */}
      <MobileSidebar />

      {/* Main Content */}
      <main className='flex flex-1 flex-col overflow-hidden'>
        {/* Top Bar */}
        <header className='flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4'>
          <Button
            variant='ghost'
            size='icon'
            className='md:hidden'
            onClick={() => setSidebarMobileOpen(true)}
          >
            <Menu className='h-5 w-5' />
          </Button>

          <div className='flex-1'>
            <h1 className='text-sm font-semibold'>
              {NAV_ITEMS.find((i) => i.key === currentView)?.label || 'POS'}
            </h1>
          </div>

          <Button
            variant='ghost'
            size='icon'
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun className='h-4 w-4' /> : <Moon className='h-4 w-4' />}
          </Button>
        </header>

        {/* View Content */}
        <div className='flex-1 overflow-auto'>
          <SectionErrorBoundary sectionName={currentView}>
            {ViewComponent ? <ViewComponent /> : (
              <div className='flex h-full items-center justify-center text-muted-foreground'>
                View not found
              </div>
            )}
          </SectionErrorBoundary>
        </div>
      </main>
    </div>
  );
}
