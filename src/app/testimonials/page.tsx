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
  const colors = ['#0088e0', '#0070c0', '#005fa3', '#1a7fc1', '#2196f3', '#01143d'];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
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

function studentMeta(testimonial: PublicTestimonial) {
  if (!testimonial.studentName) return null;
  if (testimonial.role === 'Parent') return `Parent of ${testimonial.studentName}`;
  if (testimonial.role === 'Guardian') return `Guardian of ${testimonial.studentName}`;
  return testimonial.studentName;
}

function matchesRoleFilter(testimonial: DisplayTestimonial, filter: RoleFilter) {
  if (filter === 'all') return true;
  if (filter === 'students') return testimonial.role === 'Student';
  return testimonial.role === 'Parent' || testimonial.role === 'Guardian';
}

function FacebookBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#cfe0ff] bg-[#edf3ff] px-2.5 py-1 text-xs font-semibold text-[#1877f2]">
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.019 4.388 11.009 10.125 11.927V15.56H7.078v-3.487h3.047V9.413c0-3.022 1.792-4.693 4.533-4.693 1.312 0 2.686.236 2.686.236v2.968h-1.514c-1.491 0-1.956.931-1.956 1.885v2.264h3.328l-.532 3.487h-2.796V24C19.612 23.082 24 18.092 24 12.073z" />
      </svg>
      From Facebook
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const labels: Record<string, string> = {
    Student: 'Student',
    Parent: 'Parent',
    Guardian: 'Guardian',
  };

  return (
    <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
      {labels[role] ?? role}
    </span>
  );
}

function FeatureBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
      </svg>
      Featured
    </span>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[...Array(5)].map((_, index) => (
        <svg
          key={index}
          className={`h-4 w-4 ${index < rating ? 'text-yellow-400' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function TestimonialCard({
  testimonial,
  highlighted = false,
}: {
  testimonial: DisplayTestimonial;
  highlighted?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const context = studentMeta(testimonial);
  const limit = highlighted ? 320 : 170;
  const collapsible = testimonial.text.length > limit;
  const preview = collapsible && !expanded
    ? `${testimonial.text.slice(0, limit).trimEnd()}...`
    : testimonial.text;

  return (
    <article className={`flex h-full flex-col rounded-[28px] border border-slate-100 bg-white ${highlighted ? 'shadow-lg' : 'shadow-sm'} transition-shadow hover:shadow-xl`}>
      <div className={`${highlighted ? 'p-7' : 'p-5'} flex flex-col gap-4`}>
        <div className="flex items-start gap-4">
          {testimonial.photoUrl ? (
            <img
              src={testimonial.photoUrl}
              alt={`${testimonial.name} profile`}
              className={`${highlighted ? 'h-16 w-16' : 'h-12 w-12'} rounded-2xl border border-slate-100 object-cover`}
            />
          ) : (
            <div
              className={`${highlighted ? 'h-16 w-16 text-lg' : 'h-12 w-12 text-base'} flex items-center justify-center rounded-2xl font-bold text-white`}
              style={{ backgroundColor: avatarColor(testimonial.name) }}
            >
              {initials(testimonial.name)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className={`${highlighted ? 'text-xl' : 'text-base'} truncate font-semibold text-[#01143d]`}>
                  {testimonial.name}
                </h3>
                {context && <p className="mt-1 truncate text-sm font-medium text-sky-700">{context}</p>}
                <p className="mt-1 text-sm text-slate-500">
                  {testimonial.course} · {testimonial.year}
                </p>
              </div>
              <StarRating rating={testimonial.stars} />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <RoleBadge role={testimonial.role} />
              {testimonial.featured && <FeatureBadge />}
              {testimonial.source === 'facebook' && <FacebookBadge />}
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <svg className="h-7 w-7 text-[#0088e0]/15" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
          </svg>
          <p className={`${highlighted ? 'mt-3 text-base leading-8' : 'mt-3 text-sm leading-7'} text-slate-600`}>
            {preview}
          </p>
          {collapsible && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#0088e0] hover:text-[#0066b3]"
            >
              {expanded ? 'Show less' : 'Read more'}
              <svg
                className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
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

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3">
        {testimonial.result && (
          <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
            Result: {testimonial.result}
          </span>
        )}
        {testimonial.socialUrl && (
          <a
            href={testimonial.socialUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100"
          >
            View profile
          </a>
        )}
        <span className="ml-auto text-xs text-slate-400">{formatDate(testimonial.submittedAt)}</span>
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
  const otherTestimonials = filteredTestimonials.filter((testimonial) => !testimonial.featured);
  const totalCount = allTestimonials.length;
  const averageRating = totalCount
    ? (allTestimonials.reduce((sum, testimonial) => sum + testimonial.stars, 0) / totalCount).toFixed(1)
    : '0.0';
  const familyCount = allTestimonials.filter((testimonial) => testimonial.role !== 'Student').length;
  const facebookCount = legacyTestimonials.length;

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-900">
      <div className="border-b border-white/10 bg-[#01143d]">
        <Navbar />
      </div>

      <main>
        <section className="bg-gradient-to-b from-[#eef6ff] via-white to-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
              <div className="max-w-3xl">
                <span className="inline-flex items-center rounded-full border border-[#b8d7ff] bg-[#edf6ff] px-4 py-1.5 text-sm font-semibold text-[#0d5ea8]">
                  Student and parent voices
                </span>
                <h1 className="mt-5 text-4xl font-bold tracking-tight text-[#01143d] sm:text-5xl">
                  What Students and Parents Say About Dr. U Education
                </h1>
                <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
                  Real feedback from students and families who have worked with us across VCE, selective entry, and school-year tutoring.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { value: `${totalCount}+`, label: 'Stories on this page' },
                  { value: `${averageRating} / 5`, label: 'Average rating' },
                  { value: `${familyCount}+`, label: 'Parents and guardians' },
                  { value: `${facebookCount}+`, label: 'From Facebook' },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                    <div className="text-3xl font-bold text-[#01143d]">{stat.value}</div>
                    <div className="mt-1 text-sm text-slate-500">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-8 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#0088e0]">Browse</p>
                <h2 className="mt-2 text-2xl font-bold text-[#01143d]">Featured first, then the full list</h2>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  Facebook-sourced testimonials are labeled. Approved testimonials from the admin flow also appear here automatically.
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
                        : 'border-slate-200 bg-white text-slate-600 hover:border-[#0088e0] hover:text-[#0088e0]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#0088e0] border-t-transparent" />
            </div>
          ) : (
            <>
              {featuredTestimonials.length > 0 && (
                <section className="mb-14">
                  <div className="mb-6 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#0088e0]">Featured</p>
                      <h2 className="mt-2 text-3xl font-bold text-[#01143d]">Standout stories</h2>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-500">
                      {featuredTestimonials.length} featured
                    </span>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    {featuredTestimonials.map((testimonial) => (
                      <TestimonialCard key={testimonial.id} testimonial={testimonial} highlighted />
                    ))}
                  </div>
                </section>
              )}

              <section>
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#0088e0]">All testimonials</p>
                    <h2 className="mt-2 text-3xl font-bold text-[#01143d]">More student and family feedback</h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-500">
                    {filteredTestimonials.length} visible
                  </span>
                </div>

                {filteredTestimonials.length === 0 ? (
                  <div className="rounded-[28px] border border-slate-200 bg-white px-8 py-16 text-center shadow-sm">
                    <p className="text-lg font-semibold text-[#01143d]">No testimonials in this view yet.</p>
                    <p className="mt-2 text-sm text-slate-500">Try a different filter to see more stories.</p>
                  </div>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {otherTestimonials.map((testimonial) => (
                      <TestimonialCard key={testimonial.id} testimonial={testimonial} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          <section className="mt-20 overflow-hidden rounded-[32px] bg-gradient-to-r from-[#01143d] to-[#0088e0] p-12 text-center text-white shadow-xl">
            <h2 className="text-3xl font-bold md:text-4xl">Join the Dr. U Family</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-white/90">
              Build your own success story with coaching that students and families remember long after the exam season ends.
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
          </section>
        </section>
      </main>

      <Footer />
      <ChatBot />
    </div>
  );
}
