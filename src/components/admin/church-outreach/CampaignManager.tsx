'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  Plus,
  ArrowLeft,
  Send,
  Save,
  Mail,
  MousePointerClick,
  Eye,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import TemplateEditor from './TemplateEditor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Template {
  id: number;
  name: string;
  subject: string;
  html_body: string;
  merge_fields: string[] | null;
  is_default: boolean;
}

interface Campaign {
  id: number;
  name: string;
  template_id: number;
  filter_criteria: Record<string, string[]> | null;
  status: 'draft' | 'sending' | 'sent' | 'cancelled';
  sent_count: number | null;
  open_count: number | null;
  click_count: number | null;
  sent_at: string | null;
  created_at: string;
  template?: { id: number; name: string };
}

interface CampaignEmail {
  id: number;
  church_id: number;
  to_email: string;
  subject: string;
  status: string;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PIPELINE_STAGES = [
  { value: 'new_lead', label: 'New Lead' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'engaged', label: 'Engaged' },
  { value: 'sample_requested', label: 'Sample Requested' },
  { value: 'sample_sent', label: 'Sample Sent' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  sending: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  sent: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CampaignManager() {
  // State
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail view
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaignEmails, setCampaignEmails] = useState<CampaignEmail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create form
  const [campaignName, setCampaignName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');
  const [filterStages, setFilterStages] = useState<string[]>([]);
  const [filterStates, setFilterStates] = useState('');
  const [filterDenominations, setFilterDenominations] = useState('');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [pendingCampaignId, setPendingCampaignId] = useState<number | null>(null);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/church-outreach/campaigns', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load campaigns');
      const data = await res.json();
      setCampaigns(data.data?.campaigns ?? data.campaigns ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/church-outreach/templates', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load templates');
      const data = await res.json();
      setTemplates(data.data?.templates ?? data.templates ?? []);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchCampaigns(), fetchTemplates()]);
      setLoading(false);
    };
    load();
  }, [fetchCampaigns, fetchTemplates]);

  // ---------------------------------------------------------------------------
  // Campaign detail
  // ---------------------------------------------------------------------------

  const viewCampaignDetail = async (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setView('detail');
    setDetailLoading(true);

    try {
      const res = await fetch(`/api/admin/church-outreach/campaigns/${campaign.id}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load campaign detail');
      const data = await res.json();
      const detail = data.data ?? data;
      setSelectedCampaign(detail.campaign);
      setCampaignEmails(detail.emails ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaign');
    } finally {
      setDetailLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Create / Send
  // ---------------------------------------------------------------------------

  const buildFilterCriteria = () => {
    const criteria: Record<string, string[]> = {};
    if (filterStages.length > 0) criteria.stages = filterStages;
    if (filterStates.trim()) {
      criteria.states = filterStates.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (filterDenominations.trim()) {
      criteria.denominations = filterDenominations.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return Object.keys(criteria).length > 0 ? criteria : undefined;
  };

  const handlePreviewRecipients = async () => {
    if (!selectedTemplateId) return;
    setCreateLoading(true);
    try {
      const res = await fetch('/api/admin/church-outreach/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: campaignName.trim() || 'Preview',
          templateId: selectedTemplateId,
          filterCriteria: buildFilterCriteria(),
        }),
      });
      if (!res.ok) throw new Error('Failed to preview');
      const data = await res.json();
      const result = data.data ?? data;
      setPreviewCount(result.matching_church_count);
      // Store the campaign ID so we can send it
      setPendingCampaignId(result.campaign?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview recipients');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSaveAsDraft = async () => {
    if (!campaignName.trim() || !selectedTemplateId) return;
    setCreateLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/church-outreach/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: campaignName.trim(),
          templateId: selectedTemplateId,
          filterCriteria: buildFilterCriteria(),
        }),
      });
      if (!res.ok) throw new Error('Failed to create campaign');
      await fetchCampaigns();
      resetCreateForm();
      setView('list');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSendCampaign = async () => {
    if (!pendingCampaignId) return;
    setSendLoading(true);
    setError(null);
    setShowSendConfirm(false);
    try {
      const res = await fetch(`/api/admin/church-outreach/campaigns/${pendingCampaignId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'send' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to send campaign');
      }
      await fetchCampaigns();
      resetCreateForm();
      setView('list');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send campaign');
    } finally {
      setSendLoading(false);
    }
  };

  const handleSendExistingCampaign = async (campaignId: number) => {
    setSendLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/church-outreach/campaigns/${campaignId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'send' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to send campaign');
      }
      await fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send campaign');
    } finally {
      setSendLoading(false);
    }
  };

  const resetCreateForm = () => {
    setCampaignName('');
    setSelectedTemplateId('');
    setFilterStages([]);
    setFilterStates('');
    setFilterDenominations('');
    setPreviewCount(null);
    setPendingCampaignId(null);
    setShowSendConfirm(false);
  };

  const handleTemplateSaved = (template: Template) => {
    setShowTemplateEditor(false);
    setEditingTemplate(null);
    fetchTemplates();
    if (template?.id) {
      setSelectedTemplateId(template.id);
    }
  };

  const toggleStage = (stage: string) => {
    setFilterStages((prev) =>
      prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage]
    );
    setPreviewCount(null);
    setPendingCampaignId(null);
  };

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Detail view
  // ---------------------------------------------------------------------------

  if (view === 'detail' && selectedCampaign) {
    const sent = campaignEmails.filter((e) => ['sent', 'opened', 'clicked'].includes(e.status)).length;
    const opened = campaignEmails.filter((e) => e.opened_at).length;
    const clicked = campaignEmails.filter((e) => e.clicked_at).length;

    return (
      <div className="space-y-6">
        {/* Back button */}
        <button
          onClick={() => { setView('list'); setSelectedCampaign(null); setCampaignEmails([]); }}
          className="flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Campaigns
        </button>

        {/* Campaign header */}
        <div className="rounded-xl border border-border bg-surface p-6 dark:border-border-dark dark:bg-surface-dark">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-text dark:text-text-dark">
                {selectedCampaign.name}
              </h3>
              <p className="mt-1 text-sm text-text-muted dark:text-text-muted-dark">
                Template: {selectedCampaign.template?.name || 'Unknown'}
              </p>
            </div>
            <span className={cn('rounded-full px-3 py-1 text-xs font-medium', STATUS_COLORS[selectedCampaign.status] || STATUS_COLORS.draft)}>
              {selectedCampaign.status}
            </span>
          </div>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-surface-hover p-3 text-center dark:bg-surface-hover-dark">
              <Send className="mx-auto mb-1 h-4 w-4 text-blue-500" />
              <p className="text-lg font-bold text-text dark:text-text-dark">{sent}</p>
              <p className="text-xs text-text-muted dark:text-text-muted-dark">Sent</p>
            </div>
            <div className="rounded-lg bg-surface-hover p-3 text-center dark:bg-surface-hover-dark">
              <Eye className="mx-auto mb-1 h-4 w-4 text-purple-500" />
              <p className="text-lg font-bold text-text dark:text-text-dark">{opened}</p>
              <p className="text-xs text-text-muted dark:text-text-muted-dark">
                Opened ({sent > 0 ? Math.round((opened / sent) * 100) : 0}%)
              </p>
            </div>
            <div className="rounded-lg bg-surface-hover p-3 text-center dark:bg-surface-hover-dark">
              <MousePointerClick className="mx-auto mb-1 h-4 w-4 text-green-500" />
              <p className="text-lg font-bold text-text dark:text-text-dark">{clicked}</p>
              <p className="text-xs text-text-muted dark:text-text-muted-dark">
                Clicked ({sent > 0 ? Math.round((clicked / sent) * 100) : 0}%)
              </p>
            </div>
          </div>
        </div>

        {/* Email list */}
        <div className="rounded-xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark">
          <div className="border-b border-border px-6 py-3 dark:border-border-dark">
            <h4 className="text-sm font-semibold text-text dark:text-text-dark">
              Emails ({campaignEmails.length})
            </h4>
          </div>
          {detailLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : campaignEmails.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-text-muted dark:text-text-muted-dark">
              No emails sent yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left dark:border-border-dark">
                    <th className="px-6 py-2 font-medium text-text-muted dark:text-text-muted-dark">To</th>
                    <th className="px-4 py-2 font-medium text-text-muted dark:text-text-muted-dark">Status</th>
                    <th className="px-4 py-2 font-medium text-text-muted dark:text-text-muted-dark">Sent</th>
                    <th className="px-4 py-2 font-medium text-text-muted dark:text-text-muted-dark">Opened</th>
                    <th className="px-4 py-2 font-medium text-text-muted dark:text-text-muted-dark">Clicked</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignEmails.map((email) => (
                    <tr key={email.id} className="border-b border-border/50 dark:border-border-dark/50">
                      <td className="px-6 py-2 text-text dark:text-text-dark">{email.to_email}</td>
                      <td className="px-4 py-2">
                        <span className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          email.status === 'sent' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                          email.status === 'bounced' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                          'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        )}>
                          {email.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-text-muted dark:text-text-muted-dark">
                        {email.sent_at ? new Date(email.sent_at).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 py-2 text-text-muted dark:text-text-muted-dark">
                        {email.opened_at ? new Date(email.opened_at).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 py-2 text-text-muted dark:text-text-muted-dark">
                        {email.clicked_at ? new Date(email.clicked_at).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Create view
  // ---------------------------------------------------------------------------

  if (view === 'create') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => { setView('list'); resetCreateForm(); }}
            className="flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Campaigns
          </button>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 dark:border-border-dark dark:bg-surface-dark">
          <h3 className="mb-4 text-lg font-semibold text-text dark:text-text-dark">
            Create Campaign
          </h3>

          <div className="space-y-4">
            {/* Campaign name */}
            <div>
              <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
                Campaign Name
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g. March Outreach - Baptist Churches"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
              />
            </div>

            {/* Template selector */}
            <div>
              <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
                Email Template
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value ? Number(e.target.value) : '')}
                  className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
                >
                  <option value="">Select a template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}{t.is_default ? ' (default)' : ''}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => { setEditingTemplate(null); setShowTemplateEditor(true); }}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 dark:border-border-dark"
                >
                  <Plus className="h-4 w-4" />
                  New
                </button>
              </div>
            </div>

            {/* Filter: Pipeline stages */}
            <div>
              <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
                Pipeline Stages (filter recipients)
              </label>
              <div className="flex flex-wrap gap-2">
                {PIPELINE_STAGES.map((stage) => (
                  <button
                    key={stage.value}
                    type="button"
                    onClick={() => toggleStage(stage.value)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                      filterStages.includes(stage.value)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-text-muted hover:border-primary/50 dark:border-border-dark dark:text-text-muted-dark'
                    )}
                  >
                    {stage.label}
                  </button>
                ))}
              </div>
              {filterStages.length === 0 && (
                <p className="mt-1 text-xs text-text-muted dark:text-text-muted-dark">
                  No stages selected = all stages
                </p>
              )}
            </div>

            {/* Filter: States */}
            <div>
              <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
                States (comma-separated)
              </label>
              <input
                type="text"
                value={filterStates}
                onChange={(e) => { setFilterStates(e.target.value); setPreviewCount(null); setPendingCampaignId(null); }}
                placeholder="e.g. TX, TN, CA"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
              />
            </div>

            {/* Filter: Denominations */}
            <div>
              <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
                Denominations (comma-separated)
              </label>
              <input
                type="text"
                value={filterDenominations}
                onChange={(e) => { setFilterDenominations(e.target.value); setPreviewCount(null); setPendingCampaignId(null); }}
                placeholder="e.g. Baptist, Methodist, Non-Denominational"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
              />
            </div>

            {/* Preview / Actions */}
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4 dark:border-border-dark">
              <button
                type="button"
                onClick={handlePreviewRecipients}
                disabled={!selectedTemplateId || !campaignName.trim() || createLoading}
                className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-hover disabled:opacity-50 dark:border-border-dark dark:text-text-dark dark:hover:bg-surface-hover-dark"
              >
                {createLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Preview Recipients
              </button>

              {previewCount !== null && (
                <span className="text-sm font-medium text-text dark:text-text-dark">
                  {previewCount} eligible churches
                </span>
              )}

              <div className="flex-1" />

              <button
                type="button"
                onClick={handleSaveAsDraft}
                disabled={!selectedTemplateId || !campaignName.trim() || createLoading}
                className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-hover disabled:opacity-50 dark:border-border-dark dark:text-text-dark dark:hover:bg-surface-hover-dark"
              >
                <Save className="h-4 w-4" />
                Save as Draft
              </button>

              {pendingCampaignId && previewCount !== null && previewCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowSendConfirm(true)}
                  disabled={sendLoading}
                  className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {sendLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send Now
                </button>
              )}
            </div>

            {/* Send confirmation */}
            {showSendConfirm && (
              <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    This will send to {previewCount} churches. Continue?
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSendConfirm(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text dark:text-text-muted-dark"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendCampaign}
                  disabled={sendLoading}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90"
                >
                  {sendLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  Confirm Send
                </button>
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>
        </div>

        {/* Template editor modal */}
        {showTemplateEditor && (
          <TemplateEditor
            template={editingTemplate}
            onSave={handleTemplateSaved}
            onCancel={() => { setShowTemplateEditor(false); setEditingTemplate(null); }}
          />
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // List view (default)
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text dark:text-text-dark">Campaigns</h3>
        <div className="flex gap-2">
          <button
            onClick={fetchCampaigns}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm text-text-muted transition-colors hover:text-text dark:border-border-dark dark:text-text-muted-dark dark:hover:text-text-dark"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView('create')}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Campaign
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Campaign list */}
      {campaigns.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center dark:border-border-dark dark:bg-surface-dark">
          <Mail className="mx-auto mb-3 h-10 w-10 text-text-muted/40 dark:text-text-muted-dark/40" />
          <p className="text-sm text-text-muted dark:text-text-muted-dark">
            No campaigns yet. Create your first campaign to start outreach.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left dark:border-border-dark">
                <th className="px-6 py-3 font-medium text-text-muted dark:text-text-muted-dark">Name</th>
                <th className="px-4 py-3 font-medium text-text-muted dark:text-text-muted-dark">Template</th>
                <th className="px-4 py-3 font-medium text-text-muted dark:text-text-muted-dark">Status</th>
                <th className="px-4 py-3 text-right font-medium text-text-muted dark:text-text-muted-dark">Sent</th>
                <th className="px-4 py-3 text-right font-medium text-text-muted dark:text-text-muted-dark">Opens</th>
                <th className="px-4 py-3 text-right font-medium text-text-muted dark:text-text-muted-dark">Clicks</th>
                <th className="px-4 py-3 font-medium text-text-muted dark:text-text-muted-dark">Date</th>
                <th className="px-4 py-3 font-medium text-text-muted dark:text-text-muted-dark"></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => viewCampaignDetail(c)}
                  className="cursor-pointer border-b border-border/50 transition-colors hover:bg-surface-hover dark:border-border-dark/50 dark:hover:bg-surface-hover-dark"
                >
                  <td className="px-6 py-3 font-medium text-text dark:text-text-dark">{c.name}</td>
                  <td className="px-4 py-3 text-text-muted dark:text-text-muted-dark">{c.template?.name || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_COLORS[c.status] || STATUS_COLORS.draft)}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-text-muted dark:text-text-muted-dark">{c.sent_count ?? 0}</td>
                  <td className="px-4 py-3 text-right text-text-muted dark:text-text-muted-dark">{c.open_count ?? 0}</td>
                  <td className="px-4 py-3 text-right text-text-muted dark:text-text-muted-dark">{c.click_count ?? 0}</td>
                  <td className="px-4 py-3 text-text-muted dark:text-text-muted-dark">
                    {c.sent_at ? new Date(c.sent_at).toLocaleDateString() : new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {c.status === 'draft' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSendExistingCampaign(c.id); }}
                        disabled={sendLoading}
                        className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary/90"
                      >
                        <Send className="h-3 w-3" />
                        Send
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Template editor modal */}
      {showTemplateEditor && (
        <TemplateEditor
          template={editingTemplate}
          onSave={handleTemplateSaved}
          onCancel={() => { setShowTemplateEditor(false); setEditingTemplate(null); }}
        />
      )}
    </div>
  );
}

export { CampaignManager };
