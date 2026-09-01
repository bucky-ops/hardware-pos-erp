'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Store, Cpu, Database } from 'lucide-react';

interface Settings {
  id: string; storeName: string; address?: string; phone?: string; email?: string;
  taxRate: number; currency: string; currencySymbol: string; invoicePrefix: string;
  enableLoyalty: boolean; loyaltyRate: number; receiptFooter?: string;
}

export function SettingsView() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Local form state — initialized from server
  const [storeName, setStoreName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [taxRate, setTaxRate] = useState('0');
  const [currency, setCurrency] = useState('GHS');
  const [currencySymbol, setCurrencySymbol] = useState('₵');
  const [invoicePrefix, setInvoicePrefix] = useState('INV');
  const [enableLoyalty, setEnableLoyalty] = useState(true);
  const [loyaltyRate, setLoyaltyRate] = useState('1');
  const [receiptFooter, setReceiptFooter] = useState('');

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error();
      const json = await res.json();
      const s = json.data || json;
      setSettings(s);
      setStoreName(s.storeName || '');
      setAddress(s.address || '');
      setPhone(s.phone || '');
      setEmail(s.email || '');
      setTaxRate(String(s.taxRate || 0));
      setCurrency(s.currency || 'GHS');
      setCurrencySymbol(s.currencySymbol || '₵');
      setInvoicePrefix(s.invoicePrefix || 'INV');
      setEnableLoyalty(s.enableLoyalty !== false);
      setLoyaltyRate(String(s.loyaltyRate || 1));
      setReceiptFooter(s.receiptFooter || '');
    } catch { toast.error('Failed to load settings'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadSettings(); }, []);

  const handleSave = async (section: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(section),
      });
      if (!res.ok) throw new Error();
      toast.success('Settings saved');
      loadSettings();
    } catch { toast.error('Failed to save settings'); }
    finally { setSaving(false); }
  };

  const handleSeed = async () => {
    if (!confirm('This will seed demo data into the database. Continue?')) return;
    setSeeding(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      toast.success('Demo data seeded successfully');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to seed'); }
    finally { setSeeding(false); }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h2 className="text-lg font-semibold">Settings</h2>

      <Tabs defaultValue="store">
        <TabsList>
          <TabsTrigger value="store">Store Info</TabsTrigger>
          <TabsTrigger value="pos">POS Settings</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        {/* Store Info */}
        <TabsContent value="store">
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Store className="h-4 w-4" />Store Information</CardTitle>
              <CardDescription>Basic details about your store</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Store Name</Label><Input value={storeName} onChange={(e) => setStoreName(e.target.value)} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-2"><Label>Address</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => handleSave({ storeName, phone, email, address })} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                  {saving ? 'Saving...' : 'Save Store Info'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* POS Settings */}
        <TabsContent value="pos">
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Cpu className="h-4 w-4" />POS Configuration</CardTitle>
              <CardDescription>Tax rate, currency, loyalty program</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Tax Rate (%)</Label><Input type="number" step="0.1" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} /></div>
                <div className="space-y-2"><Label>Currency Code</Label><Input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="GHS" /></div>
                <div className="space-y-2"><Label>Currency Symbol</Label><Input value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)} placeholder="₵" /></div>
                <div className="space-y-2"><Label>Invoice Prefix</Label><Input value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value)} placeholder="INV" /></div>
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium">Loyalty Program</p>
                    <p className="text-xs text-muted-foreground">Award loyalty points to customers on purchases</p>
                  </div>
                  <Switch checked={enableLoyalty} onCheckedChange={setEnableLoyalty} />
                </div>
                {enableLoyalty && (
                  <div className="space-y-2 max-w-xs">
                    <Label>Loyalty Rate (points per 100 {currency})</Label>
                    <Input type="number" step="0.1" value={loyaltyRate} onChange={(e) => setLoyaltyRate(e.target.value)} />
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Receipt Footer</Label>
                <textarea
                  className="flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value)}
                  placeholder="Thank you for your business!"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={() => handleSave({
                  taxRate: parseFloat(taxRate) || 0, currency, currencySymbol,
                  invoicePrefix, enableLoyalty, loyaltyRate: parseFloat(loyaltyRate) || 1, receiptFooter,
                })} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                  {saving ? 'Saving...' : 'Save POS Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Management */}
        <TabsContent value="data">
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4" />Data Management</CardTitle>
              <CardDescription>Seed demo data for testing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium">Seed Demo Data</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Populates the database with sample products, categories, customers, suppliers, and sales for testing purposes.
                  </p>
                </div>
                <Button onClick={handleSeed} disabled={seeding} variant="outline" className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950">
                  {seeding ? 'Seeding...' : 'Seed Demo Data'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
