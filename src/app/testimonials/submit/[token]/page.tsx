'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { countWords, TESTIMONIAL_MAX_WORDS, validateTestimonialPhoto } from '@/models/testimonialSchema';

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
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    role: '' as 'Student' | 'Parent' | 'Guardian' | '',
    studentName: '',
    course: '',
    customCourse: '',
    year: String(CURRENT_YEAR),
    result: '',
    text: '',
    stars: 5,
    socialUrl: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const testimonialWordCount = countWords(form.text);

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
        setInvalidReason('Unable to validate this link. Please try again.');
        setStep('invalid');
      });
  }, [token]);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) errs.name = 'Please enter your full name.';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Please enter a valid email address.';
    }
    if (!form.role) errs.role = 'Please select your role.';
    if ((form.role === 'Parent' || form.role === 'Guardian') && form.studentName.trim() && form.studentName.trim().length < 2) {
      errs.studentName = 'Please enter the student name clearly.';
    }
    const course = form.course === 'Other' ? form.customCourse : form.course;
    if (!course.trim()) errs.course = 'Please specify the course or program.';
    if (!form.year) errs.year = 'Please select a year.';
    if (!form.text.trim() || form.text.trim().length < 20) {
      errs.text = 'Please write at least 20 characters.';
    } else if (testimonialWordCount > TESTIMONIAL_MAX_WORDS) {
      errs.text = `Please keep your testimonial within ${TESTIMONIAL_MAX_WORDS} words.`;
    }
    if (form.socialUrl.trim() && !/^https:\/\/.+/i.test(form.socialUrl.trim())) {
      errs.socialUrl = 'Please enter a full https:// social profile link.';
    }

    const photoValidation = validateTestimonialPhoto(photoFile);
    if (!photoValidation.isValid) {
      errs.photo = photoValidation.error || 'Invalid photo selected.';
    }

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

    const payload = new FormData();
    payload.append('name', form.name.trim());
    payload.append('email', form.email.trim());
    payload.append('role', form.role);
    payload.append('studentName', form.studentName.trim());
    payload.append('course', form.course === 'Other' ? form.customCourse.trim() : form.course);
    payload.append('year', form.year);
    payload.append('result', form.result.trim());
    payload.append('text', form.text.trim());
    payload.append('stars', String(form.stars));
    payload.append('socialUrl', form.socialUrl.trim());
    payload.append('token', token);

    if (photoFile) {
      payload.append('photo', photoFile);
    }

    try {
      const res = await fetch('/api/testimonials/submit', {
        method: 'POST',
        body: payload,
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

  function handlePhotoChange(file: File | null) {
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }

    setPhotoFile(file);
    setFieldErrors((prev) => ({ ...prev, photo: '' }));

    if (!file) {
      setPhotoPreviewUrl(null);
      return;
    }

    const validation = validateTestimonialPhoto(file);
    if (!validation.isValid) {
      setFieldErrors((prev) => ({ ...prev, photo: validation.error || 'Invalid photo selected.' }));
      setPhotoFile(null);
      setPhotoPreviewUrl(null);
      return;
    }

    setPhotoPreviewUrl(URL.createObjectURL(file));
  }

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
            Your testimonial has been submitted successfully.
          </p>
          <p className="text-gray-500 text-sm mb-8">
            Our team will review it and, once approved, it will appear on our website.
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

  return (
    <PageShell>
      <div className="max-w-2xl mx-auto px-4 py-12 force-light-surface">
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
            — your testimonial will be reviewed before going live.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white text-slate-900 rounded-2xl shadow-lg border border-gray-100 p-8 space-y-6">
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

          <Field label="Your Full Name" error={fieldErrors.name} required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Jane Smith"
              className={inputCls(fieldErrors.name)}
            />
          </Field>

          <Field label="Your Email Address" error={fieldErrors.email} required hint="Used only for contact and moderation — never published.">
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="you@example.com"
              className={inputCls(fieldErrors.email)}
            />
          </Field>

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

          {(form.role === 'Parent' || form.role === 'Guardian') && (
            <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-[#01143d]">Student Details</h3>
                <p className="text-xs text-slate-500 mt-1">
                  If you are writing on behalf of a student, you can include their name and any result details here.
                </p>
              </div>

              <Field
                label="Student Name (optional)"
                error={fieldErrors.studentName}
                hint="This helps us show who the testimonial refers to."
              >
                <input
                  type="text"
                  value={form.studentName}
                  onChange={(e) => set('studentName', e.target.value)}
                  placeholder="e.g. Aarav Smith"
                  className={inputCls(fieldErrors.studentName)}
                />
              </Field>
            </div>
          )}

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

          <Field
            label={form.role === 'Parent' || form.role === 'Guardian' ? 'Student Result (optional)' : 'Your Result (optional)'}
            hint={
              form.role === 'Parent' || form.role === 'Guardian'
                ? "e.g. 47 in Methods, 52 in Specialist · Selective entry accepted"
                : 'e.g. 47 in Methods, 52 in Specialist · Selective entry accepted'
            }
          >
            <input
              type="text"
              value={form.result}
              onChange={(e) => set('result', e.target.value)}
              placeholder="Share your achievement if you'd like"
              className={inputCls()}
            />
          </Field>

          <Field label="Social Media / Profile Link (optional)" error={fieldErrors.socialUrl} hint="Paste a public https:// Instagram, LinkedIn, Facebook, or other profile link.">
            <input
              type="url"
              value={form.socialUrl}
              onChange={(e) => set('socialUrl', e.target.value)}
              placeholder="https://www.linkedin.com/in/your-profile"
              className={inputCls(fieldErrors.socialUrl)}
            />
          </Field>

          <Field label="Profile Photo (optional)" error={fieldErrors.photo} hint="JPG, PNG, or WebP up to 5MB. Admin will decide if it is shown publicly.">
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-slate-700">
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={(e) => handlePhotoChange(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-[#0088e0] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[#0066b3]"
              />

              {photoPreviewUrl && (
                <div className="mt-4 flex items-start gap-4">
                  <img
                    src={photoPreviewUrl}
                    alt="Selected testimonial profile preview"
                    className="h-24 w-24 rounded-2xl object-cover border border-gray-200"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#01143d]">{photoFile?.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {photoFile ? `${(photoFile.size / 1024 / 1024).toFixed(2)} MB` : ''}
                    </p>
                    <button
                      type="button"
                      onClick={() => handlePhotoChange(null)}
                      className="mt-3 text-sm font-medium text-red-500 hover:text-red-600"
                    >
                      Remove photo
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Field>

          <Field
            label="Your Testimonial"
            error={fieldErrors.text}
            required
            hint={`${testimonialWordCount}/${TESTIMONIAL_MAX_WORDS} words`}
          >
            <textarea
              value={form.text}
              onChange={(e) => set('text', e.target.value)}
              rows={6}
              placeholder="Tell us about your experience with Dr. U Education — what made a difference for you?"
              className={`${inputCls(fieldErrors.text)} resize-none`}
            />
          </Field>

          <p className="text-xs text-gray-400 leading-relaxed">
            By submitting, you agree that your name, role, course details, testimonial, and any approved public fields
            may be published on the Dr. U Education website. Your email address will never be published.
            After submitting, our team will review your testimonial before it is published.
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

function inputCls(error?: string) {
  return `force-light-input w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0088e0] transition-colors ${
    error ? 'border-red-400 bg-red-50 text-slate-900 placeholder:text-red-300' : 'border-gray-200 bg-white hover:border-gray-300'
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
    <div className="min-h-screen bg-gray-50 text-slate-900">
      <div className="bg-gradient-to-r from-[#01143d] to-[#0088e0]">
        <Navbar />
      </div>
      {children}
    </div>
  );
}
