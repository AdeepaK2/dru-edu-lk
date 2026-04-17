'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Footer, ChatBot } from '@/components/ui';
import { PublicTestimonial } from '@/models/testimonialSchema';

type DisplayTestimonial = PublicTestimonial & {
  source?: 'facebook';
};

type RoleFilter = 'all' | 'students' | 'families';

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
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
}

function studentMeta(t: PublicTestimonial) {
  if (!t.studentName) return null;
  if (t.role === 'Parent') return `Parent of ${t.studentName}`;
  if (t.role === 'Guardian') return `Guardian of ${t.studentName}`;
  return t.studentName;
}

function matchesRoleFilter(t: DisplayTestimonial, filter: RoleFilter) {
  if (filter === 'all') return true;
  if (filter === 'students') return t.role === 'Student';
  return t.role === 'Parent' || t.role === 'Guardian';
}

function FacebookBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 bg-[#edf3ff] text-[#1877f2] border border-[#cfe0ff] text-xs font-semibold px-2.5 py-1 rounded-full">
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.019 4.388 11.009 10.125 11.927V15.56H7.078v-3.487h3.047V9.413c0-3.022 1.792-4.693 4.533-4.693 1.312 0 2.686.236 2.686.236v2.968h-1.514c-1.491 0-1.956.931-1.956 1.885v2.264h3.328l-.532 3.487h-2.796V24C19.612 23.082 24 18.092 24 12.073z" />
      </svg>
      From Facebook
    </span>
  );
}

function RoleTag({ role }: { role: string }) {
  const labels: Record<string, string> = {
    Student: 'Student',
    Parent: 'Parent',
    Guardian: 'Guardian',
  };

  return (
    <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-medium px-2.5 py-1 rounded-full">
      {labels[role] ?? role}
    </span>
  );
}

function FeatureBadge() {
  return (
    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold px-2.5 py-1 rounded-full">
      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
      </svg>
      Featured
    </span>
  );
}

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const iconSize = size === 'md' ? 'w-5 h-5' : 'w-4 h-4';

  return (
    <div className="flex gap-0.5">
      {[...Array(5)].map((_, index) => (
        <svg
          key={index}
          className={`${iconSize} ${index < rating ? 'text-yellow-400' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function QuoteIcon() {
  return (
    <svg className="w-8 h-8 text-[#0088e0]/15" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
    </svg>
  );
}

function TestimonialCard({
  testimonial,
  variant = 'grid',
}: {
  testimonial: DisplayTestimonial;
  variant?: 'featured' | 'grid';
}) {
  const [expanded, setExpanded] = useState(false);
  const studentContext = studentMeta(testimonial);
  const maxLength = variant === 'featured' ? 280 : 190;
  const canExpand = testimonial.text.length > maxLength;
  const previewText = canExpand && !expanded
    ? `${testimonial.text.slice(0, maxLength).trimEnd()}...`
    : testimonial.text;

  return (
    <article
      className={`group flex flex-col overflow-hidden border border-gray-100 bg-white transition-all duration-300 ${
        variant === 'featured'
          ? 'rounded-3xl shadow-lg hover:-translate-y-1 hover:shadow-2xl'
          : 'rounded-2xl shadow-md hover:-translate-y-1 hover:shadow-xl'
      }`}
    >
      <div className={`${variant === 'featured' ? 'p-7' : 'p-5'} flex flex-col gap-4`}>
        <div className="flex items-start gap-4">
          {testimonial.photoUrl ? (
            <img
              src={testimonial.photoUrl}
              alt={`${testimonial.name} profile`}
              className={`${variant === 'featured' ? 'h-16 w-16' : 'h-12 w-12'} rounded-2xl object-cover border border-gray-100 shadow-sm`}
            />
          ) : (
            <div
              className={`${variant === 'featured' ? 'h-16 w-16 text-lg' : 'h-12 w-12 text-base'} rounded-2xl flex items-center justify-center font-bold text-white shadow-sm`}
              style={{ backgroundColor: avatarColor(testimonial.name) }}
            >
              {initials(testimonial.name)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className={`${variant === 'featured' ? 'text-xl' : 'text-base'} font-semibold text-[#01143d] truncate`}>
                  {testimonial.name}
                </h3>
                {studentContext && (
                  <p className="mt-1 text-sm font-medium text-sky-700 truncate">{studentContext}</p>
                )}
                <p className="mt-1 text-sm text-gray-500">
                  {testimonial.course} · {testimonial.year}
                </p>
              </div>
              <div className="flex-shrink-0">
                <StarRating rating={testimonial.stars} size={variant === 'featured' ? 'md' : 'sm'} />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <RoleTag role={testimonial.role} />
              {testimonial.featured && <FeatureBadge />}
              {testimonial.source === 'facebook' && <FacebookBadge />}
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-white p-4 border border-slate-100">
          <QuoteIcon />
          <p className={`${variant === 'featured' ? 'mt-3 text-base leading-8' : 'mt-3 text-sm leading-7'} text-gray-600`}>
            {previewText}
          </p>
          {canExpand && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#0088e0] hover:text-[#0066b3]"
            >
              {expanded ? 'Show less' : 'Read more'}
              <svg
                className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 011.08 1.04l-4.25 4.51a.75.75 0 01-1.08 0l-4.25-4.51a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="mt-auto border-t border-gray-100 bg-gray-50/80 px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {testimonial.result && (
            <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
              Result: {testimonial.result}
            </span>
          )}
          {testimonial.socialUrl && (
            <a
              href={testimonial.socialUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100"
            >
              View profile
            </a>
          )}
          <span className="ml-auto text-xs text-gray-400">{formatDate(testimonial.submittedAt)}</span>
        </div>
      </div>
    </article>
  );
}

const legacyTestimonials: DisplayTestimonial[] = [
  { id: 'l1', name: 'Arjun Weerasinghe', role: 'Parent', course: 'Selective High School Coaching', year: '2023', text: "My daughter recently looked towards Dr. U education and from the results we were amazed. Not only does Dr. U provide extensive and meticulous strategies for the Selective High School Entrance Exam but he also crafted excellent books for both, mathematics and numerical reasoning papers. These books were great practise and revision for her as each question was particularly challenging and required problem solving skills. Again, thank you so much Dr. U for all your hard work and time that took to create these very helpful resources which assisted my daughter take the Selective High School Entrance Exam. Couldn't have done it without you! All the best!", stars: 5, featured: true, submittedAt: '2023-01-01T00:00:00Z', source: 'facebook' },
  { id: 'l2', name: 'Shiyaamaa Fahme', role: 'Parent', course: 'Selective High School Coaching', year: '2023', text: "We were so blessed to Find Dr U Education for our Daughter's selective school coaching. Dr U is a very committed, motivated mentor with a vision. Dr U Rakhitha got the aptitude to estimate the actual capacity of the child and work in a way which suits the individual child's confidence and deliver the maximum output. More than whatsoever, what I respect the most is that, A parent can approach to him for a feedback. The BEST", stars: 5, featured: false, submittedAt: '2023-02-01T00:00:00Z', source: 'facebook' },
  { id: 'l3', name: 'Nuwan Dammika Abeysekera', role: 'Parent', course: 'Selective Entry Preparation', year: '2023', text: "I highly recommend Dr U Education for any student who wants to excel in Maths. Dedication and commitment by Dr U Education staff is highly professional and targeted. With support of Dr Rakitha, my daughter achieved a superior grade in the exam. Thank you.", stars: 5, featured: false, submittedAt: '2023-03-01T00:00:00Z', source: 'facebook' },
  { id: 'l4', name: 'Anuk Ranatunga', role: 'Student', course: 'VCE Maths Methods & Specialist', year: '2022', result: '48 in Methods · 53 in Specialist', text: "I am a graduate from Melbourne High School and achieved a 48 for Methods and 53 for Specialist Maths from going to Dr U. He really built discipline into me through his strict and difficult methods of teaching. It allowed me to reach a high level of mathematics hence the scores I got, I could not have done it without him.", stars: 5, featured: true, submittedAt: '2022-12-01T00:00:00Z', source: 'facebook' },
  { id: 'l5', name: 'Saman Vidyananda', role: 'Parent', course: 'VCE Maths Methods & Specialist', year: '2023', text: "It was truly a blessing to find Dr Udugama as a tutor for our son with maths methods and specialist maths. He constantly provided feedback and was just a phone call away to discuss any issues. He guided my son with valuable advice to be on top of his studies and trained him to excel in his VCE exam.", stars: 5, featured: false, submittedAt: '2023-04-01T00:00:00Z', source: 'facebook' },
  { id: 'l6', name: 'Shashini Kandamulla', role: 'Student', course: 'VCE Maths Methods & Specialist', year: '2023', result: '47 in Methods · 52 in Specialist', text: "Thanks to Dr.U's tutoring I was able to achieve 47 for Methods and 52 for Specialist Maths. From the start, Dr. U had a very clear plan. The significant amount of practice papers that Dr. U offered us was really helpful. Dr. U is a very dedicated tutor and he is willing to spend extra hours in order to help his students achieve their greatest potential.", stars: 5, featured: true, submittedAt: '2023-05-01T00:00:00Z', source: 'facebook' },
  { id: 'l7', name: 'Wayne Jansen', role: 'Parent', course: 'Selective High School Coaching', year: '2023', text: "Dr U immediately got to work with Josh and started encouraging Josh to consider various strategies and also started working even on a one-on-one basis to rectify areas of weakness. Within 2 months of attending classes, we were dealing with a kid that was ultra motivated. As we celebrated an excellent outcome, we look back and give full credit to Dr U. Highly recommend the institute.", stars: 5, featured: false, submittedAt: '2023-06-01T00:00:00Z', source: 'facebook' },
  { id: 'l8', name: 'Puneet Ram Badireddi', role: 'Student', course: 'VCE Multiple Subjects', year: '2024', text: "Highly recommend Dr U. I've been with him since 2023 and the experience helped immensely across multiple subjects. His teaching style is clear, patient and tailored to how I learn best, which has made difficult concepts much easier to grasp. Thanks to his guidance, I've gained confidence and improved my understanding significantly.", stars: 5, featured: false, submittedAt: '2024-01-01T00:00:00Z', source: 'facebook' },
  { id: 'l9', name: 'Rivith Senaratne', role: 'Student', course: 'VCE Maths', year: '2024', text: "As a former student at Dr. U Education, I observed that classes operate with a level of academic rigor and structured methodology that is rare to find. Under his guidance, I achieved significant improvement in both subjects.", stars: 5, featured: false, submittedAt: '2024-02-01T00:00:00Z', source: 'facebook' },
  { id: 'l10', name: 'Karthik Kalaiselvan', role: 'Student', course: 'VCE Maths', year: '2024', text: "I had the privilege of being tutored by Dr U from Year 9 through to Year 12. Dr U is far more than a tutor — he is a mentor, coach, and role model whose commitment to his students is truly extraordinary.", stars: 5, featured: true, submittedAt: '2024-03-01T00:00:00Z', source: 'facebook' },
  { id: 'l11', name: 'Akshay Raju', role: 'Student', course: 'VCE Methods, Specialist & Chemistry', year: '2024', text: "Doctor U wasn't just a teacher to me but a father figure. He taught me Methods, Specialist and Chemistry with passion and had an innate way of explaining concepts from different viewpoints.", stars: 5, featured: false, submittedAt: '2024-04-01T00:00:00Z', source: 'facebook' },
  { id: 'l12', name: 'Shanon Angelo', role: 'Student', course: 'VCE Specialist, Methods & Physics', year: '2024', text: "I cannot recommend Dr. U highly enough. He was my Specialist Math, Methods and Physics tutor. His expertise and comprehensive teaching approach has been transformative for my studies.", stars: 5, featured: false, submittedAt: '2024-05-01T00:00:00Z', source: 'facebook' },
];

export default function TestimonialsPage() {
  const [liveTestimonials, setLiveTestimonials] = useState<DisplayTestimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  useEffect(() => {
    fetch('/api/testimonials/public')
      .then((response) => response.json())
      .then((data: PublicTestimonial[]) => {
        if (Array.isArray(data)) {
          setLiveTestimonials(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const allTestimonials = useMemo(
    () => [...liveTestimonials, ...legacyTestimonials],
    [liveTestimonials]
  );

  const filteredTestimonials = useMemo(
    () => allTestimonials.filter((testimonial) => matchesRoleFilter(testimonial, roleFilter)),
    [allTestimonials, roleFilter]
  );

  const featuredTestimonials = filteredTestimonials.filter((testimonial) => testimonial.featured);
  const standardTestimonials = filteredTestimonials.filter((testimonial) => !testimonial.featured);
  const totalCount = allTestimonials.length;
  const averageRating = totalCount
    ? (allTestimonials.reduce((sum, testimonial) => sum + testimonial.stars, 0) / totalCount).toFixed(1)
    : '0.0';
  const familyCount = allTestimonials.filter((testimonial) => testimonial.role !== 'Student').length;
  const facebookCount = legacyTestimonials.length;

  return (
    <div className="min-h-screen overflow-hidden bg-gradient-to-br from-[#01143d] via-[#0a2147] to-[#0088e0] relative">
      <div className="absolute inset-0 opacity-20">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <Navbar />

      <header className="relative px-4 pb-24 pt-20 text-center">
        <div className="mx-auto max-w-5xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-6 py-2 text-sm font-medium text-white backdrop-blur-sm">
            Real stories from students and families
          </span>
          <h1 className="mt-8 text-5xl font-extrabold leading-tight text-white md:text-7xl">
            Testimonials That
            <span className="block bg-gradient-to-r from-[#7ed6ff] to-white bg-clip-text text-transparent">
              Feel Human
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-white/85 md:text-xl">
            Explore standout success stories, parent perspectives, and longer-form student feedback in a cleaner, easier-to-read format.
          </p>

          {!loading && (
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { value: `${totalCount}+`, label: 'Stories on this page' },
                { value: `${averageRating} / 5`, label: 'Average rating' },
                { value: `${familyCount}+`, label: 'Parents and guardians' },
                { value: `${facebookCount}+`, label: 'Imported from Facebook' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/25 bg-white/15 px-6 py-5 text-left backdrop-blur-sm">
                  <div className="text-3xl font-extrabold text-white">{stat.value}</div>
                  <div className="mt-1 text-sm text-white/70">{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="relative -mt-8 rounded-t-[2rem] bg-gradient-to-b from-white to-gray-50 pb-24 pt-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <section className="mb-10 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#0088e0]">Browse the voices</p>
                <h2 className="mt-2 text-3xl font-bold text-[#01143d]">Featured first, then everything else</h2>
                <p className="mt-3 text-sm leading-7 text-gray-500">
                  Featured stories are highlighted at the top. Hardcoded testimonials stay here too, and the Facebook-sourced ones are clearly marked.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {([
                  { id: 'all', label: 'All voices' },
                  { id: 'students', label: 'Students' },
                  { id: 'families', label: 'Parents and guardians' },
                ] as const).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setRoleFilter(option.id)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                      roleFilter === option.id
                        ? 'border-[#0088e0] bg-[#0088e0] text-white'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-[#0088e0] hover:text-[#0088e0]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#0088e0] border-t-transparent" />
            </div>
          ) : (
            <>
              {featuredTestimonials.length > 0 && (
                <section className="mb-16">
                  <div className="mb-6 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#0088e0]">Featured</p>
                      <h2 className="mt-2 text-3xl font-bold text-[#01143d]">Standout stories</h2>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-500">
                      {featuredTestimonials.length} highlighted
                    </span>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    {featuredTestimonials.map((testimonial) => (
                      <TestimonialCard key={testimonial.id} testimonial={testimonial} variant="featured" />
                    ))}
                  </div>
                </section>
              )}

              <section>
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#0088e0]">All testimonials</p>
                    <h2 className="mt-2 text-3xl font-bold text-[#01143d]">More student and parent feedback</h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-500">
                    {filteredTestimonials.length} shown
                  </span>
                </div>

                {filteredTestimonials.length === 0 ? (
                  <div className="rounded-3xl border border-gray-100 bg-white px-8 py-16 text-center shadow-sm">
                    <p className="text-lg font-semibold text-[#01143d]">No testimonials in this view yet.</p>
                    <p className="mt-2 text-sm text-gray-500">Try another filter to see more student or parent stories.</p>
                  </div>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {standardTestimonials.map((testimonial) => (
                      <TestimonialCard key={testimonial.id} testimonial={testimonial} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          <section className="relative mt-20 overflow-hidden rounded-[2rem] bg-gradient-to-r from-[#01143d] to-[#0088e0] p-12 text-center text-white">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute left-4 top-4 h-20 w-20 rounded-full bg-white blur-xl animate-pulse" />
              <div className="absolute bottom-4 right-4 h-32 w-32 rounded-full bg-white blur-2xl animate-pulse" />
            </div>
            <div className="relative z-10">
              <h2 className="text-3xl font-bold md:text-4xl">Join the Dr. U Family</h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-white/90">
                Build your own result story with coaching that students and families remember long after the exams are over.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
                <Link
                  href="/enroll"
                  className="rounded-full bg-white px-8 py-3 font-semibold text-[#01143d] shadow-lg transition-all duration-300 hover:scale-105 hover:bg-gray-100"
                >
                  Enroll now
                </Link>
                <Link
                  href="/courses"
                  className="rounded-full border-2 border-white bg-transparent px-8 py-3 font-semibold transition-all duration-300 hover:bg-white/10"
                >
                  View courses
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
      <ChatBot />
    </div>
  );
}
