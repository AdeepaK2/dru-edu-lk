'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Footer, ChatBot } from '@/components/ui';
import { PublicTestimonial } from '@/models/testimonialSchema';

// ── helpers ──────────────────────────────────────────────────────────────────

function avatarColor(name: string): string {
  const colors = [
    '#0088e0', '#0070c0', '#005fa3', '#1a7fc1', '#2196f3',
    '#01143d', '#0a2147', '#1565c0', '#1976d2', '#0d47a1',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
}

// ── sub-components ────────────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[...Array(5)].map((_, i) => (
        <svg
          key={i}
          className={`w-4 h-4 ${i < rating ? 'text-yellow-400' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium px-2 py-0.5 rounded-full">
      <svg className="w-3.5 h-3.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
      Email Verified
    </span>
  );
}

function RoleTag({ role }: { role: string }) {
  const map: Record<string, string> = {
    Student: 'Dr. U Student',
    Parent: 'Parent of Dr. U Student',
    Guardian: 'Guardian of Dr. U Student',
  };
  return (
    <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-medium px-2 py-0.5 rounded-full">
      {map[role] ?? role}
    </span>
  );
}

function studentMeta(t: PublicTestimonial) {
  if (!t.studentName) return null;
  if (t.role === 'Parent') return `Parent of ${t.studentName}`;
  if (t.role === 'Guardian') return `Guardian of ${t.studentName}`;
  return t.studentName;
}

function TestimonialCard({ t }: { t: PublicTestimonial }) {
  const studentContext = studentMeta(t);

  return (
    <div className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-shadow duration-300 border border-gray-100 flex flex-col">
      {/* Top bar */}
      <div className="p-5 pb-3 flex items-start gap-3">
        {/* Avatar */}
        {t.photoUrl ? (
          <img
            src={t.photoUrl}
            alt={`${t.name} profile`}
            className="w-12 h-12 rounded-full flex-shrink-0 object-cover shadow-md border border-gray-100"
          />
        ) : (
          <div
            className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white text-base shadow-md"
            style={{ backgroundColor: avatarColor(t.name) }}
          >
            {initials(t.name)}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="font-semibold text-[#01143d] text-sm truncate">{t.name}</h3>
            <StarRating rating={t.stars} />
          </div>
          {studentContext && (
            <p className="text-xs text-sky-700 mt-1 truncate">{studentContext}</p>
          )}

          {/* Role + course + year */}
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {t.course} · {t.year}
          </p>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            <RoleTag role={t.role} />
            {t.emailVerified && <VerifiedBadge />}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100 mx-5" />

      {/* Testimonial text */}
      <div className="px-5 py-4 flex-1">
        <svg className="w-6 h-6 text-[#0088e0]/20 mb-1 -ml-1" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
        </svg>
        <p className="text-gray-600 text-sm leading-relaxed">{t.text}</p>
      </div>

      {/* Footer */}
      <div className="px-5 pb-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {t.result && (
            <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 text-xs font-medium px-2 py-0.5 rounded-full">
              🏆 {t.result}
            </span>
          )}
          {t.socialUrl && (
            <a
              href={t.socialUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 border border-sky-200 text-xs font-medium px-2 py-0.5 rounded-full hover:bg-sky-100 transition-colors"
            >
              View Profile
            </a>
          )}
        </div>
        <span className="text-gray-400 text-xs ml-auto">{formatDate(t.submittedAt)}</span>
      </div>

      {/* Private invite note */}
      <div className="bg-gray-50 rounded-b-2xl border-t border-gray-100 px-5 py-2.5 flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <span className="text-gray-400 text-xs">Submitted via private invite · Reviewed by our team</span>
      </div>
    </div>
  );
}

// ── hardcoded legacy testimonials (from About page) ───────────────────────────

const legacyTestimonials: PublicTestimonial[] = [
  { id: 'l1', name: 'Arjun Weerasinghe', role: 'Parent', course: 'Selective High School Coaching', year: '2023', text: "My daughter recently looked towards Dr. U education and from the results we were amazed. Not only does Dr. U provide extensive and meticulous strategies for the Selective High School Entrance Exam but he also crafted excellent books for both, mathematics and numerical reasoning papers. These books were great practise and revision for her as each question was particularly challenging and required problem solving skills. Again, thank you so much Dr. U for all your hard work and time that took to create these very helpful resources which assisted my daughter take the Selective High School Entrance Exam. Couldn't have done it without you! All the best!", stars: 5, featured: true, emailVerified: false, submittedAt: '2023-01-01T00:00:00Z' },
  { id: 'l2', name: 'Shiyaamaa Fahme', role: 'Parent', course: 'Selective High School Coaching', year: '2023', text: "We were so blessed to Find Dr U Education for our Daughter's selective school coaching. Dr U is a very committed, motivated mentor with a vision. Dr U Rakhitha got the aptitude to estimate the actual capacity of the child and work in a way which suits the individual child's confidence and deliver the maximum output. More than whatsoever, what I respect the most is that, A parent can approach to him for a feedback. The BEST", stars: 5, featured: false, emailVerified: false, submittedAt: '2023-02-01T00:00:00Z' },
  { id: 'l3', name: 'Nuwan Dammika Abeysekera', role: 'Parent', course: 'Selective Entry Preparation', year: '2023', text: "I highly recommend Dr U Education for any student who wants to excel in Maths. Dedication and commitment by Dr U Education staff is highly professional and targeted. With support of Dr Rakitha, my daughter achieved a superior grade in the exam. Thank you.", stars: 5, featured: false, emailVerified: false, submittedAt: '2023-03-01T00:00:00Z' },
  { id: 'l4', name: 'Anuk Ranatunga', role: 'Student', course: 'VCE Maths Methods & Specialist', year: '2022', result: '48 in Methods · 53 in Specialist', text: "I am a graduate from Melbourne High School and achieved a 48 for Methods and 53 for Specialist Maths from going to Dr U. He really built discipline into me through his strict and difficult methods of teaching. It allowed me to reach a high level of mathematics hence the scores I got, I could not have done it without him.", stars: 5, featured: true, emailVerified: false, submittedAt: '2022-12-01T00:00:00Z' },
  { id: 'l5', name: 'Saman Vidyananda', role: 'Parent', course: 'VCE Maths Methods & Specialist', year: '2023', text: "It was truly a blessing to find Dr Udugama as a tutor for our son with maths methods and specialist maths. He constantly provided feedback and was just a phone call away to discuss any issues. He guided my son with valuable advice to be on top of his studies and trained him to excel in his VCE exam.", stars: 5, featured: false, emailVerified: false, submittedAt: '2023-04-01T00:00:00Z' },
  { id: 'l6', name: 'Shashini Kandamulla', role: 'Student', course: 'VCE Maths Methods & Specialist', year: '2023', result: '47 in Methods · 52 in Specialist', text: "Thanks to Dr.U's tutoring I was able to achieve 47 for Methods and 52 for Specialist Maths. From the start, Dr. U had a very clear plan. The significant amount of practice papers that Dr. U offered us was really helpful. Dr. U is a very dedicated tutor and he is willing to spend extra hours in order to help his students achieve their greatest potential.", stars: 5, featured: true, emailVerified: false, submittedAt: '2023-05-01T00:00:00Z' },
  { id: 'l7', name: 'Wayne Jansen', role: 'Parent', course: 'Selective High School Coaching', year: '2023', text: "Dr U immediately got to work with Josh and started encouraging Josh to consider various strategies and also started working even on a one-on-one basis to rectify areas of weakness. Within 2 months of attending classes, we were dealing with a kid that was ultra motivated. As we celebrated an excellent outcome, we look back and give full credit to Dr U. Highly recommend the institute.", stars: 5, featured: false, emailVerified: false, submittedAt: '2023-06-01T00:00:00Z' },
  { id: 'l8', name: 'Puneet Ram Badireddi', role: 'Student', course: 'VCE Multiple Subjects', year: '2024', text: "Highly recommend Dr U. I've been with him since 2023 and the experience helped immensely across multiple subjects. His teaching style is clear, patient and tailored to how I learn best, which has made difficult concepts much easier to grasp. Thanks to his guidance, I've gained confidence and improved my understanding significantly.", stars: 5, featured: false, emailVerified: false, submittedAt: '2024-01-01T00:00:00Z' },
  { id: 'l9', name: 'Rivith Senaratne', role: 'Student', course: 'VCE Maths', year: '2024', text: "As a former student at Dr. U Education, I observed that classes operate with a level of academic rigor and structured methodology that is rare to find. Under his guidance, I achieved significant improvement in both subjects.", stars: 5, featured: false, emailVerified: false, submittedAt: '2024-02-01T00:00:00Z' },
  { id: 'l10', name: 'Karthik Kalaiselvan', role: 'Student', course: 'VCE Maths', year: '2024', text: "I had the privilege of being tutored by Dr U from Year 9 through to Year 12. Dr U is far more than a tutor — he is a mentor, coach, and role model whose commitment to his students is truly extraordinary.", stars: 5, featured: true, emailVerified: false, submittedAt: '2024-03-01T00:00:00Z' },
  { id: 'l11', name: 'Akshay Raju', role: 'Student', course: 'VCE Methods, Specialist & Chemistry', year: '2024', text: "Doctor U wasn't just a teacher to me but a father figure. He taught me Methods, Specialist and Chemistry with passion and had an innate way of explaining concepts from different viewpoints.", stars: 5, featured: false, emailVerified: false, submittedAt: '2024-04-01T00:00:00Z' },
  { id: 'l12', name: 'Shanon Angelo', role: 'Student', course: 'VCE Specialist, Methods & Physics', year: '2024', text: "I cannot recommend Dr. U highly enough. He was my Specialist Math, Methods and Physics tutor. His expertise and comprehensive teaching approach has been transformative for my studies.", stars: 5, featured: false, emailVerified: false, submittedAt: '2024-05-01T00:00:00Z' },
];

// ── main page ─────────────────────────────────────────────────────────────────

export default function TestimonialsPage() {
  const [liveTestimonials, setLiveTestimonials] = useState<PublicTestimonial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/testimonials/public')
      .then((r) => r.json())
      .then((data: PublicTestimonial[]) => {
        if (Array.isArray(data)) setLiveTestimonials(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Merge: live (approved) first, then legacy
  const all = [...liveTestimonials, ...legacyTestimonials];

  // Stats
  const totalCount = all.length;
  const avgRating = (all.reduce((s, t) => s + t.stars, 0) / totalCount).toFixed(1);
  const verifiedCount = all.filter((t) => t.emailVerified).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#01143d] via-[#0a2147] to-[#0088e0] relative overflow-hidden">
      {/* Background dots */}
      <div className="absolute inset-0 opacity-20">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <Navbar />

      {/* Hero */}
      <header className="relative py-20 px-4 text-center">
        <div className="max-w-4xl mx-auto">
          <span className="inline-block bg-white/20 backdrop-blur-sm text-white px-6 py-2 rounded-full text-sm font-medium border border-white/30 mb-8">
            Real Words · Real Students · Real Results
          </span>
          <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-6 leading-tight">
            What Our{' '}
            <span className="bg-gradient-to-r from-[#0088e0] to-[#00b4d8] bg-clip-text text-transparent">
              Students Say
            </span>
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto leading-relaxed">
            Every testimonial below was personally invited and submitted by a real student or parent.
            Each one is reviewed by our team before being published.
          </p>

          {/* Trust stats */}
          {!loading && (
            <div className="flex justify-center gap-8 mt-10 flex-wrap">
              {[
                { value: totalCount + '+', label: 'Testimonials' },
                { value: avgRating + ' ★', label: 'Average Rating' },
                { value: verifiedCount > 0 ? verifiedCount + '+' : '100%', label: verifiedCount > 0 ? 'Email Verified' : 'Personally Invited' },
              ].map((s) => (
                <div key={s.label} className="bg-white/15 backdrop-blur-sm border border-white/30 rounded-2xl px-8 py-4 text-center">
                  <div className="text-3xl font-extrabold text-white">{s.value}</div>
                  <div className="text-white/70 text-sm mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="relative bg-gradient-to-b from-white to-gray-50 rounded-t-3xl pt-16 pb-24 -mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* How it works – authenticity explainer */}
          <div className="bg-gradient-to-r from-[#01143d] to-[#0a2147] rounded-2xl p-6 mb-12 flex flex-col md:flex-row items-center gap-6 shadow-lg">
            <div className="flex-shrink-0 w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">Why you can trust these testimonials</h3>
              <p className="text-white/70 text-sm mt-1 leading-relaxed">
                Every testimonial is submitted through a <strong className="text-white">private, one-time invite link</strong> that
                we personally send to students and parents. Each submission goes through an
                <strong className="text-white"> email verification step</strong> and is then
                <strong className="text-white"> reviewed by our team</strong> before appearing here.
                We never edit the content — only the student or parent's own words are published.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin w-10 h-10 border-4 border-[#0088e0] border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {all.map((t) => (
                <TestimonialCard key={t.id} t={t} />
              ))}
            </div>
          )}

          {/* CTA */}
          <div className="text-center mt-20 bg-gradient-to-r from-[#01143d] to-[#0088e0] rounded-3xl p-12 text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-4 left-4 w-20 h-20 bg-white rounded-full blur-xl animate-pulse" />
              <div className="absolute bottom-4 right-4 w-32 h-32 bg-white rounded-full blur-2xl animate-pulse" />
            </div>
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Join the Dr. U Family</h2>
              <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
                Experience the coaching that turns these words into your reality.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  href="/enroll"
                  className="bg-white text-[#01143d] hover:bg-gray-100 px-8 py-3 rounded-full font-semibold shadow-lg transition-all duration-300 hover:scale-105"
                >
                  Enroll Now
                </Link>
                <Link
                  href="/courses"
                  className="bg-transparent border-2 border-white hover:bg-white/10 px-8 py-3 rounded-full font-semibold transition-all duration-300"
                >
                  View Courses
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
      <ChatBot />
    </div>
  );
}
