'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronDown, ChevronUp, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

// --- Types ---

interface WorkshopCategory {
  id: number;
  name: string;
  slug: string;
}

export interface WorkshopFormData {
  title: string;
  description: string;
  category_id: number | null;
  date: string;
  time: string;
  duration_minutes: number | null;
  is_private: boolean;
  // Series fields
  is_recurring: boolean;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  byDay: string[];
  endCondition: 'never' | 'count' | 'until';
  occurrenceCount: number;
  untilDate: string;
}

export interface CreateWorkshopFormProps {
  mode: 'create' | 'edit';
  initialData?: Partial<WorkshopFormData>;
  workshopId?: number;
  onSuccess?: (workshop: { id: number }) => void;
}

// --- Validation schema ---

const workshopFormSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title cannot exceed 200 characters'),
  description: z
    .string()
    .max(5000, 'Description cannot exceed 5000 characters')
    .optional()
    .or(z.literal('')),
  category_id: z.number().int().positive().nullable(),
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
  duration_minutes: z
    .number()
    .int()
    .min(15, 'Minimum duration is 15 minutes')
    .max(480, 'Maximum duration is 8 hours')
    .nullable(),
  is_private: z.boolean(),
  is_recurring: z.boolean(),
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly']),
  byDay: z.array(z.string()),
  endCondition: z.enum(['never', 'count', 'until']),
  occurrenceCount: z.number().int().min(1).max(52),
  untilDate: z.string(),
});

type FormValues = z.infer<typeof workshopFormSchema>;

// --- Constants ---

const DAYS_OF_WEEK = [
  { value: 'MO', label: 'Mon' },
  { value: 'TU', label: 'Tue' },
  { value: 'WE', label: 'Wed' },
  { value: 'TH', label: 'Thu' },
  { value: 'FR', label: 'Fri' },
  { value: 'SA', label: 'Sat' },
  { value: 'SU', label: 'Sun' },
];

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
];

// --- Component ---

export function CreateWorkshopForm({
  mode,
  initialData,
  workshopId,
  onSuccess,
}: CreateWorkshopFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [categories, setCategories] = useState<WorkshopCategory[]>([]);
  const [showRecurring, setShowRecurring] = useState(false);
  const [serverError, setServerError] = useState('');

  // Detect timezone
  const detectedTimezone =
    typeof window !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC';

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(workshopFormSchema),
    defaultValues: {
      title: initialData?.title ?? '',
      description: initialData?.description ?? '',
      category_id: initialData?.category_id ?? null,
      date: initialData?.date ?? '',
      time: initialData?.time ?? '',
      duration_minutes: initialData?.duration_minutes ?? null,
      is_private: initialData?.is_private ?? false,
      is_recurring: false,
      frequency: 'weekly',
      byDay: [],
      endCondition: 'never',
      occurrenceCount: 4,
      untilDate: '',
    },
  });

  const isRecurring = watch('is_recurring');
  const frequency = watch('frequency');
  const endCondition = watch('endCondition');
  const selectedDays = watch('byDay');

  // Fetch categories
  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch('/api/workshops/categories', {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setCategories(data.categories || []);
        }
      } catch {
        // Non-critical
      }
    }
    fetchCategories();
  }, []);

  // Toggle recurring section
  useEffect(() => {
    if (isRecurring) {
      setShowRecurring(true);
    }
  }, [isRecurring]);

  // Validate 15-minute lead time on combined date+time
  function validateLeadTime(date: string, time: string): string | null {
    if (!date || !time) return null;
    const combined = new Date(`${date}T${time}`);
    const minTime = new Date(Date.now() + 15 * 60 * 1000);
    if (combined < minTime) {
      return 'Workshop must be scheduled at least 15 minutes from now';
    }
    return null;
  }

  const onSubmit = async (data: FormValues) => {
    setServerError('');

    // Validate lead time
    const leadTimeError = validateLeadTime(data.date, data.time);
    if (leadTimeError) {
      setServerError(leadTimeError);
      return;
    }

    try {
      if (mode === 'edit' && workshopId) {
        // PUT to update workshop
        const scheduledAt = new Date(`${data.date}T${data.time}`).toISOString();
        const res = await fetch(`/api/workshops/${workshopId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title: data.title,
            description: data.description || null,
            category_id: data.category_id,
            scheduled_at: scheduledAt,
            duration_minutes: data.duration_minutes,
            is_private: data.is_private,
          }),
        });

        const result = await res.json();
        if (!res.ok) {
          setServerError(result.error || 'Failed to update workshop');
          return;
        }

        toast.success('Workshop updated successfully!');
        if (onSuccess) {
          onSuccess(result.workshop);
        } else {
          router.push(`/workshops/${workshopId}`);
        }
      } else if (data.is_recurring) {
        // POST to series endpoint
        const seriesBody: Record<string, unknown> = {
          title: data.title,
          description: data.description || undefined,
          category_id: data.category_id || undefined,
          frequency: data.frequency,
          time_of_day: data.time,
          timezone: detectedTimezone,
          duration_minutes: data.duration_minutes || undefined,
          is_private: data.is_private,
        };

        // Add byDay for weekly/biweekly
        if (
          (data.frequency === 'weekly' || data.frequency === 'biweekly') &&
          data.byDay.length > 0
        ) {
          seriesBody.byDay = data.byDay;
        }

        // Add end condition
        if (data.endCondition === 'count' && data.occurrenceCount) {
          seriesBody.count = data.occurrenceCount;
        } else if (data.endCondition === 'until' && data.untilDate) {
          seriesBody.until = new Date(`${data.untilDate}T23:59:59`).toISOString();
        }

        const res = await fetch('/api/workshops/series', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(seriesBody),
        });

        const result = await res.json();
        if (!res.ok) {
          setServerError(result.error || 'Failed to create workshop series');
          return;
        }

        toast.success('Recurring workshop series created!');
        if (onSuccess && result.workshops?.[0]) {
          onSuccess({ id: result.workshops[0].id });
        } else {
          router.push('/workshops');
        }
      } else {
        // POST single workshop
        const scheduledAt = new Date(`${data.date}T${data.time}`).toISOString();
        const res = await fetch('/api/workshops', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title: data.title,
            description: data.description || undefined,
            category_id: data.category_id || undefined,
            scheduled_at: scheduledAt,
            duration_minutes: data.duration_minutes || undefined,
            is_private: data.is_private,
          }),
        });

        const result = await res.json();
        if (!res.ok) {
          setServerError(result.error || 'Failed to create workshop');
          return;
        }

        toast.success('Workshop created successfully!');
        if (onSuccess) {
          onSuccess(result.workshop);
        } else {
          router.push(`/workshops/${result.workshop.id}`);
        }
      }
    } catch {
      setServerError('Something went wrong. Please try again.');
    }
  };

  const toggleDay = (day: string) => {
    const current = selectedDays || [];
    if (current.includes(day)) {
      setValue(
        'byDay',
        current.filter((d) => d !== day)
      );
    } else {
      setValue('byDay', [...current, day]);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Title */}
      <Input
        {...register('title')}
        label="Title"
        placeholder="e.g., Morning Prayer Circle"
        error={errors.title?.message}
        autoFocus
      />

      {/* Description */}
      <div className="w-full">
        <label
          htmlFor="description"
          className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark"
        >
          Description
        </label>
        <textarea
          {...register('description')}
          id="description"
          rows={4}
          placeholder="What will this workshop cover? (optional)"
          className={cn(
            'w-full rounded-xl border bg-surface px-4 py-3 text-text transition-colors placeholder:text-text-muted',
            'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
            'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:placeholder:text-text-muted-dark',
            errors.description ? 'border-red-500' : 'border-border',
            'resize-none'
          )}
        />
        {errors.description?.message && (
          <p className="mt-1.5 text-sm text-red-500">
            {errors.description.message}
          </p>
        )}
      </div>

      {/* Category */}
      <div className="w-full">
        <label
          htmlFor="category_id"
          className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark"
        >
          Category
        </label>
        <Controller
          name="category_id"
          control={control}
          render={({ field }) => (
            <select
              id="category_id"
              value={field.value ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                field.onChange(val ? parseInt(val, 10) : null);
              }}
              className={cn(
                'w-full rounded-xl border border-border bg-surface px-4 py-3 text-text transition-colors',
                'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
                'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark'
              )}
            >
              <option value="">No category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          )}
        />
      </div>

      {/* Date & Time */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          {...register('date')}
          label="Date"
          type="date"
          error={errors.date?.message}
          min={new Date().toISOString().split('T')[0]}
        />
        <Input
          {...register('time')}
          label="Time"
          type="time"
          error={errors.time?.message}
        />
      </div>

      {/* Duration */}
      <Controller
        name="duration_minutes"
        control={control}
        render={({ field }) => (
          <Input
            label="Duration (minutes)"
            type="number"
            placeholder="Estimated duration (optional)"
            value={field.value ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              field.onChange(val ? parseInt(val, 10) : null);
            }}
            error={errors.duration_minutes?.message}
            min={15}
            max={480}
          />
        )}
      />

      {/* Privacy toggle */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 dark:border-border-dark dark:bg-surface-dark">
        <div>
          <p className="text-sm font-medium text-text dark:text-text-dark">
            Private (invite-only)
          </p>
          <p className="text-xs text-text-muted dark:text-text-muted-dark">
            Only invited users can see and join
          </p>
        </div>
        <Controller
          name="is_private"
          control={control}
          render={({ field }) => (
            <button
              type="button"
              role="switch"
              aria-checked={field.value}
              onClick={() => field.onChange(!field.value)}
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                field.value ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200',
                  field.value ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
          )}
        />
      </div>

      {/* Recurring Series (create mode only) */}
      {mode === 'create' && (
        <div className="rounded-xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark">
          {/* Toggle header */}
          <button
            type="button"
            onClick={() => {
              const newValue = !isRecurring;
              setValue('is_recurring', newValue);
              setShowRecurring(newValue);
            }}
            className="flex w-full items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-text-muted dark:text-text-muted-dark" />
              <span className="text-sm font-medium text-text dark:text-text-dark">
                Make this a recurring series
              </span>
            </div>
            {showRecurring ? (
              <ChevronUp className="h-4 w-4 text-text-muted dark:text-text-muted-dark" />
            ) : (
              <ChevronDown className="h-4 w-4 text-text-muted dark:text-text-muted-dark" />
            )}
          </button>

          {/* Recurring options */}
          {showRecurring && (
            <div className="space-y-4 border-t border-border px-4 pb-4 pt-3 dark:border-border-dark">
              {/* Frequency */}
              <div className="w-full">
                <label
                  htmlFor="frequency"
                  className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark"
                >
                  Frequency
                </label>
                <select
                  {...register('frequency')}
                  id="frequency"
                  className={cn(
                    'w-full rounded-xl border border-border bg-surface px-4 py-3 text-text transition-colors',
                    'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
                    'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark'
                  )}
                >
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Days of week (for weekly/biweekly) */}
              {(frequency === 'weekly' || frequency === 'biweekly') && (
                <div className="w-full">
                  <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
                    Days of the week
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        className={cn(
                          'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                          selectedDays?.includes(day.value)
                            ? 'bg-primary text-white'
                            : 'border border-border bg-surface text-text hover:bg-slate-50 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:hover:bg-slate-800'
                        )}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* End condition */}
              <div className="w-full">
                <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
                  End condition
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      {...register('endCondition')}
                      type="radio"
                      value="never"
                      className="accent-primary"
                    />
                    <span className="text-sm text-text dark:text-text-dark">
                      Never (generates up to 90 days ahead)
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      {...register('endCondition')}
                      type="radio"
                      value="count"
                      className="accent-primary"
                    />
                    <span className="text-sm text-text dark:text-text-dark">
                      After
                    </span>
                    {endCondition === 'count' && (
                      <Controller
                        name="occurrenceCount"
                        control={control}
                        render={({ field }) => (
                          <input
                            type="number"
                            min={1}
                            max={52}
                            value={field.value}
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value, 10) || 1)
                            }
                            className={cn(
                              'w-16 rounded-lg border border-border bg-surface px-2 py-1 text-center text-sm text-text',
                              'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark'
                            )}
                          />
                        )}
                      />
                    )}
                    <span className="text-sm text-text dark:text-text-dark">
                      occurrences
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      {...register('endCondition')}
                      type="radio"
                      value="until"
                      className="accent-primary"
                    />
                    <span className="text-sm text-text dark:text-text-dark">
                      Until
                    </span>
                    {endCondition === 'until' && (
                      <input
                        {...register('untilDate')}
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        className={cn(
                          'rounded-lg border border-border bg-surface px-2 py-1 text-sm text-text',
                          'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark'
                        )}
                      />
                    )}
                  </label>
                </div>
              </div>

              {/* Timezone display */}
              <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <p className="text-xs text-text-muted dark:text-text-muted-dark">
                  Timezone: <span className="font-medium">{detectedTimezone}</span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Server error */}
      {serverError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950">
          <p className="text-sm text-red-600 dark:text-red-400">{serverError}</p>
        </div>
      )}

      {/* Submit */}
      <Button type="submit" fullWidth loading={isSubmitting} size="lg">
        {mode === 'edit'
          ? 'Save Changes'
          : isRecurring
            ? 'Create Recurring Series'
            : 'Create Workshop'}
      </Button>
    </form>
  );
}
