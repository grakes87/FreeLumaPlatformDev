'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' },
];

interface ChurchData {
  id: number;
  name: string;
  pastorName: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
}

export default function SampleRequestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const churchId = searchParams.get('cid');

  const [loading, setLoading] = useState(false);
  const [loadingChurch, setLoadingChurch] = useState(!!churchId);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [church, setChurch] = useState<ChurchData | null>(null);

  const [form, setForm] = useState({
    churchName: '',
    pastorName: '',
    email: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
    howHeardAboutUs: '',
    honeypot: '',
  });

  // Load church data if cid is present
  useEffect(() => {
    if (!churchId) return;

    fetch(`/api/sample-request?cid=${churchId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const d = data?.data ?? data;
        if (d?.id) {
          setChurch(d);
          setForm((prev) => ({
            ...prev,
            churchName: d.name || '',
            pastorName: d.pastorName || '',
            email: d.email || '',
            phone: d.phone || '',
            addressLine1: d.addressLine1 || '',
            addressLine2: d.addressLine2 || '',
            city: d.city || '',
            state: d.state || '',
            zipCode: d.zipCode || '',
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingChurch(false));
  }, [churchId]);

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function validateForm(): boolean {
    const errors: Record<string, string> = {};
    if (!church) {
      if (form.churchName.trim().length < 2) errors.churchName = 'Church name is required';
      if (form.pastorName.trim().length < 2) errors.pastorName = 'Pastor/leader name is required';
      if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
        errors.email = 'Please enter a valid email address';
    }
    if (form.addressLine1.trim().length < 2) errors.addressLine1 = 'Street address is required';
    if (form.city.trim().length < 2) errors.city = 'City is required';
    if (!form.state) errors.state = 'Please select a state';
    if (form.zipCode.trim().length < 3) errors.zipCode = 'ZIP code is required';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!validateForm()) return;

    setLoading(true);
    try {
      const body = church
        ? {
            churchId: church.id,
            addressLine1: form.addressLine1,
            addressLine2: form.addressLine2,
            city: form.city,
            state: form.state,
            zipCode: form.zipCode,
            phone: form.phone,
            honeypot: form.honeypot,
          }
        : form;

      const res = await fetch('/api/sample-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        setError('Too many requests. Please try again later.');
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      router.push('/sample-request/thank-you');
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (loadingChurch) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-amber-600 via-amber-500 to-yellow-400 text-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24 text-center">
          <div className="mb-8">
            <Image
              src="/LumaLogo.png"
              alt="Free Luma Bracelets"
              width={120}
              height={120}
              className="mx-auto rounded-2xl shadow-lg"
              priority
            />
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold leading-tight mb-4">
            {church
              ? `Free Luma Bracelets for ${church.name}`
              : 'Bless Your Youth Group with Free Luma Bracelets'}
          </h1>
          <p className="text-lg sm:text-xl text-amber-100 max-w-2xl mx-auto leading-relaxed">
            NFC-enabled bracelets that connect your youth to daily Bible verses and inspirational
            content. A simple tap opens God&apos;s word — every single day.
          </p>
        </div>
      </section>

      {/* How It Works — only show for organic visitors */}
      {!church && (
        <section className="bg-white py-12 sm:py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 text-center mb-10">
              How It Works
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">1. Request Free Samples</h3>
                <p className="text-gray-600">
                  Fill out the form below and we&apos;ll ship bracelet samples directly to your
                  church — completely free.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">2. Share with Your Youth</h3>
                <p className="text-gray-600">
                  Each bracelet connects to daily scripture and content through the Free Luma app.
                  Just tap and read.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">3. Watch Faith Grow</h3>
                <p className="text-gray-600">
                  Youth engage with God&apos;s word every day through their bracelet — building a
                  lasting daily devotional habit.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Request Form */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 text-center mb-2">
            {church ? 'Where Should We Ship Your Samples?' : 'Request Your Free Samples'}
          </h2>
          <p className="text-gray-600 text-center mb-8">
            {church
              ? 'Confirm your shipping address and we\'ll get your free bracelets on the way.'
              : 'Tell us about your church and we\'ll send sample bracelets right to your door.'}
          </p>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Honeypot */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input
                type="text"
                id="website"
                name="website"
                value={form.honeypot}
                onChange={(e) => updateField('honeypot', e.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            {/* Church info — only for organic visitors, read-only for known churches */}
            {church ? (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                <p className="font-semibold text-gray-800">{church.name}</p>
                {church.pastorName && (
                  <p className="text-sm text-gray-600">Pastor: {church.pastorName}</p>
                )}
                {church.email && (
                  <p className="text-sm text-gray-600">{church.email}</p>
                )}
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="churchName" className="block text-sm font-medium text-gray-700 mb-1">
                    Church Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="churchName"
                    value={form.churchName}
                    onChange={(e) => updateField('churchName', e.target.value)}
                    className={`w-full rounded-lg border px-4 py-3 text-gray-800 outline-none transition focus:ring-2 focus:ring-amber-400 ${
                      fieldErrors.churchName ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
                    }`}
                    placeholder="e.g. Grace Community Church"
                  />
                  {fieldErrors.churchName && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.churchName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="pastorName" className="block text-sm font-medium text-gray-700 mb-1">
                    Pastor / Leader Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="pastorName"
                    value={form.pastorName}
                    onChange={(e) => updateField('pastorName', e.target.value)}
                    className={`w-full rounded-lg border px-4 py-3 text-gray-800 outline-none transition focus:ring-2 focus:ring-amber-400 ${
                      fieldErrors.pastorName ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
                    }`}
                    placeholder="e.g. Pastor John Smith"
                  />
                  {fieldErrors.pastorName && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.pastorName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={form.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    className={`w-full rounded-lg border px-4 py-3 text-gray-800 outline-none transition focus:ring-2 focus:ring-amber-400 ${
                      fieldErrors.email ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
                    }`}
                    placeholder="pastor@example.com"
                  />
                  {fieldErrors.email && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
                  )}
                </div>
              </>
            )}

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="tel"
                id="phone"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-800 outline-none transition focus:ring-2 focus:ring-amber-400"
                placeholder="(555) 123-4567"
              />
            </div>

            <div>
              <label htmlFor="addressLine1" className="block text-sm font-medium text-gray-700 mb-1">
                Street Address <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="addressLine1"
                value={form.addressLine1}
                onChange={(e) => updateField('addressLine1', e.target.value)}
                className={`w-full rounded-lg border px-4 py-3 text-gray-800 outline-none transition focus:ring-2 focus:ring-amber-400 ${
                  fieldErrors.addressLine1 ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
                }`}
                placeholder="123 Church Street"
              />
              {fieldErrors.addressLine1 && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.addressLine1}</p>
              )}
            </div>

            <div>
              <label htmlFor="addressLine2" className="block text-sm font-medium text-gray-700 mb-1">
                Address Line 2 <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                id="addressLine2"
                value={form.addressLine2}
                onChange={(e) => updateField('addressLine2', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-800 outline-none transition focus:ring-2 focus:ring-amber-400"
                placeholder="Suite 200, Building B, etc."
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="city"
                  value={form.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  className={`w-full rounded-lg border px-4 py-3 text-gray-800 outline-none transition focus:ring-2 focus:ring-amber-400 ${
                    fieldErrors.city ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
                  }`}
                  placeholder="Dallas"
                />
                {fieldErrors.city && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.city}</p>
                )}
              </div>
              <div>
                <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                  State <span className="text-red-500">*</span>
                </label>
                <select
                  id="state"
                  value={form.state}
                  onChange={(e) => updateField('state', e.target.value)}
                  className={`w-full rounded-lg border px-4 py-3 text-gray-800 outline-none transition focus:ring-2 focus:ring-amber-400 ${
                    fieldErrors.state ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
                  }`}
                >
                  <option value="">Select</option>
                  {US_STATES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.state && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.state}</p>
                )}
              </div>
              <div>
                <label htmlFor="zipCode" className="block text-sm font-medium text-gray-700 mb-1">
                  ZIP Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="zipCode"
                  value={form.zipCode}
                  onChange={(e) => updateField('zipCode', e.target.value)}
                  className={`w-full rounded-lg border px-4 py-3 text-gray-800 outline-none transition focus:ring-2 focus:ring-amber-400 ${
                    fieldErrors.zipCode ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
                  }`}
                  placeholder="75001"
                  maxLength={10}
                />
                {fieldErrors.zipCode && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.zipCode}</p>
                )}
              </div>
            </div>

            {/* How heard — only for organic visitors */}
            {!church && (
              <div>
                <label htmlFor="howHeardAboutUs" className="block text-sm font-medium text-gray-700 mb-1">
                  How did you hear about us?{' '}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  id="howHeardAboutUs"
                  value={form.howHeardAboutUs}
                  onChange={(e) => updateField('howHeardAboutUs', e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-800 outline-none transition focus:ring-2 focus:ring-amber-400 resize-none"
                  placeholder="A friend told me, saw it on social media, found it online..."
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-amber-600 px-6 py-4 text-lg font-semibold text-white shadow-md transition hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Submitting...
                </span>
              ) : (
                'Request Free Samples'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Your information is kept private and will only be used to process your sample request.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-amber-800 text-amber-200 py-8">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center text-sm">
          <p className="font-medium text-amber-100 mb-1">Free Luma Bracelets</p>
          <p>Connecting youth to daily scripture through NFC technology</p>
        </div>
      </footer>
    </div>
  );
}
