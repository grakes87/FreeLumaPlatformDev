'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  Trash2,
  PauseCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';

export function DangerZone() {
  const [expanded, setExpanded] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  return (
    <Card padding="sm" className="!p-0 overflow-hidden border-red-200 dark:border-red-900/50">
      {/* Header - collapsible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors"
      >
        <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
        <span className="flex-1 text-sm font-semibold text-red-600 dark:text-red-400">
          Danger Zone
        </span>
        <ChevronRight
          className={cn(
            'h-4 w-4 text-red-400 transition-transform',
            expanded && 'rotate-90'
          )}
        />
      </button>

      {expanded && (
        <div className="border-t border-red-200 dark:border-red-900/50">
          {/* Deactivate Account */}
          <div className="px-4 py-4">
            <div className="flex items-start gap-3">
              <PauseCircle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-text dark:text-text-dark">
                  Deactivate Account
                </h4>
                <p className="mt-1 text-xs text-text-muted dark:text-text-muted-dark leading-relaxed">
                  Temporarily deactivate your account. Your profile will show as
                  deactivated. You can reactivate anytime by logging back in.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20"
                  onClick={() => setShowDeactivateModal(true)}
                >
                  Deactivate Account
                </Button>
              </div>
            </div>
          </div>

          <div className="mx-4 border-t border-red-200 dark:border-red-900/50" />

          {/* Delete Account */}
          <div className="px-4 py-4">
            <div className="flex items-start gap-3">
              <Trash2 className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-text dark:text-text-dark">
                  Delete Account
                </h4>
                <p className="mt-1 text-xs text-text-muted dark:text-text-muted-dark leading-relaxed">
                  Permanently delete your account. After 30 days, all your data
                  will be permanently removed. You can cancel by logging in
                  within 30 days.
                </p>
                <Button
                  variant="danger"
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowDeleteModal(true)}
                >
                  Delete Account
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation Modal */}
      <DeactivateModal
        isOpen={showDeactivateModal}
        onClose={() => setShowDeactivateModal(false)}
      />

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
      />
    </Card>
  );
}

// ---- Deactivate Modal ----

function DeactivateModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const { logout } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleDeactivate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/account/deactivate', {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        toast.info('Account deactivated. Log in again to reactivate.');
        onClose();
        await logout();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to deactivate account.');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Deactivate Account?" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-text-muted dark:text-text-muted-dark leading-relaxed">
          Your account will be deactivated immediately. Your profile will not be
          visible to other users. You can reactivate by logging in again.
        </p>

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={loading}
            onClick={handleDeactivate}
          >
            Deactivate
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---- Delete Modal ----

function DeleteModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const { logout } = useAuth();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: password || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to delete account.');
        setLoading(false);
        return;
      }

      toast.info('Account scheduled for deletion. Log in within 30 days to cancel.');
      setPassword('');
      onClose();
      await logout();
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Delete Account Permanently?" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-text-muted dark:text-text-muted-dark leading-relaxed">
          This will schedule your account for permanent deletion in 30 days.
          All your content will be anonymized. Enter your password to confirm.
        </p>

        <Input
          type="password"
          label="Confirm Password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error || undefined}
          autoComplete="current-password"
        />

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={loading}
            onClick={handleDelete}
          >
            Delete My Account
          </Button>
        </div>
      </div>
    </Modal>
  );
}
