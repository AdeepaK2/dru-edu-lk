'use client';

import React from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Footer, ChatBot } from '@/components/ui';

const branchLocations = [
  {
    name: 'Cranbourne Branch',
    address: '63A High Street, Cranbourne',
    description:
      'A long-standing Dr. U Education location serving families in the south-east with VCE, selective entry, and school-year support.',
  },
  {
    name: 'Glen Waverley Branch',
    address: '230/A Blackburn Road, Glen Waverley',
    description:
      'A key Melbourne teaching centre for VCE Mathematics, Sciences, and high-performing students preparing for competitive pathways.',
  },
];

const focusAreas = [
  'VCE Mathematics Methods and Specialist Mathematics',
  'VCE Physics and Chemistry',
  'Selective school preparation',
  'Strong academic foundations for school-year students',
];

const signatureStandards = [
  'Small-group teaching with close academic attention',
  'A disciplined classroom culture built around consistency',
  'Clear preparation for tests, exams, and competitive pathways',
];

const performancePoints = [
  'Students across recent cohorts have achieved standout scores in Specialist Mathematics, Methods, Physics, and Chemistry.',
  'Many results highlighted across the site sit above 45, with multiple 50+ scaled Specialist Mathematics outcomes.',
  'Families choose Dr. U Education for disciplined preparation, clear structure, and close academic guidance.',
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-900">
      <Navbar />

      <main>
        <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(58,167,255,0.22),_transparent_30%),radial-gradient(circle_at_85%_18%,_rgba(255,255,255,0.09),_transparent_18%),linear-gradient(180deg,#02112f_0%,#081f4b_54%,#0d2c61_100%)] pt-24 pb-24 text-white">
          <div className="absolute inset-0 opacity-20">
            <div
              className="h-full w-full"
              style={{
                backgroundImage:
                  'url("data:image/svg+xml,%3Csvg width=\'64\' height=\'64\' viewBox=\'0 0 64 64\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.06\'%3E%3Ccircle cx=\'32\' cy=\'32\' r=\'2\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
              }}
            />
          </div>

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-end gap-10 lg:grid-cols-[1.08fr_0.92fr]">
              <div className="max-w-4xl">
                <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur">
                  Melbourne coaching for serious academic outcomes
                </span>
                <h1 className="mt-6 text-5xl font-black leading-[0.98] tracking-[-0.04em] md:text-7xl">
                  Built for students who want more than ordinary tutoring
                </h1>
                <p className="mt-6 max-w-3xl text-lg leading-8 text-white/78 md:text-xl">
                  Dr. U Education combines rigorous teaching, disciplined preparation,
                  and close academic guidance to help students perform at a higher level.
                  From VCE to selective entry, the focus is simple: serious work, clear
                  direction, and results that stand up.
                </p>
              </div>

              <div className="rounded-[34px] border border-white/12 bg-white/8 p-7 shadow-[0_30px_120px_rgba(1,20,61,0.28)] backdrop-blur-md">
                <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#9edcff]">
                  A Note On The Standard
                </div>
                <p className="mt-5 text-2xl font-semibold leading-10 text-white/95">
                  We do not position ourselves as casual tutoring. We built Dr. U
                  Education to be a serious academic environment for families who value
                  structure, accountability, and strong outcomes.
                </p>
                <div className="mt-6 border-t border-white/10 pt-5 text-sm text-white/62">
                  Founded by Dr. Udugama Rakhitha
                </div>
              </div>
            </div>

            <div className="mt-14 grid gap-4 md:grid-cols-4">
              <div className="rounded-[28px] border border-white/12 bg-white/8 p-6 backdrop-blur">
                <div className="text-3xl font-black tracking-[-0.03em]">2010</div>
                <p className="mt-2 text-sm leading-6 text-white/68">A proven coaching track record built over more than a decade</p>
              </div>
              <div className="rounded-[28px] border border-white/12 bg-white/8 p-6 backdrop-blur">
                <div className="text-3xl font-black tracking-[-0.03em]">2</div>
                <p className="mt-2 text-sm leading-6 text-white/68">Established Melbourne branches serving different family communities</p>
              </div>
              <div className="rounded-[28px] border border-white/12 bg-white/8 p-6 backdrop-blur">
                <div className="text-3xl font-black tracking-[-0.03em]">4.9</div>
                <p className="mt-2 text-sm leading-6 text-white/68">Aggregate site rating reflected in the brand metadata</p>
              </div>
              <div className="rounded-[28px] border border-white/12 bg-white/8 p-6 backdrop-blur">
                <div className="text-3xl font-black tracking-[-0.03em]">150+</div>
                <p className="mt-2 text-sm leading-6 text-white/68">Public reviews and testimonials referenced across the website</p>
              </div>
            </div>
          </div>
        </section>

        <section className="-mt-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[36px] bg-white p-8 shadow-[0_32px_100px_rgba(15,23,42,0.08)] md:p-10">
                <span className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0088e0]">
                  Our Founder
                </span>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-900 md:text-4xl">
                  Founded by Dr. Udugama Rakhitha
                </h2>
                <p className="mt-5 text-lg leading-8 text-slate-600">
                  Dr. U Education was founded by Dr. Udugama Rakhitha to create an
                  academic centre with a higher standard of teaching, preparation, and
                  follow-through. The model is deliberate: less noise, more clarity,
                  more disciplined work, and teaching that pushes students to think
                  properly instead of memorising their way through difficult material.
                </p>
                <p className="mt-4 text-lg leading-8 text-slate-600">
                  The goal has never been to offer generic tutoring. It has been to build
                  a serious coaching environment where strong fundamentals, hard work,
                  and exam-ready performance all matter at the same time.
                </p>
                <div className="mt-8 rounded-[28px] border border-slate-200 bg-slate-50 px-6 py-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Philosophy
                  </p>
                  <p className="mt-3 text-lg leading-8 text-slate-700">
                    Students improve when expectations are clear, teaching is precise,
                    and every class has direction. That belief still shapes the centre
                    today.
                  </p>
                </div>
              </div>

              <div className="rounded-[36px] bg-[#081c43] p-8 text-white shadow-[0_32px_100px_rgba(1,20,61,0.2)] md:p-10">
                <span className="text-sm font-semibold uppercase tracking-[0.24em] text-[#7fd0ff]">
                  Where We Specialise
                </span>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] md:text-4xl">
                  High-value subjects. High expectations.
                </h2>
                <ul className="mt-6 space-y-4">
                  {focusAreas.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-white/88"
                    >
                      <span className="mt-1 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#27b0ff] text-xs font-bold text-[#01143d]">
                        ✓
                      </span>
                      <span className="text-base leading-7">{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8 border-t border-white/10 pt-6">
                  <p className="text-base leading-7 text-white/70">
                    The centre is built for families who care about quality teaching in
                    demanding subjects, not just extra class time.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 max-w-3xl">
              <span className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0088e0]">
                Our Branches
              </span>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-900 md:text-4xl">
                Two Melbourne locations serving families across the city
              </h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                Dr. U Education currently operates from two main branch locations,
                making it easier for families to access in-person support while keeping
                the same academic expectations across the centre.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {branchLocations.map((branch) => (
                <div
                  key={branch.name}
                  className="rounded-[32px] border border-slate-200/80 bg-white p-8 shadow-[0_24px_70px_rgba(15,23,42,0.05)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_90px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="inline-flex rounded-full bg-[#e7f5ff] px-4 py-2 text-sm font-semibold text-[#0469b2]">
                      {branch.name}
                    </div>
                    <span className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Melbourne
                    </span>
                  </div>
                  <h3 className="mt-5 text-2xl font-bold text-slate-900">{branch.address}</h3>
                  <p className="mt-4 text-base leading-7 text-slate-600">{branch.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[36px] bg-[linear-gradient(180deg,#eef7ff_0%,#f8fbff_100%)] p-8 md:p-10">
                <span className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0088e0]">
                  Student Performance
                </span>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-900 md:text-4xl">
                  Strong results are part of the culture here
                </h2>
                <p className="mt-5 text-lg leading-8 text-slate-700">
                  Across recent cohorts featured on the site, students have achieved
                  exceptional outcomes in demanding subjects and competitive pathways.
                  The emphasis is not only on marks, but on building the habits and
                  thinking patterns that lead to strong long-term performance.
                </p>
              </div>

              <div className="grid gap-4">
                {performancePoints.map((point) => (
                  <div
                    key={point}
                    className="rounded-[28px] border border-slate-200 bg-slate-50 px-6 py-6"
                  >
                    <p className="text-base leading-7 text-slate-700">{point}</p>
                  </div>
                ))}

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-[28px] bg-[#01143d] px-6 py-7 text-white shadow-[0_20px_60px_rgba(1,20,61,0.16)]">
                    <div className="text-3xl font-black tracking-[-0.03em]">45+</div>
                    <p className="mt-2 text-sm leading-6 text-white/75">A level many highlighted VCE students consistently reach across key subjects</p>
                  </div>
                  <div className="rounded-[28px] bg-[#0e62ad] px-6 py-7 text-white shadow-[0_20px_60px_rgba(14,98,173,0.18)]">
                    <div className="text-3xl font-black tracking-[-0.03em]">50+</div>
                    <p className="mt-2 text-sm leading-6 text-white/78">Scaled Specialist Mathematics outcomes shown among recent students</p>
                  </div>
                  <div className="rounded-[28px] bg-[#0a8adb] px-6 py-7 text-white shadow-[0_20px_60px_rgba(10,138,219,0.18)]">
                    <div className="text-3xl font-black tracking-[-0.03em]">99+</div>
                    <p className="mt-2 text-sm leading-6 text-white/82">ATAR-level outcomes featured in the student results already shown on the site</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[1fr_0.88fr] lg:px-8">
            <div className="rounded-[36px] bg-[#01143d] p-8 text-white shadow-[0_28px_100px_rgba(1,20,61,0.14)] md:p-10">
              <span className="text-sm font-semibold uppercase tracking-[0.24em] text-[#7fd0ff]">
                Signature Standards
              </span>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] md:text-4xl">
                What makes the experience feel different
              </h2>
              <div className="mt-6 space-y-4">
                {signatureStandards.map((item) => (
                  <div
                    key={item}
                    className="rounded-[22px] border border-white/10 bg-white/5 px-5 py-5 text-base leading-7 text-white/82"
                  >
                    {item}
                  </div>
                ))}
              </div>
              <p className="mt-6 text-base leading-8 text-white/70">
                Families stay because the environment is serious without being empty,
                structured without being confusing, and ambitious without losing care.
              </p>
            </div>

            <div className="rounded-[36px] bg-white p-8 shadow-[0_28px_100px_rgba(15,23,42,0.06)] md:p-10">
              <span className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0088e0]">
                Hear It Directly
              </span>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-900">
                Read what students and parents say about the centre
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                Explore real feedback from families who have worked with Dr. U Education
                across VCE, selective entry, and school-year tutoring.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/testimonials"
                  className="rounded-full bg-[#0088e0] px-7 py-3 font-semibold text-white transition hover:bg-[#0070ba]"
                >
                  View Testimonials
                </Link>
                <Link
                  href="/courses"
                  className="rounded-full border border-slate-300 px-7 py-3 font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Explore Courses
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="pb-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-[40px] bg-[radial-gradient(circle_at_15%_20%,_rgba(255,255,255,0.1),_transparent_22%),linear-gradient(135deg,#01143d_0%,#0d2f68_55%,#0088e0_100%)] px-8 py-12 text-white shadow-[0_34px_120px_rgba(1,20,61,0.18)] md:px-12">
              <div className="max-w-3xl">
                <span className="text-sm font-semibold uppercase tracking-[0.24em] text-[#bde7ff]">
                  Start With The Right Support
                </span>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] md:text-5xl">
                  Join Dr. U Education
                </h2>
                <p className="mt-5 text-lg leading-8 text-white/84">
                  If you are looking for serious academic coaching in Melbourne, Dr. U
                  Education offers a structured environment, strong subject expertise,
                  and a long record of helping students aim higher.
                </p>
              </div>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/enroll"
                  className="rounded-full bg-white px-8 py-3 text-center font-semibold text-[#01143d] transition hover:bg-slate-100"
                >
                  Enroll Now
                </Link>
                <Link
                  href="/schedule"
                  className="rounded-full border border-white/30 px-8 py-3 text-center font-semibold text-white transition hover:bg-white/10"
                >
                  View Schedule
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <ChatBot />
    </div>
  );
}
