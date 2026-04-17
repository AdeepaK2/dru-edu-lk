'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { auth, firestore, storage } from '@/utils/firebase-client';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { Star, CheckCircle, XCircle, Link2, Trash2, Plus, Copy, Check, Shield, Award, Image as ImageIcon, Globe } from 'lucide-react';

interface Testimonial {
  id: string;
  tokenId?: string | null;
  name: string;
  email: string;
  role: string;
  course: string;
  year: string;
  result?: string | null;
  text: string;
  stars: number;
  photoUrl?: string | null;
  photoStoragePath?: string | null;
  socialUrl?: string | null;
  displayPhoto: boolean;
  displaySocialLink: boolean;
  status: 'pending' | 'approved' | 'rejected';
  featured: boolean;
  emailVerified: boolean;
  adminNotes?: string;
  submittedAt: string;
  verifiedAt?: string | null;
  approvedAt?: string | null;
}

interface Token {
  id: string;
  token: string;
  label: string;
  recipientEmail?: string | null;
  used: boolean;
  usedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
}

type Tab = 'testimonials' | 'links';
type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StarRow({ n }: { n: number }) {
  return (
    <span className="flex gap-0.5">
      {[...Array(5)].map((_, i) => (
        <Star key={i} size={14} className={i < n ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'} />
      ))}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    approved: 'bg-green-50 text-green-700 border-green-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${map[status] ?? ''}`}>
      {status}
    </span>
  );
}

async function getAdminUser() {
  const user = auth.currentUser ?? await new Promise<User | null>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      unsubscribe();
      resolve(nextUser);
    });
  });

  if (!user) {
    throw new Error('Admin session not found');
  }

  const tokenResult = await user.getIdTokenResult();
  if (!tokenResult.claims.admin) {
    throw new Error('Admin privileges are required');
  }

  return user;
}

function toIsoString(value: any): string | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

export default function AdminTestimonialsPage() {
  const [tab, setTab] = useState<Tab>('testimonials');
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [tLoading, setTLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [tokLoading, setTokLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generatedEmail, setGeneratedEmail] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const fetchTestimonials = useCallback(async () => {
    setTLoading(true);
    setPageError(null);
    try {
      await getAdminUser();
      const snapshot = await getDocs(query(collection(firestore, 'testimonials'), orderBy('submittedAt', 'desc')));
      const data = snapshot.docs.map((snapshotDoc) => {
        const d = snapshotDoc.data();
        return {
          id: snapshotDoc.id,
          name: d.name,
          email: d.email,
          role: d.role,
          course: d.course,
          year: d.year,
          result: d.result ?? null,
          text: d.text,
          stars: d.stars,
          tokenId: d.tokenId,
          photoUrl: d.photoUrl ?? null,
          photoStoragePath: d.photoStoragePath ?? null,
          socialUrl: d.socialUrl ?? null,
          displayPhoto: Boolean(d.displayPhoto),
          displaySocialLink: Boolean(d.displaySocialLink),
          status: d.status,
          featured: Boolean(d.featured),
          emailVerified: Boolean(d.emailVerified),
          adminNotes: d.adminNotes,
          submittedAt: toIsoString(d.submittedAt) || new Date().toISOString(),
          verifiedAt: toIsoString(d.verifiedAt),
          approvedAt: toIsoString(d.approvedAt),
        } satisfies Testimonial;
      });

      setTestimonials(data);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Failed to load testimonials');
    } finally {
      setTLoading(false);
    }
  }, []);

  const fetchTokens = useCallback(async () => {
    setTokLoading(true);
    setPageError(null);
    try {
      await getAdminUser();
      const snapshot = await getDocs(query(collection(firestore, 'testimonialTokens'), orderBy('createdAt', 'desc')));
      const data = snapshot.docs.map((snapshotDoc) => {
        const d = snapshotDoc.data();
        return {
          id: snapshotDoc.id,
          token: d.token,
          label: d.label,
          recipientEmail: d.recipientEmail ?? null,
          used: Boolean(d.used),
          usedAt: toIsoString(d.usedAt),
          expiresAt: toIsoString(d.expiresAt),
          createdAt: toIsoString(d.createdAt) || new Date().toISOString(),
        } satisfies Token;
      });
      setTokens(data);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Failed to load invite links');
    } finally {
      setTokLoading(false);
    }
  }, []);

  useEffect(() => { fetchTestimonials(); }, [fetchTestimonials]);
  useEffect(() => { if (tab === 'links') fetchTokens(); }, [tab, fetchTokens]);

  async function patchTestimonial(id: string, payload: Record<string, unknown>) {
    await getAdminUser();

    const testimonial = testimonials.find((item) => item.id === id);
    if (!testimonial) {
      throw new Error('Testimonial not found');
    }

    if (payload.status === 'approved' && !testimonial.emailVerified) {
      throw new Error('Only email-verified testimonials can be approved');
    }

    const updatePayload: Record<string, unknown> = {
      ...payload,
      updatedAt: Timestamp.now(),
    };

    if (payload.status === 'approved') {
      updatePayload.approvedAt = Timestamp.now();
    } else if (payload.status) {
      updatePayload.approvedAt = null;
    }

    await updateDoc(doc(firestore, 'testimonials', id), updatePayload);
  }

  async function updateStatus(testimonial: Testimonial, status: 'approved' | 'rejected') {
    setActionLoading(true);
    setPageError(null);
    try {
      await patchTestimonial(testimonial.id, { status });
      await fetchTestimonials();
      if (status !== 'approved') {
        setSelectedId(null);
      }
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Failed to update testimonial');
    } finally {
      setActionLoading(false);
    }
  }

  async function toggleFeatured(t: Testimonial) {
    setActionLoading(true);
    setPageError(null);
    try {
      await patchTestimonial(t.id, { featured: !t.featured });
      setTestimonials((prev) => prev.map((x) => (x.id === t.id ? { ...x, featured: !x.featured } : x)));
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Failed to update featured state');
    } finally {
      setActionLoading(false);
    }
  }

  async function toggleDisplaySetting(t: Testimonial, key: 'displayPhoto' | 'displaySocialLink') {
    setActionLoading(true);
    setPageError(null);
    try {
      const nextValue = !t[key];
      await patchTestimonial(t.id, { [key]: nextValue });
      setTestimonials((prev) => prev.map((x) => (x.id === t.id ? { ...x, [key]: nextValue } : x)));
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Failed to update visibility setting');
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteTestimonial(id: string) {
    if (!confirm('Delete this testimonial permanently?')) return;

    setActionLoading(true);
    setPageError(null);
    try {
      await getAdminUser();
      const testimonial = testimonials.find((item) => item.id === id);

      if (!testimonial) {
        throw new Error('Testimonial not found');
      }

      if (testimonial.photoStoragePath) {
        await deleteObject(ref(storage, testimonial.photoStoragePath));
      }

      await deleteDoc(doc(firestore, 'testimonials', id));

      setTestimonials((prev) => prev.filter((t) => t.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Failed to delete testimonial');
    } finally {
      setActionLoading(false);
    }
  }

  async function createToken() {
    if (!newLabel.trim()) return;

    setCreating(true);
    setPageError(null);
    setGeneratedLink(null);
    setGeneratedEmail(null);
    try {
      const user = await getAdminUser();
      const token = crypto.randomUUID().replace(/-/g, '');
      const inviteLink = `${window.location.origin}/testimonials/submit/${token}`;
      const normalizedRecipientEmail = recipientEmail.trim().toLowerCase();
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      if (normalizedRecipientEmail && !EMAIL_PATTERN.test(normalizedRecipientEmail)) {
        throw new Error('Enter a valid email address to send the invite');
      }

      await addDoc(collection(firestore, 'testimonialTokens'), {
        token,
        label: newLabel.trim(),
        recipientEmail: normalizedRecipientEmail || null,
        used: false,
        createdAt: Timestamp.now(),
        createdBy: user.email || 'admin',
        expiresAt: Timestamp.fromDate(expiresAt),
      });

      let inviteEmailQueued = false;
      if (normalizedRecipientEmail) {
        try {
          await addDoc(collection(firestore, 'mail'), {
            to: normalizedRecipientEmail,
            message: {
              subject: 'Your Dr. U Education testimonial invite',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                  <div style="text-align: center; margin-bottom: 24px;">
                    <h1 style="color: #01143d; font-size: 24px; margin: 0;">Dr. U Education</h1>
                    <p style="color: #6b7280; margin: 4px 0 0;">We would love your testimonial</p>
                  </div>

                  <p style="color: #374151;">Hello,</p>

                  <p style="color: #374151;">
                    Thank you for being part of Dr. U Education. Please use the secure one-time link below to share your testimonial, rating, and optional photo.
                  </p>

                  <div style="text-align: center; margin: 32px 0;">
                    <a href="${inviteLink}"
                      style="background-color: #0088e0; color: white; padding: 14px 32px; border-radius: 9999px;
                            text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
                      Submit Your Testimonial
                    </a>
                  </div>

                  <p style="color: #6b7280; font-size: 14px;">
                    This invite link will expire on ${expiresAt.toLocaleDateString('en-AU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}.
                  </p>

                  <p style="color: #6b7280; font-size: 14px;">
                    If the button does not work, copy and paste this link into your browser:
                    <br />
                    <a href="${inviteLink}" style="color: #0088e0; word-break: break-all;">${inviteLink}</a>
                  </p>
                </div>
              `,
            },
          });
          inviteEmailQueued = true;
        } catch (emailError) {
          console.error('Failed to queue testimonial invite email:', emailError);
          setPageError('Invite link created, but the email could not be queued. You can still copy the link below.');
        }
      }

      setGeneratedLink(inviteLink);
      setGeneratedEmail(inviteEmailQueued ? normalizedRecipientEmail : null);
      setNewLabel('');
      setRecipientEmail('');
      await fetchTokens();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Failed to create invite link');
    } finally {
      setCreating(false);
    }
  }

  async function deleteToken(id: string) {
    if (!confirm('Revoke this link? It cannot be used after this.')) return;

    setPageError(null);
    try {
      await getAdminUser();
      await deleteDoc(doc(firestore, 'testimonialTokens', id));
      setTokens((prev) => prev.filter((t) => t.id !== id));
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Failed to revoke invite link');
    }
  }

  function copyLink(token: string, id: string) {
    const base = window.location.origin;
    navigator.clipboard.writeText(`${base}/testimonials/submit/${token}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const filtered = statusFilter === 'all'
    ? testimonials
    : testimonials.filter((t) => t.status === statusFilter);

  const selected = testimonials.find((t) => t.id === selectedId) ?? null;

  const counts = {
    pending: testimonials.filter((t) => t.status === 'pending').length,
    approved: testimonials.filter((t) => t.status === 'approved').length,
    rejected: testimonials.filter((t) => t.status === 'rejected').length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Testimonials</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage submitted testimonials, review public profile data, and generate invite links.
        </p>
      </div>

      {pageError && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pageError}
        </div>
      )}

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-6">
        {(['testimonials', 'links'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all capitalize ${
              tab === t ? 'bg-white shadow text-[#01143d]' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'testimonials' ? 'Testimonials' : 'Invite Links'}
            {t === 'testimonials' && counts.pending > 0 && (
              <span className="ml-2 bg-yellow-100 text-yellow-700 text-xs px-1.5 py-0.5 rounded-full">
                {counts.pending}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'testimonials' && (
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-3 gap-4 mb-4">
              {([
                { label: 'Pending', count: counts.pending, colorClasses: 'ring-yellow-400 text-yellow-600', filter: 'pending' },
                { label: 'Approved', count: counts.approved, colorClasses: 'ring-green-400 text-green-600', filter: 'approved' },
                { label: 'Rejected', count: counts.rejected, colorClasses: 'ring-red-400 text-red-600', filter: 'rejected' },
              ] as const).map((s) => (
                <button
                  key={s.filter}
                  onClick={() => setStatusFilter(s.filter)}
                  className={`rounded-xl border p-4 text-left transition-all bg-white ${
                    statusFilter === s.filter ? `ring-2 ${s.colorClasses.split(' ')[0]}` : 'hover:shadow-md'
                  }`}
                >
                  <div className={`text-2xl font-bold ${s.colorClasses.split(' ')[1]}`}>{s.count}</div>
                  <div className="text-gray-500 text-sm">{s.label}</div>
                </button>
              ))}
            </div>

            <div className="flex gap-2 mb-4">
              {(['all', 'pending', 'approved', 'rejected'] as StatusFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize border ${
                    statusFilter === f
                      ? 'bg-[#01143d] text-white border-[#01143d]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {tLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-[#0088e0] border-t-transparent rounded-full" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
                No testimonials in this filter.
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedId(t.id === selectedId ? null : t.id)}
                    className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${
                      selectedId === t.id ? 'border-[#0088e0] ring-1 ring-[#0088e0]' : 'border-gray-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {t.photoUrl ? (
                          <img
                            src={t.photoUrl}
                            alt={`${t.name} testimonial`}
                            className="h-12 w-12 rounded-full object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400">
                            <ImageIcon size={18} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-[#01143d] text-sm">{t.name}</span>
                            <StatusBadge status={t.status} />
                            {t.emailVerified && (
                              <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 border border-blue-200 text-xs px-1.5 py-0.5 rounded-full">
                                <Shield size={10} /> Verified
                              </span>
                            )}
                            {t.featured && (
                              <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-600 border border-purple-200 text-xs px-1.5 py-0.5 rounded-full">
                                <Award size={10} /> Featured
                              </span>
                            )}
                            {t.socialUrl && (
                              <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 border border-sky-200 text-xs px-1.5 py-0.5 rounded-full">
                                <Globe size={10} /> Social
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{t.role} · {t.course} · {t.year}</p>
                          <p className="text-sm text-gray-600 mt-1.5 line-clamp-2">{t.text}</p>
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <StarRow n={t.stars} />
                        <p className="text-xs text-gray-400 mt-1">{formatDate(t.submittedAt)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selected && (
            <div className="w-96 flex-shrink-0">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sticky top-20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-[#01143d]">Review</h3>
                  <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600">
                    <XCircle size={18} />
                  </button>
                </div>

                <div className="space-y-3 text-sm">
                  <Row label="Name" value={selected.name} />
                  <Row label="Email" value={selected.email} />
                  <Row label="Role" value={selected.role} />
                  <Row label="Course" value={`${selected.course} · ${selected.year}`} />
                  {selected.result && <Row label="Result" value={selected.result} />}
                  <div>
                    <span className="text-gray-400 text-xs">Rating</span>
                    <div className="mt-0.5"><StarRow n={selected.stars} /></div>
                  </div>
                  <Row label="Email Verified" value={selected.emailVerified ? `Yes · ${formatDate(selected.verifiedAt)}` : 'No — pending'} />
                  <Row label="Submitted" value={formatDate(selected.submittedAt)} />
                </div>

                {(selected.photoUrl || selected.socialUrl) && (
                  <>
                    <div className="border-t border-gray-100 my-4" />
                    <div className="space-y-4">
                      {selected.photoUrl && (
                        <div>
                          <p className="text-xs text-gray-400 mb-2">Submitted Photo</p>
                          <img
                            src={selected.photoUrl}
                            alt={`${selected.name} submitted`}
                            className="w-full h-48 object-cover rounded-xl border border-gray-200"
                          />
                          <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={selected.displayPhoto}
                              disabled={actionLoading}
                              onChange={() => toggleDisplaySetting(selected, 'displayPhoto')}
                              className="rounded border-gray-300 text-[#0088e0] focus:ring-[#0088e0]"
                            />
                            Show photo publicly
                          </label>
                        </div>
                      )}

                      {selected.socialUrl && (
                        <div>
                          <p className="text-xs text-gray-400 mb-2">Submitted Social Link</p>
                          <a
                            href={selected.socialUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-[#0088e0] break-all hover:underline"
                          >
                            {selected.socialUrl}
                          </a>
                          <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={selected.displaySocialLink}
                              disabled={actionLoading}
                              onChange={() => toggleDisplaySetting(selected, 'displaySocialLink')}
                              className="rounded border-gray-300 text-[#0088e0] focus:ring-[#0088e0]"
                            />
                            Show social link publicly
                          </label>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <div className="border-t border-gray-100 my-4" />

                <p className="text-xs text-gray-500 leading-relaxed mb-4 bg-gray-50 rounded-lg p-3 italic">
                  &quot;{selected.text}&quot;
                </p>

                {!selected.emailVerified && selected.status !== 'rejected' && (
                  <div className="mb-3 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                    This testimonial must be email-verified before it can be approved.
                  </div>
                )}

                <div className="space-y-2">
                  {selected.status !== 'approved' && (
                    <button
                      onClick={() => updateStatus(selected, 'approved')}
                      disabled={actionLoading || !selected.emailVerified}
                      className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                    >
                      <CheckCircle size={16} /> Approve & Publish
                    </button>
                  )}
                  {selected.status !== 'rejected' && (
                    <button
                      onClick={() => updateStatus(selected, 'rejected')}
                      disabled={actionLoading}
                      className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 py-2.5 rounded-lg text-sm font-medium transition-colors"
                    >
                      <XCircle size={16} /> Reject
                    </button>
                  )}
                  {selected.status === 'approved' && (
                    <button
                      onClick={() => toggleFeatured(selected)}
                      disabled={actionLoading}
                      className="w-full flex items-center justify-center gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 py-2.5 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Award size={16} /> {selected.featured ? 'Unfeature' : 'Mark as Featured'}
                    </button>
                  )}
                  <button
                    onClick={() => deleteTestimonial(selected.id)}
                    disabled={actionLoading}
                    className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-red-500 hover:bg-red-50 border border-gray-200 hover:border-red-200 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Trash2 size={16} /> Delete Permanently
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'links' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-semibold text-[#01143d] mb-1">Generate New Invite Link</h3>
            <p className="text-gray-400 text-sm mb-4">
              Each link is one-time use and expires automatically one month after it is created. Add an email if you want us to send it immediately.
            </p>
            <div className="flex gap-3 flex-wrap">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Label — e.g. Sent to Anuk R. (VCE 2024)"
                className="flex-1 min-w-48 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0088e0]"
              />
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="Recipient email — optional"
                className="flex-1 min-w-64 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0088e0]"
              />
              <button
                onClick={createToken}
                disabled={creating || !newLabel.trim()}
                className="flex items-center gap-2 bg-[#0088e0] hover:bg-[#0066b3] disabled:bg-blue-200 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus size={16} />
                {creating ? 'Creating…' : 'Generate Link'}
              </button>
            </div>

            {generatedLink && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-green-700 text-sm font-medium mb-2">
                  {generatedEmail
                    ? `Link created and invite queued to ${generatedEmail}.`
                    : 'Link created. Copy and share it with the student or parent:'}
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white border border-green-200 rounded-lg px-3 py-2 text-green-800 break-all">
                    {generatedLink}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedLink);
                      setCopiedId('new');
                      setTimeout(() => setCopiedId(null), 2000);
                    }}
                    className="flex-shrink-0 p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                  >
                    {copiedId === 'new' ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
                <button
                  onClick={() => {
                    setGeneratedLink(null);
                    setGeneratedEmail(null);
                  }}
                  className="mt-2 text-xs text-green-600 underline"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-[#01143d]">All Invite Links</h3>
            </div>

            {tokLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-[#0088e0] border-t-transparent rounded-full" />
              </div>
            ) : tokens.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <Link2 size={32} className="mx-auto mb-3 opacity-30" />
                No links generated yet.
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {tokens.map((tok) => (
                  <div key={tok.id} className="px-5 py-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-[#01143d] truncate">{tok.label}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${tok.used ? 'bg-gray-50 text-gray-400 border-gray-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                          {tok.used ? 'Used' : 'Available'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Created {formatDate(tok.createdAt)}
                        {tok.recipientEmail && ` · Sent to ${tok.recipientEmail}`}
                        {tok.usedAt && ` · Used ${formatDate(tok.usedAt)}`}
                        {tok.expiresAt && ` · Expires ${formatDate(tok.expiresAt)}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!tok.used && (
                        <button
                          onClick={() => copyLink(tok.token, tok.id)}
                          title="Copy link"
                          className="p-2 text-gray-400 hover:text-[#0088e0] hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          {copiedId === tok.id ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                        </button>
                      )}
                      <button
                        onClick={() => deleteToken(tok.id)}
                        title="Revoke"
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-400 text-xs">{label}</span>
      <p className="text-[#01143d] text-sm font-medium">{value}</p>
    </div>
  );
}
