'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bug, CheckCircle, Trash2 } from 'lucide-react';

interface ErrorLog {
  id: string; level: string; message: string; component?: string; timestamp: string; resolved: boolean;
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-2 py-3">
      <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
      <div className="flex gap-1">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>Prev</Button>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

function LevelBadge({ level }: { level: string }) {
  const cls: Record<string, string> = {
    error: 'bg-red-500 text-white border-red-500',
    warn: 'bg-amber-500 text-white border-amber-500',
    info: 'bg-sky-500 text-white border-sky-500',
  };
  return <Badge className={cls[level] || ''}>{level}</Badge>;
}

export function ErrorLogView() {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [levelFilter, setLevelFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [clearing, setClearing] = useState(false);

  const fetchErrors = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (levelFilter) params.set('level', levelFilter);
    try {
      const res = await fetch(`/api/errors?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setErrors(json.errors || []);
      setTotalPages(Math.ceil((json.total || 0) / 50));
      setUnresolvedCount(json.unresolvedCount || 0);
    } catch { toast.error('Failed to fetch errors'); }
    finally { setLoading(false); }
  }, [page, levelFilter]);

  useEffect(() => { fetchErrors(); }, [fetchErrors]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const resolveSelected = async () => {
    if (selectedIds.size === 0) return;
    try {
      const res = await fetch('/api/errors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${selectedIds.size} error(s) marked as resolved`);
      setSelectedIds(new Set());
      fetchErrors();
    } catch { toast.error('Failed to resolve errors'); }
  };

  const clearResolved = async () => {
    if (!confirm('Clear all resolved errors?')) return;
    setClearing(true);
    try {
      const res = await fetch('/api/errors', { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Resolved errors cleared');
      fetchErrors();
    } catch { toast.error('Failed to clear errors'); }
    finally { setClearing(false); }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Error Log</h2>
          {unresolvedCount > 0 && (
            <Badge variant="destructive" className="text-xs">{unresolvedCount} unresolved</Badge>
          )}
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <Button size="sm" variant="outline" onClick={resolveSelected} className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950">
              <CheckCircle className="h-4 w-4 mr-1" />Resolve ({selectedIds.size})
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={clearResolved} disabled={clearing}>
            <Trash2 className="h-4 w-4 mr-1" />{clearing ? 'Clearing...' : 'Clear Resolved'}
          </Button>
        </div>
      </div>

      <Select value={levelFilter || 'all'} onValueChange={(v) => { setLevelFilter(v === 'all' ? '' : v); setPage(1); }}>
        <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="All Levels" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Levels</SelectItem>
          <SelectItem value="error">Error</SelectItem>
          <SelectItem value="warn">Warning</SelectItem>
          <SelectItem value="info">Info</SelectItem>
        </SelectContent>
      </Select>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : errors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Bug className="h-10 w-10 mb-2" /><p className="text-sm">No errors logged</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-10">✓</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="hidden md:table-cell">Component</TableHead>
                  <TableHead className="hidden sm:table-cell">Time</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {errors.map((e) => (
                    <TableRow key={e.id} className={e.resolved ? 'opacity-50' : ''}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(e.id)}
                          onChange={() => toggleSelect(e.id)}
                          disabled={e.resolved}
                          className="h-4 w-4 rounded border-input accent-emerald-600"
                        />
                      </TableCell>
                      <TableCell><LevelBadge level={e.level} /></TableCell>
                      <TableCell className="font-mono text-xs max-w-[300px] truncate" title={e.message}>{e.message}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-xs">{e.component || '—'}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-xs whitespace-nowrap">{new Date(e.timestamp).toLocaleString()}</TableCell>
                      <TableCell>
                        {e.resolved ? (
                          <Badge variant="secondary" className="text-emerald-600">Resolved</Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-500 border-red-300 dark:border-red-800">Open</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </CardContent>
      </Card>
    </div>
  );
}
