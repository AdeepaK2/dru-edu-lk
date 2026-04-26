'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle,
  Clock,
  Mail,
  MapPin,
  Send,
} from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, TextArea } from '@/components/ui';
import { CAREER_POSITIONS, CareerApplicationData } from '@/models/careerSchema';

type CareerDocumentType = 'resume' | 'cover-letter';

const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = '.pdf,.doc,.docx';

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

const initialFormData: CareerApplicationData = {
  positionId: CAREER_POSITIONS[0].id,
  positionTitle: CAREER_POSITIONS[0].title,
  fullName: '',
  email: '',
  phone: '',
  location: '',
  experience: '',
  availability: '',
  resumeUrl: '',
  coverLetterUrl: '',
};

export default function CareerPage() {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [formData, setFormData] = useState<CareerApplicationData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [coverLetterFile, setCoverLetterFile] = useState<File | null>(null);
  const [captchaToken, setCaptchaToken] = useState('');
  const [turnstileLoaded, setTurnstileLoaded] = useState(false);
  const [turnstileWidgetId, setTurnstileWidgetId] = useState<string | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);

  const selectedPosition = useMemo(
    () => CAREER_POSITIONS.find((position) => position.id === formData.positionId) || CAREER_POSITIONS[0],
    [formData.positionId]
  );

  useEffect(() => {
    if (!turnstileSiteKey || !turnstileLoaded || !turnstileContainerRef.current || !window.turnstile || turnstileWidgetId) {
      return;
    }

    const widgetId = window.turnstile.render(turnstileContainerRef.current, {
      sitekey: turnstileSiteKey,
      callback: (token: string) => setCaptchaToken(token),
      'expired-callback': () => setCaptchaToken(''),
      'error-callback': () => setCaptchaToken(''),
    });

    setTurnstileWidgetId(widgetId);
  }, [turnstileLoaded, turnstileSiteKey, turnstileWidgetId]);

  const updateField = (field: keyof CareerApplicationData, value: string) => {
    if (field === 'positionId') {
      const position = CAREER_POSITIONS.find((item) => item.id === value) || CAREER_POSITIONS[0];
      setFormData((current) => ({
        ...current,
        positionId: position.id,
        positionTitle: position.title,
      }));
      return;
    }

    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const validateDocument = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    if (!['pdf', 'doc', 'docx'].includes(extension)) {
      return 'Only PDF, DOC, or DOCX files are allowed.';
    }

    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      return 'File is too large. Maximum allowed size is 5MB.';
    }

    return null;
  };

  const handleDocumentChange = (file: File | null, type: CareerDocumentType) => {
    if (!file) {
      if (type === 'resume') {
        setResumeFile(null);
      } else {
        setCoverLetterFile(null);
      }
      return;
    }

    const validationError = validateDocument(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    if (type === 'resume') {
      setResumeFile(file);
      return;
    }

    setCoverLetterFile(file);
  };

  const uploadCareerDocumentViaSignedUrl = async (file: File, type: CareerDocumentType): Promise<string> => {
    const signedUrlResponse = await fetch('/api/careers/upload-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documentType: type,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
      }),
    });

    const signedUrlData = await signedUrlResponse.json().catch(() => null);
    if (!signedUrlResponse.ok || !signedUrlData?.uploadUrl || !signedUrlData?.headers || !signedUrlData?.publicUrl) {
      throw new Error(signedUrlData?.error || 'Failed to initialize direct upload');
    }

    const uploadResponse = await fetch(signedUrlData.uploadUrl, {
      method: 'PUT',
      headers: signedUrlData.headers,
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error('Direct upload failed');
    }

    return signedUrlData.publicUrl;
  };

  const uploadCareerDocumentViaProxy = async (file: File, type: CareerDocumentType): Promise<string> => {
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);
    uploadFormData.append('documentType', type);

    const response = await fetch('/api/careers/upload', {
      method: 'POST',
      body: uploadFormData,
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || 'Failed to upload document');
    }

    return data.url;
  };

  const uploadCareerDocument = async (file: File, type: CareerDocumentType): Promise<string> => {
    try {
      return await uploadCareerDocumentViaSignedUrl(file, type);
    } catch (directUploadError) {
      console.warn('Direct upload failed, falling back to proxy upload:', directUploadError);
      return uploadCareerDocumentViaProxy(file, type);
    }
  };

  const resetTurnstile = () => {
    if (!turnstileWidgetId || !window.turnstile) {
      setCaptchaToken('');
      return;
    }

    window.turnstile.reset(turnstileWidgetId);
    setCaptchaToken('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (!resumeFile) {
        throw new Error('Please upload your CV before submitting.');
      }

      if (turnstileSiteKey && !captchaToken) {
        throw new Error('Please complete the security verification.');
      }

      setUploadingDocuments(true);

      const submissionPayload: CareerApplicationData = {
        ...formData,
        resumeUrl: await uploadCareerDocument(resumeFile, 'resume'),
      };

      if (coverLetterFile) {
        submissionPayload.coverLetterUrl = await uploadCareerDocument(coverLetterFile, 'cover-letter');
      }

      const response = await fetch('/api/careers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...submissionPayload,
          captchaToken,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Failed to submit application');
      }

      setSuccess(true);
      setFormData(initialFormData);
      setResumeFile(null);
      setCoverLetterFile(null);
      resetTurnstile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application');
    } finally {
      setUploadingDocuments(false);
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-[#01143d] to-[#0088e0] text-white py-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <Link href="/" className="inline-flex items-center text-blue-100 hover:text-white mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
            <h1 className="text-3xl font-bold">Careers at Dr U Education</h1>
          </div>
        </div>

        <div className="max-w-xl mx-auto px-4 py-16">
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Application submitted</h2>
              <p className="text-gray-600 mb-6">
                Thanks for applying. Our team will review your application and contact you if your profile matches the role.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => setSuccess(false)} variant="outline">
                  Submit another application
                </Button>
                <Link href="/">
                  <Button>Return to Home</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-[#01143d] to-[#0088e0] text-white py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center text-blue-100 hover:text-white mb-5">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
          <div className="max-w-3xl">
            <p className="text-blue-100 font-medium mb-3">Join our teaching and operations team</p>
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">Careers at Dr U Education</h1>
            <p className="text-lg text-blue-100">
              Apply for available roles and help students build confidence, discipline, and strong academic results.
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <section className="grid lg:grid-cols-[1fr_1.15fr] gap-8 items-start">
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Available Positions</h2>
              <p className="text-gray-600">
                Choose the role that best matches your experience and upload your CV with an optional cover letter.
              </p>
            </div>

            {CAREER_POSITIONS.map((position) => (
              <Card
                key={position.id}
                className={`transition-colors ${
                  selectedPosition.id === position.id ? 'border-[#0088e0] bg-blue-50' : ''
                }`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{position.title}</h3>
                      <p className="text-sm text-gray-600 mt-2">{position.summary}</p>
                      <div className="flex flex-wrap gap-3 mt-4 text-sm text-gray-600">
                        <span className="inline-flex items-center">
                          <Clock className="w-4 h-4 mr-1.5 text-[#0088e0]" />
                          {position.type}
                        </span>
                        <span className="inline-flex items-center">
                          <MapPin className="w-4 h-4 mr-1.5 text-[#0088e0]" />
                          {position.location}
                        </span>
                      </div>
                    </div>
                    <BriefcaseBusiness className="w-6 h-6 text-[#0088e0] flex-shrink-0" />
                  </div>
                  <Button
                    type="button"
                    variant={selectedPosition.id === position.id ? 'primary' : 'outline'}
                    size="sm"
                    className="mt-4"
                    onClick={() => updateField('positionId', position.id)}
                  >
                    {selectedPosition.id === position.id ? 'Selected' : 'Apply for this role'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-[#01143d]">Apply Now</CardTitle>
              <p className="text-gray-600">
                Selected role: <span className="font-semibold">{selectedPosition.title}</span>
              </p>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Position <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.positionId}
                    onChange={(event) => updateField('positionId', event.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  >
                    {CAREER_POSITIONS.map((position) => (
                      <option key={position.id} value={position.id}>
                        {position.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <Input
                    label="Full Name"
                    value={formData.fullName}
                    onChange={(event) => updateField('fullName', event.target.value)}
                    required
                  />
                  <Input
                    label="Email"
                    type="email"
                    leftIcon={<Mail className="w-4 h-4" />}
                    value={formData.email}
                    onChange={(event) => updateField('email', event.target.value)}
                    required
                  />
                  <Input
                    label="Phone"
                    value={formData.phone}
                    onChange={(event) => updateField('phone', event.target.value)}
                    required
                  />
                  <Input
                    label="Suburb / Location"
                    value={formData.location}
                    onChange={(event) => updateField('location', event.target.value)}
                    required
                  />
                </div>

                <TextArea
                  label="Experience"
                  value={formData.experience}
                  onChange={(event) => updateField('experience', event.target.value)}
                  placeholder="Tell us about your teaching, admin, or education experience."
                  rows={5}
                  required
                />

                <TextArea
                  label="Availability"
                  value={formData.availability}
                  onChange={(event) => updateField('availability', event.target.value)}
                  placeholder="For example: weekdays after 4pm, weekends, online only."
                  rows={3}
                  required
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CV / Resume <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    accept={ALLOWED_DOCUMENT_TYPES}
                    onChange={(event) => handleDocumentChange(event.target.files?.[0] || null, 'resume')}
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 file:mr-4 file:rounded-md file:border-0 file:bg-[#01143d] file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#0a245f] focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                  <p className="mt-1 text-sm text-gray-500">Accepted formats: PDF, DOC, DOCX (max 5MB).</p>
                  {resumeFile && <p className="mt-1 text-sm text-gray-600">Selected: {resumeFile.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cover Letter
                  </label>
                  <input
                    type="file"
                    accept={ALLOWED_DOCUMENT_TYPES}
                    onChange={(event) => handleDocumentChange(event.target.files?.[0] || null, 'cover-letter')}
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 file:mr-4 file:rounded-md file:border-0 file:bg-[#0088e0] file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#0077c2] focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">Optional upload. Accepted formats: PDF, DOC, DOCX (max 5MB).</p>
                  {coverLetterFile && <p className="mt-1 text-sm text-gray-600">Selected: {coverLetterFile.name}</p>}
                </div>

                {turnstileSiteKey && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Security Verification</label>
                    <Script
                      src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
                      strategy="afterInteractive"
                      onLoad={() => setTurnstileLoaded(true)}
                    />
                    <div ref={turnstileContainerRef} className="min-h-[65px]" />
                    <p className="mt-1 text-sm text-gray-500">Please complete the verification before submitting.</p>
                  </div>
                )}

                <Button
                  type="submit"
                  isLoading={submitting || uploadingDocuments}
                  leftIcon={<Send className="w-4 h-4" />}
                  className="w-full"
                  size="lg"
                >
                  Submit Application
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
