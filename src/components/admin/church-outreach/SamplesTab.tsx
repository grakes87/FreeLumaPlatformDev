'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  Mail,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import SampleShipmentForm from './SampleShipmentForm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PendingRequest {
  id: number;
  name: string;
  pastor_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  created_at: string;
  source: string;
}

interface Shipment {
  id: number;
  church_id: number;
  ship_date: string;
  tracking_number: string | null;
  carrier: string;
  bracelet_type: string | null;
  quantity: number | null;
  shipping_address: string | null;
  notes: string | null;
  status: 'pending' | 'shipped' | 'delivered';
  delivered_at: string | null;
  follow_up_sent_at: string | null;
  created_at: string;
  church?: {
    id: number;
    name: string;
    pipeline_stage: string;
    contact_email: string | null;
    city: string | null;
    state: string | null;
  };
}

type StatusFilter = 'all' | 'pending' | 'shipped' | 'delivered';

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; color: string; bg: string }> = {
  pending: { label: 'Pending', icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950' },
  shipped: { label: 'Shipped', icon: Truck, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950' },
  delivered: { label: 'Delivered', icon: CheckCircle2, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SamplesTab() {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showShipForm, setShowShipForm] = useState<PendingRequest | null>(null);
  const [editingShipment, setEditingShipment] = useState<number | null>(null);
  const [expandedRequest, setExpandedRequest] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, shipRes] = await Promise.all([
        fetch('/api/admin/church-outreach/samples?view=pending_requests', { credentials: 'include' }),
        fetch(`/api/admin/church-outreach/samples${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`, { credentials: 'include' }),
      ]);

      if (reqRes.ok) {
        const reqData = await reqRes.json();
        setRequests(reqData.data?.requests ?? reqData.requests ?? []);
      }
      if (shipRes.ok) {
        const shipData = await shipRes.json();
        setShipments(shipData.data?.shipments ?? shipData.shipments ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---------------------------------------------------------------------------
  // Inline tracking editor
  // ---------------------------------------------------------------------------

  function ShipmentRow({ s }: { s: Shipment }) {
    const isEditing = editingShipment === s.id;
    const [tracking, setTracking] = useState(s.tracking_number || '');
    const [carrier, setCarrier] = useState(s.carrier);
    const [saving, setSaving] = useState(false);
    const config = STATUS_CONFIG[s.status] || STATUS_CONFIG.pending;
    const StatusIcon = config.icon;

    async function handleStatusChange(newStatus: string) {
      setSaving(true);
      try {
        const res = await fetch(`/api/admin/church-outreach/samples/${s.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: newStatus }),
        });
        if (res.ok) fetchData();
      } finally {
        setSaving(false);
      }
    }

    async function saveTracking() {
      setSaving(true);
      try {
        const res = await fetch(`/api/admin/church-outreach/samples/${s.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            trackingNumber: tracking.trim() || null,
            carrier,
          }),
        });
        if (res.ok) {
          setEditingShipment(null);
          fetchData();
        }
      } finally {
        setSaving(false);
      }
    }

    return (
      <div className="rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-text dark:text-text-dark truncate">
                {s.church?.name || `Church #${s.church_id}`}
              </h4>
              <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', config.bg, config.color)}>
                <StatusIcon className="h-3 w-3" />
                {config.label}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted dark:text-text-muted-dark">
              {s.church?.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {s.church.city}, {s.church.state}
                </span>
              )}
              <span>Shipped: {s.ship_date}</span>
              {s.quantity && <span>Qty: {s.quantity}</span>}
              {s.bracelet_type && <span>Type: {s.bracelet_type}</span>}
              {s.carrier && <span>Carrier: {s.carrier.toUpperCase()}</span>}
            </div>

            {/* Tracking */}
            {isEditing ? (
              <div className="mt-2 flex items-center gap-2">
                <select
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  className="rounded-lg border border-border bg-background px-2 py-1 text-xs dark:border-border-dark dark:bg-background-dark"
                >
                  {['usps', 'ups', 'fedex', 'other'].map((c) => (
                    <option key={c} value={c}>{c.toUpperCase()}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                  placeholder="Tracking number"
                  className="flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs dark:border-border-dark dark:bg-background-dark"
                />
                <button
                  onClick={saveTracking}
                  disabled={saving}
                  className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                </button>
                <button
                  onClick={() => setEditingShipment(null)}
                  className="text-xs text-text-muted hover:text-text dark:text-text-muted-dark"
                >
                  Cancel
                </button>
              </div>
            ) : s.tracking_number ? (
              <button
                onClick={() => setEditingShipment(s.id)}
                className="mt-1 text-xs text-primary hover:underline"
              >
                Tracking: {s.tracking_number}
              </button>
            ) : (
              <button
                onClick={() => setEditingShipment(s.id)}
                className="mt-1 text-xs text-primary hover:underline"
              >
                + Add tracking number
              </button>
            )}

            {s.delivered_at && (
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                Delivered: {new Date(s.delivered_at).toLocaleDateString()}
                {s.follow_up_sent_at && (
                  <span className="ml-2 text-text-muted dark:text-text-muted-dark">
                    Follow-up sent: {new Date(s.follow_up_sent_at).toLocaleDateString()}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Status actions */}
          <div className="flex flex-col gap-1">
            {s.status === 'pending' && (
              <button
                onClick={() => handleStatusChange('shipped')}
                disabled={saving}
                className="flex items-center gap-1 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50"
              >
                <Truck className="h-3 w-3" />
                Mark Shipped
              </button>
            )}
            {s.status === 'shipped' && (
              <button
                onClick={() => handleStatusChange('delivered')}
                disabled={saving}
                className="flex items-center gap-1 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600 disabled:opacity-50"
              >
                <CheckCircle2 className="h-3 w-3" />
                Mark Delivered
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Requests Section */}
      {requests.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Package className="h-5 w-5 text-amber-500" />
            <h3 className="text-lg font-semibold text-text dark:text-text-dark">
              Pending Requests
            </h3>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900 dark:text-amber-300">
              {requests.length}
            </span>
          </div>
          <p className="mb-3 text-sm text-text-muted dark:text-text-muted-dark">
            Churches that submitted a sample request but haven&apos;t been shipped yet.
          </p>
          <div className="space-y-2">
            {requests.map((r, idx) => (
              <div
                key={`${r.id}-${idx}`}
                className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-950/30"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => setExpandedRequest(expandedRequest === r.id ? null : r.id)}
                      className="flex items-center gap-2 text-left"
                    >
                      <h4 className="font-semibold text-text dark:text-text-dark">
                        {r.name}
                      </h4>
                      {expandedRequest === r.id ? (
                        <ChevronUp className="h-4 w-4 text-text-muted" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-text-muted" />
                      )}
                    </button>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted dark:text-text-muted-dark mt-1">
                      {r.pastor_name && <span>Pastor: {r.pastor_name}</span>}
                      {r.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {r.city}, {r.state}
                        </span>
                      )}
                      {r.contact_email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {r.contact_email}
                        </span>
                      )}
                      <span>Requested: {new Date(r.created_at).toLocaleDateString()}</span>
                    </div>

                    {/* Expanded details */}
                    {expandedRequest === r.id && (
                      <div className="mt-3 rounded-lg bg-white p-3 text-sm dark:bg-surface-dark">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="font-medium text-text-muted dark:text-text-muted-dark">Address:</span>
                            <p className="text-text dark:text-text-dark">
                              {r.address_line1}<br />
                              {r.city}, {r.state} {r.zip_code}
                            </p>
                          </div>
                          {r.contact_phone && (
                            <div>
                              <span className="font-medium text-text-muted dark:text-text-muted-dark">Phone:</span>
                              <p className="text-text dark:text-text-dark">{r.contact_phone}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setShowShipForm(r)}
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary/90"
                  >
                    <Truck className="h-3 w-3" />
                    Ship Sample
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shipments Section */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-text dark:text-text-dark">
              Shipments
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-hover dark:text-text-muted-dark dark:hover:bg-surface-hover-dark"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium dark:border-border-dark dark:bg-surface-dark"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
            </select>
          </div>
        </div>

        {shipments.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center dark:border-border-dark dark:bg-surface-dark">
            <Package className="mx-auto mb-3 h-10 w-10 text-text-muted dark:text-text-muted-dark" />
            <p className="text-text-muted dark:text-text-muted-dark">
              No shipments {statusFilter !== 'all' ? `with status "${statusFilter}"` : 'yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {shipments.map((s) => (
              <ShipmentRow key={s.id} s={s} />
            ))}
          </div>
        )}
      </div>

      {/* Ship Sample Modal */}
      {showShipForm && (
        <SampleShipmentForm
          isOpen
          churchId={showShipForm.id}
          churchName={showShipForm.name}
          onSuccess={() => {
            setShowShipForm(null);
            fetchData();
          }}
          onCancel={() => setShowShipForm(null)}
        />
      )}
    </div>
  );
}
