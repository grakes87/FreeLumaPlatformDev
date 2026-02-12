'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Skeleton, SkeletonText, SkeletonCircle, SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { Inbox } from 'lucide-react';

export default function TestUIPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const toast = useToast();

  return (
    <div className="mx-auto max-w-4xl space-y-12 p-8">
      <h1 className="text-3xl font-bold text-text dark:text-text-dark">
        UI Component Library Test
      </h1>

      {/* Button Variants */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Button Variants</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
        </div>

        <h2 className="text-xl font-semibold">Button Sizes</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>

        <h2 className="text-xl font-semibold">Button States</h2>
        <div className="flex flex-wrap gap-3">
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
          <Button fullWidth>Full Width</Button>
        </div>
      </section>

      {/* Input Variants */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Input</h2>
        <Input label="Email" placeholder="you@example.com" />
        <Input
          label="Password"
          type="password"
          placeholder="Enter password"
          error="Password must be at least 8 characters"
        />
        <Input placeholder="No label input" />
        <Input label="Disabled" disabled placeholder="Cannot type here" />
      </section>

      {/* Card Variants */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Card</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card padding="sm">
            <p className="text-sm">Small padding card</p>
          </Card>
          <Card padding="md">
            <p>Medium padding card</p>
          </Card>
          <Card padding="lg" hoverable>
            <p>Large padding, hoverable</p>
          </Card>
        </div>
      </section>

      {/* Modal */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Modal</h2>
        <Button onClick={() => setModalOpen(true)}>Open Modal</Button>
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Example Modal"
        >
          <p className="text-text dark:text-text-dark">
            This modal closes on backdrop click, Escape key, and the X button.
          </p>
        </Modal>
      </section>

      {/* Skeleton */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Skeleton</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-3">
            <Skeleton height={20} className="w-full" />
            <SkeletonText lines={3} />
          </div>
          <div className="flex items-center gap-3">
            <SkeletonCircle size={48} />
            <div className="flex-1">
              <Skeleton height={14} className="mb-2 w-2/3" />
              <Skeleton height={12} className="w-1/2" />
            </div>
          </div>
          <SkeletonCard />
        </div>
      </section>

      {/* Toast */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Toast</h2>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="primary"
            onClick={() => toast.success('Operation completed!')}
          >
            Success Toast
          </Button>
          <Button
            variant="danger"
            onClick={() => toast.error('Something went wrong.')}
          >
            Error Toast
          </Button>
          <Button
            variant="outline"
            onClick={() => toast.info('Here is some information.')}
          >
            Info Toast
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast.warning('Careful with this action.')}
          >
            Warning Toast
          </Button>
        </div>
      </section>

      {/* LoadingSpinner */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">LoadingSpinner</h2>
        <div className="flex items-center gap-6">
          <LoadingSpinner size="sm" />
          <LoadingSpinner size="md" />
          <LoadingSpinner size="lg" />
        </div>
      </section>

      {/* EmptyState */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">EmptyState</h2>
        <Card>
          <EmptyState
            icon={<Inbox className="h-12 w-12" />}
            title="No posts yet"
            description="When you create your first post, it will appear here."
            action={<Button size="sm">Create Post</Button>}
          />
        </Card>
      </section>
    </div>
  );
}
