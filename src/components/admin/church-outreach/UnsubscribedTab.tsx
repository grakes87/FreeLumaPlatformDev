'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, MailX, RotateCcw, MapPin, Mail, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface UnsubscribedChurch {
  id: number;
  name: string;
  pastor_name: string | null;
  contact_email: string | null;
  city: string | null;
  state: string | null;
  source: string;
  denomination: string | null;
  created_at: string;
  unsubscribed_at: string;
}

export default function UnsubscribedTab() {
  const [churches, setChurches] = useState<UnsubscribedChurch[]>([]);
  const [loading, setLoading] = useState(true);
  const [resubscribing, setResubscribing] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/church-outreach/unsubscribed', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setChurches(data.data?.churches ?? data.churches ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleResubscribe(churchId: number) {
    if (!confirm('Re-subscribe this church? They will be moved back to New Lead and can receive outreach emails again.')) {
      return;
    }
    setResubscribing(churchId);
    try {
      const res = await fetch('/api/admin/church-outreach/unsubscribed', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ churchId }),
      });
      if (res.ok) {
        setChurches((prev) => prev.filter((c) => c.id !== churchId));
      }
    } finally {
      setResubscribing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MailX className="h-5 w-5 text-red-500" />
          <h3 className="text-lg font-semibold text-text dark:text-text-dark">
            Unsubscribed Churches
          </h3>
          <span className={cn(
            'rounded-full px-2 py-0.5 text-xs font-bold',
            churches.length > 0
              ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
          )}>
            {churches.length}
          </span>
        </div>
        <button
          onClick={fetchData}
          className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-hover dark:text-text-muted-dark dark:hover:bg-surface-hover-dark"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {churches.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center dark:border-border-dark dark:bg-surface-dark">
          <MailX className="mx-auto mb-3 h-10 w-10 text-text-muted dark:text-text-muted-dark" />
          <p className="text-text-muted dark:text-text-muted-dark">
            No churches have unsubscribed
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {churches.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-red-200 bg-red-50/30 p-4 dark:border-red-800/50 dark:bg-red-950/20"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-text dark:text-text-dark">
                    {c.name}
                  </h4>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted dark:text-text-muted-dark">
                    {c.pastor_name && <span>Pastor: {c.pastor_name}</span>}
                    {c.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {c.city}, {c.state}
                      </span>
                    )}
                    {c.contact_email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {c.contact_email}
                      </span>
                    )}
                    {c.denomination && <span>{c.denomination}</span>}
                    <span>Source: {c.source.replace(/_/g, ' ')}</span>
                    <span className="text-red-600 dark:text-red-400">
                      Unsubscribed: {new Date(c.unsubscribed_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleResubscribe(c.id)}
                  disabled={resubscribing === c.id}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {resubscribing === c.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3 w-3" />
                  )}
                  Re-subscribe
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
