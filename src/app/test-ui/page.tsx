'use client';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

export default function TestUIPage() {
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
    </div>
  );
}
