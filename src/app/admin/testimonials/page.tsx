'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Star, CheckCircle, XCircle, Link2, Trash2, Plus, Copy, Check, Shield, Award } from 'lucide-react';

// ── types ─────────────────────────────────────────────────────────────────────

interface Testimonial {
  id: string;
  name: string;
  email: string;
  role: string;
  course: string;
  year: string;
  result?: string;
  text: string;
  stars: number;
  status: 'pending' | 'approved' | 'rejected';
  featured: boolean;
  emailVerified: boolean;
  adminNotes?: string;
  submittedAt: string;
  verifiedAt?: string;
}

interface Token {
  id: string;
  token: string;
  label: string;
  used: boolean;
  usedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

type Tab = 'testimonials' | 'links';
type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso?: string) {
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

// ── main component ────────────────────────────────────────────────────────────

export default function AdminTestimonialsPage() {
  const [tab, setTab] = useState<Tab>('testimonials');

  // testimonials state
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [tLoading, setTLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // tokens state
  const [tokens, setTokens] = useState<Token[]>([]);
  const [tokLoading, setTokLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [newExpiry, setNewExpiry] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  // ── data fetching ──────────────────────────────────────────────────────────

  const fetchTestimonials = useCallback(async () => {
    setTLoading(true);
    try {
      const r = await fetch('/api/admin/testimonials');
      if (r.ok) setTestimonials(await r.json());
    } finally {
      setTLoading(false);
    }
  }, []);

  const fetchTokens = useCallback(async () => {
    setTokLoading(true);
    try {
      const r = await fetch('/api/admin/testimonials/tokens');
      if (r.ok) setTokens(await r.json());
    } finally {
      setTokLoading(false);
    }
  }, []);

  useEffect(() => { fetchTestimonials(); }, [fetchTestimonials]);
  useEffect(() => { if (tab === 'links') fetchTokens(); }, [tab, fetchTokens]);

  // ── actions ────────────────────────────────────────────────────────────────

  async function updateStatus(id: string, status: 'approved' | 'rejected') {
    setActionLoading(true);
    try {
      await fetch('/api/admin/testimonials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      setTestimonials((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status } : t))
      );
      setSelectedId(null);
    } finally {
      setActionLoading(false);
    }
  }

  async function toggleFeatured(t: Testimonial) {
    setActionLoading(true);
    try {
      await fetch('/api/admin/testimonials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id, status: t.status, featured: !t.featured }),
      });
      setTestimonials((prev) =>
        prev.map((x) => (x.id === t.id ? { ...x, featured: !x.featured } : x))
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteTestimonial(id: string) {
    if (!confirm('Delete this testimonial permanently?')) return;
    await fetch(`/api/admin/testimonials?id=${id}`, { method: 'DELETE' });
    setTestimonials((prev) => prev.filter((t) => t.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  async function createToken() {
    if (!newLabel.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/admin/testimonials/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newLabel.trim(),
          expiresAt: newExpiry || undefined,
          createdBy: 'admin',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedLink(data.submissionLink);
        setNewLabel('');
        setNewExpiry('');
        fetchTokens();
      }
    } finally {
      setCreating(false);
    }
  }

  async function deleteToken(id: string) {
    if (!confirm('Revoke this link? It cannot be used after this.')) return;
    await fetch(`/api/admin/testimonials/tokens?id=${id}`, { method: 'DELETE' });
    setTokens((prev) => prev.filter((t) => t.id !== id));
  }

  function copyLink(token: string, id: string) {
    const base = window.location.origin;
    navigator.clipboard.writeText(`${base}/testimonials/submit/${token}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // ── derived ────────────────────────────────────────────────────────────────

  const filtered = statusFilter === 'all'
    ? testimonials
    : testimonials.filter((t) => t.status === statusFilter);

  const selected = testimonials.find((t) => t.id === selectedId) ?? null;

  const counts = {
    pending: testimonials.filter((t) => t.status === 'pending').length,
    approved: testimonials.filter((t) => t.status === 'approved').length,
    rejected: testimonials.filter((t) => t.status === 'rejected').length,
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Testimonials</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage submitted testimonials and generate invite links.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-6">
        {(['testimonials', 'links'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all capitalize ${
              tab === t ? 'bg-white shadow text-[#01143d]' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'testimonials' ? `Testimonials` : 'Invite Links'}
            {t === 'testimonials' && counts.pending > 0 && (
              <span className="ml-2 bg-yellow-100 text-yellow-700 text-xs px-1.5 py-0.5 rounded-full">
                {counts.pending}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TESTIMONIALS TAB ── */}
      {tab === 'testimonials' && (
        <div className="flex gap-6">
          {/* Left: list */}
          <div className="flex-1 min-w-0">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              {([
                { label: 'Pending', count: counts.pending, color: 'yellow', filter: 'pending' },
                { label: 'Approved', count: counts.approved, color: 'green', filter: 'approved' },
                { label: 'Rejected', count: counts.rejected, color: 'red', filter: 'rejected' },
              ] as const).map((s) => (
                <button
                  key={s.filter}
                  onClick={() => setStatusFilter(s.filter)}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    statusFilter === s.filter ? `ring-2 ring-${s.color}-400` : 'hover:shadow-md'
                  } bg-white`}
                >
                  <div className={`text-2xl font-bold text-${s.color}-600`}>{s.count}</div>
                  <div className="text-gray-500 text-sm">{s.label}</div>
                </button>
              ))}
            </div>

            {/* Filter bar */}
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
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{t.role} · {t.course} · {t.year}</p>
                        <p className="text-sm text-gray-600 mt-1.5 line-clamp-2">{t.text}</p>
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

          {/* Right: detail panel */}
          {selected && (
            <div className="w-80 flex-shrink-0">
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
                  <Row label="Email Verified" value={selected.emailVerified ? 'Yes' : 'No — pending'} />
                  <Row label="Submitted" value={formatDate(selected.submittedAt)} />
                </div>

                <div className="border-t border-gray-100 my-4" />

                <p className="text-xs text-gray-500 leading-relaxed mb-4 bg-gray-50 rounded-lg p-3 italic">
                  "{selected.text}"
                </p>

                {/* Actions */}
                <div className="space-y-2">
                  {selected.status !== 'approved' && (
                    <button
                      onClick={() => updateStatus(selected.id, 'approved')}
                      disabled={actionLoading}
                      className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                    >
                      <CheckCircle size={16} /> Approve & Publish
                    </button>
                  )}
                  {selected.status !== 'rejected' && (
                    <button
                      onClick={() => updateStatus(selected.id, 'rejected')}
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

      {/* ── INVITE LINKS TAB ── */}
      {tab === 'links' && (
        <div className="space-y-6">
          {/* Create new link */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-semibold text-[#01143d] mb-1">Generate New Invite Link</h3>
            <p className="text-gray-400 text-sm mb-4">
              Each link is one-time use. Share it directly with the student or parent you want a testimonial from.
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
                type="date"
                value={newExpiry}
                onChange={(e) => setNewExpiry(e.target.value)}
                title="Optional expiry date"
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0088e0] text-gray-500"
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
                <p className="text-green-700 text-sm font-medium mb-2">Link created! Share this with the student/parent:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white border border-green-200 rounded-lg px-3 py-2 text-green-800 break-all">
                    {generatedLink}
                  </code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(generatedLink); setCopiedId('new'); setTimeout(() => setCopiedId(null), 2000); }}
                    className="flex-shrink-0 p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                  >
                    {copiedId === 'new' ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
                <button onClick={() => setGeneratedLink(null)} className="mt-2 text-xs text-green-600 underline">Dismiss</button>
              </div>
            )}
          </div>

          {/* Link list */}
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
                {tokens.map((tok) => {
                  const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/testimonials/submit/${tok.token}`;
                  return (
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
                  );
                })}
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
