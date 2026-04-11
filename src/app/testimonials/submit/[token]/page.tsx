'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

type Step = 'validating' | 'invalid' | 'form' | 'submitting' | 'success' | 'error';

const COURSES = [
  'VCE Mathematics Methods',
  'VCE Specialist Mathematics',
  'VCE Mathematics Methods & Specialist',
  'VCE Chemistry',
  'VCE Physics',
  'VCE Methods, Specialist & Chemistry',
  'Selective High School Coaching',
  'Selective Entry Preparation',
  'Year 9/10 Mathematics',
  'Other',
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 8 }, (_, i) => String(CURRENT_YEAR - i));

export default function SubmitTestimonialPage() {
  const { token } = useParams<{ token: string }>();
  const [step, setStep] = useState<Step>('validating');
  const [invalidReason, setInvalidReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [form, setForm] = useState({
    name: '',
    email: '',
    role: '' as 'Student' | 'Parent' | 'Guardian' | '',
    course: '',
    customCourse: '',
    year: String(CURRENT_YEAR),
    result: '',
    text: '',
    stars: 5,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Validate token on mount
  useEffect(() => {
    if (!token) return;
    fetch(`/api/testimonials/token/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) {
          setStep('form');
        } else {
          setInvalidReason(data.reason || 'This link is not valid.');
          setStep('invalid');
        }
      })
      .catch(() => {
        setInvalidReason('Unable to verify this link. Please try again.');
        setStep('invalid');
      });
  }, [token]);

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) errs.name = 'Please enter your full name.';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = 'Please enter a valid email address.';
    if (!form.role) errs.role = 'Please select your role.';
    const course = form.course === 'Other' ? form.customCourse : form.course;
    if (!course.trim()) errs.course = 'Please specify the course or program.';
    if (!form.year) errs.year = 'Please select a year.';
    if (!form.text.trim() || form.text.trim().length < 20)
      errs.text = 'Please write at least 20 characters.';
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setStep('submitting');

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
      course: form.course === 'Other' ? form.customCourse.trim() : form.course,
      year: form.year,
      result: form.result.trim() || undefined,
      text: form.text.trim(),
      stars: form.stars,
      token,
    };

    try {
      const res = await fetch('/api/testimonials/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setStep('success');
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Something went wrong. Please try again.');
        setStep('error');
      }
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.');
      setStep('error');
    }
  }

  function set(field: string, value: string | number) {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((e) => ({ ...e, [field]: '' }));
  }

  // ── renders ──────────────────────────────────────────────────────────────────

  if (step === 'validating') {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-4 py-24">
          <div className="animate-spin w-12 h-12 border-4 border-[#0088e0] border-t-transparent rounded-full" />
          <p className="text-gray-500">Verifying your invite link…</p>
        </div>
      </PageShell>
    );
  }

  if (step === 'invalid') {
    return (
      <PageShell>
        <div className="max-w-md mx-auto text-center py-24 px-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-[#01143d] mb-3">Link Not Valid</h2>
          <p className="text-gray-500 mb-8">{invalidReason}</p>
          <Link href="/" className="bg-[#0088e0] text-white px-6 py-3 rounded-full font-semibold hover:bg-[#0066b3] transition-colors">
            Go to Homepage
          </Link>
        </div>
      </PageShell>
    );
  }

  if (step === 'success') {
    return (
      <PageShell>
        <div className="max-w-md mx-auto text-center py-24 px-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-[#01143d] mb-3">Thank You!</h2>
          <p className="text-gray-600 mb-3">
            Your testimonial has been submitted. We've sent a verification email to <strong>{form.email}</strong>.
          </p>
          <p className="text-gray-500 text-sm mb-8">
            Please click the link in that email to verify your testimonial. Once verified and approved by our team, it will appear on our website.
          </p>
          <Link href="/testimonials" className="bg-[#0088e0] text-white px-6 py-3 rounded-full font-semibold hover:bg-[#0066b3] transition-colors">
            View Testimonials
          </Link>
        </div>
      </PageShell>
    );
  }

  if (step === 'error') {
    return (
      <PageShell>
        <div className="max-w-md mx-auto text-center py-24 px-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-[#01143d] mb-3">Submission Failed</h2>
          <p className="text-gray-500 mb-8">{errorMsg}</p>
          <button
            onClick={() => setStep('form')}
            className="bg-[#0088e0] text-white px-6 py-3 rounded-full font-semibold hover:bg-[#0066b3] transition-colors"
          >
            Try Again
          </button>
        </div>
      </PageShell>
    );
  }

  // ── form ──────────────────────────────────────────────────────────────────

  return (
    <PageShell>
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-200 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Personal Invite from Dr. U Education
          </div>
          <h1 className="text-3xl font-extrabold text-[#01143d] mb-3">Share Your Experience</h1>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Your honest words help future students find the right support. This link is unique to you
            — your testimonial will be verified and reviewed before going live.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 space-y-6">

          {/* Star rating – at the top so it sets the emotional tone */}
          <div>
            <label className="block text-sm font-semibold text-[#01143d] mb-2">
              Overall Rating <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => set('stars', n)}
                  className="focus:outline-none"
                >
                  <svg
                    className={`w-9 h-9 transition-colors ${n <= form.stars ? 'text-yellow-400' : 'text-gray-200 hover:text-yellow-200'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <Field label="Your Full Name" error={fieldErrors.name} required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Jane Smith"
              className={inputCls(fieldErrors.name)}
            />
          </Field>

          {/* Email */}
          <Field label="Your Email Address" error={fieldErrors.email} required hint="Used only to verify your testimonial — never published.">
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="you@example.com"
              className={inputCls(fieldErrors.email)}
            />
          </Field>

          {/* Role */}
          <Field label="Your Role" error={fieldErrors.role} required>
            <div className="flex gap-3 flex-wrap">
              {(['Student', 'Parent', 'Guardian'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => set('role', r)}
                  className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                    form.role === r
                      ? 'bg-[#0088e0] text-white border-[#0088e0]'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-[#0088e0] hover:text-[#0088e0]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            {fieldErrors.role && <p className="text-red-500 text-xs mt-1">{fieldErrors.role}</p>}
          </Field>

          {/* Course */}
          <Field label="Course / Program" error={fieldErrors.course} required>
            <select
              value={form.course}
              onChange={(e) => set('course', e.target.value)}
              className={inputCls(fieldErrors.course)}
            >
              <option value="">Select a course…</option>
              {COURSES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {form.course === 'Other' && (
              <input
                type="text"
                value={form.customCourse}
                onChange={(e) => set('customCourse', e.target.value)}
                placeholder="Please specify…"
                className={`${inputCls(fieldErrors.course)} mt-2`}
              />
            )}
          </Field>

          {/* Year */}
          <Field label="Year of Study / Completion" error={fieldErrors.year} required>
            <select
              value={form.year}
              onChange={(e) => set('year', e.target.value)}
              className={inputCls(fieldErrors.year)}
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </Field>

          {/* Result (optional) */}
          <Field label="Your Result (optional)" hint="e.g. 47 in Methods, 52 in Specialist · Selective entry accepted">
            <input
              type="text"
              value={form.result}
              onChange={(e) => set('result', e.target.value)}
              placeholder="Share your achievement if you'd like"
              className={inputCls()}
            />
          </Field>

          {/* Testimonial text */}
          <Field label="Your Testimonial" error={fieldErrors.text} required hint={`${form.text.length}/1500 characters`}>
            <textarea
              value={form.text}
              onChange={(e) => set('text', e.target.value)}
              rows={6}
              maxLength={1500}
              placeholder="Tell us about your experience with Dr. U Education — what made a difference for you?"
              className={`${inputCls(fieldErrors.text)} resize-none`}
            />
          </Field>

          {/* Privacy note */}
          <p className="text-xs text-gray-400 leading-relaxed">
            By submitting, you agree that your name, role, course details, and testimonial may be published
            on the Dr. U Education website. Your email address will never be published.
            After submitting you will receive a verification email — please click the link to confirm your testimonial.
          </p>

          <button
            type="submit"
            disabled={step === 'submitting'}
            className="w-full bg-[#0088e0] hover:bg-[#0066b3] disabled:bg-blue-300 text-white py-3.5 rounded-xl font-semibold text-base transition-all duration-200 flex items-center justify-center gap-2"
          >
            {step === 'submitting' ? (
              <>
                <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                Submitting…
              </>
            ) : (
              'Submit My Testimonial'
            )}
          </button>
        </form>
      </div>
    </PageShell>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

function inputCls(error?: string) {
  return `w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0088e0] transition-colors ${
    error ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'
  }`;
}

function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-[#01143d] mb-1.5">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-[#01143d] to-[#0088e0]">
        <Navbar />
      </div>
      {children}
    </div>
  );
}
