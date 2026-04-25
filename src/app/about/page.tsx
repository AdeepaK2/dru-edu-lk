'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Footer, ChatBot } from '@/components/ui';

const branchLocations = [
  {
    name: 'Cranbourne Branch',
    address: '63A High Street, Cranbourne',
    mapSrc:
      'https://www.google.com/maps?q=63A%20High%20Street%2C%20Cranbourne%20VIC&output=embed',
    description:
      "A long-standing Dr. U Education location supporting families in Melbourne's south-east.",
  },
  {
    name: 'Glen Waverley Branch',
    address: '230/A Blackburn Road, Glen Waverley',
    mapSrc:
      'https://www.google.com/maps?q=230%2FA%20Blackburn%20Road%2C%20Glen%20Waverley%20VIC&output=embed',
    description:
      'A key teaching centre for VCE Mathematics, Sciences, and high-performing students.',
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#f5f8fc] text-slate-900">
      <Navbar />

      <main>
        <section className="relative overflow-hidden bg-[#061b41] text-white">
          <div className="absolute inset-x-0 top-0 h-px bg-white/20" />
          <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-20 pt-24 sm:px-6 lg:grid-cols-[1.04fr_0.96fr] lg:px-8 lg:pb-24 lg:pt-28">
            <div className="flex flex-col justify-center">
              <span className="inline-flex w-fit items-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-sky-100">
                About Dr. U Education
              </span>
              <h1 className="mt-6 max-w-4xl text-4xl font-black leading-tight tracking-tight md:text-6xl">
                Academic leadership behind serious VCE coaching
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-200 md:text-xl">
                Dr. U Education is led by Dr. Udugama Rakhitha, whose PhD in
                Engineering from the USA, doctoral research background, and disciplined
                teaching shape a centre built for students who want structured,
                high-standard academic support.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/enroll"
                  className="rounded-full bg-white px-7 py-3 text-center font-semibold text-[#061b41] transition hover:bg-slate-100"
                >
                  Enroll Now
                </Link>
                <Link
                  href="/courses"
                  className="rounded-full border border-white/25 px-7 py-3 text-center font-semibold text-white transition hover:bg-white/10"
                >
                  Explore Courses
                </Link>
              </div>
            </div>

            <div className="flex items-end justify-center lg:justify-end">
              <div className="relative w-full max-w-[520px]">
                <div className="absolute inset-6 rounded-[32px] bg-sky-300/15 blur-3xl" />
                <div className="relative overflow-hidden rounded-[28px] border border-white/15 bg-white/8 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.22)]">
                  <div className="overflow-hidden rounded-[22px] bg-white">
                    <Image
                      src="/about/Dru.svg"
                      alt="Dr. Udugama Rakhitha"
                      width={810}
                      height={810}
                      priority
                      className="aspect-square h-auto w-full object-cover"
                    />
                  </div>
                  <div className="mt-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-200">
                      Founder
                    </p>
                    <h2 className="mt-2 text-2xl font-bold">Dr. Udugama Rakhitha</h2>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-20">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">
            <div>
              <span className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0088e0]">
                Founder Profile
              </span>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                A PhD Engineering educator with research depth
              </h2>
            </div>

            <div className="space-y-5 text-lg leading-8 text-slate-600">
              <p>
                Dr. Udugama Rakhitha holds a PhD in Engineering from the USA, bringing
                advanced doctoral research experience into the way students are taught
                to think, reason, and solve demanding academic problems.
              </p>
              <p>
                This advanced research background translates directly into the
                classroom. At Dr. U Education, students are guided to build strong
                fundamentals, reason through problems with precision, and approach
                VCE Mathematics, Physics, and Chemistry with the structured thinking
                that high-stakes assessments demand - not guesswork.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-[#eef5fb] py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 max-w-3xl">
              <span className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0088e0]">
                Academic Credentials
              </span>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                Documented academic foundation
              </h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                These records highlight the academic training behind the centre's
                teaching culture: a PhD credential from the USA and advanced doctoral
                research in engineering.
              </p>
            </div>

            <div className="space-y-6">
              <article className="grid overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.06)] lg:grid-cols-[1.1fr_0.9fr]">
                <div className="bg-slate-100 p-4 lg:p-6">
                  <Image
                    src="/about/degree.png"
                    alt="Doctor of Philosophy in Engineering certificate for Dr. Udugama Rakhitha"
                    width={864}
                    height={680}
                    className="h-auto w-full rounded-[14px] border border-slate-200 object-contain"
                  />
                </div>
                <div className="flex flex-col justify-center p-6 lg:p-10">
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0088e0]">
                    Primary Credential
                  </p>
                  <h3 className="mt-3 text-2xl font-bold text-slate-950">
                    Doctor of Philosophy in Engineering
                  </h3>
                </div>
              </article>

              <article className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.06)]">
                <div className="border-b border-slate-200 p-6 lg:p-8">
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0088e0]">
                    Doctoral Research
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-slate-950">
                    Interfacial Wave Dynamics of a Multiphase-Drop System
                  </h3>
                  <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
                    Dr. U's doctoral research in engineering shows the analytical and
                    scientific foundation behind his academic approach.
                  </p>
                </div>

                <div className="grid gap-4 bg-slate-100 p-4 md:grid-cols-2 lg:p-6">
                  <Image
                    src="/about/publication.png"
                    alt="Dissertation title page for Interfacial Wave Dynamics of a Multiphase-Drop System"
                    width={1639}
                    height={709}
                    className="h-auto w-full rounded-[14px] border border-slate-200 bg-white object-contain"
                  />
                  <Image
                    src="/about/publication2.png"
                    alt="Additional doctoral research publication record for Dr. Udugama Rakhitha"
                    width={1222}
                    height={483}
                    className="h-auto w-full rounded-[14px] border border-slate-200 bg-white object-contain"
                  />
                  <Image
                    src="/about/publication3.png"
                    alt="Additional doctoral research record for Dr. Udugama Rakhitha"
                    width={982}
                    height={402}
                    className="h-auto w-full rounded-[14px] border border-slate-200 bg-white object-contain"
                  />
                  <Image
                    src="/about/publication4.png"
                    alt="Additional doctoral research record for Dr. Udugama Rakhitha"
                    width={553}
                    height={677}
                    className="mx-auto h-auto max-h-[520px] w-full rounded-[14px] border border-slate-200 bg-white object-contain md:w-auto"
                  />
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="bg-[#f5f8fc] py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 max-w-3xl">
              <span className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0088e0]">
                Branches
              </span>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                Two Melbourne locations with the same academic standard
              </h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                Students and families can access Dr. U Education through established
                branch locations in Cranbourne and Glen Waverley.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {branchLocations.map((branch) => (
                <article
                  key={branch.name}
                  className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_22px_60px_rgba(15,23,42,0.05)]"
                >
                  <div className="p-7">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#0088e0]">
                      {branch.name}
                    </p>
                    <h3 className="mt-3 text-2xl font-bold text-slate-950">
                      {branch.address}
                    </h3>
                    <p className="mt-4 text-base leading-7 text-slate-600">
                      {branch.description}
                    </p>
                  </div>
                  <iframe
                    src={branch.mapSrc}
                    title={`${branch.name} Google Map`}
                    className="h-72 w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[28px] bg-[#061b41] px-6 py-12 text-white shadow-[0_28px_80px_rgba(6,27,65,0.18)] md:px-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="max-w-3xl">
                <span className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-200">
                  Start With The Right Support
                </span>
                <h2 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">
                  Join Dr. U Education
                </h2>
                <p className="mt-5 text-lg leading-8 text-slate-200">
                  For students preparing for VCE, selective entry, or stronger school
                  performance, Dr. U Education offers a focused environment with clear
                  expectations and expert academic guidance.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                <Link
                  href="/enroll"
                  className="rounded-full bg-white px-7 py-3 text-center font-semibold text-[#061b41] transition hover:bg-slate-100"
                >
                  Enroll Now
                </Link>
                <Link
                  href="/testimonials"
                  className="rounded-full border border-white/25 px-7 py-3 text-center font-semibold text-white transition hover:bg-white/10"
                >
                  View Testimonials
                </Link>
                <Link
                  href="/courses"
                  className="rounded-full border border-white/25 px-7 py-3 text-center font-semibold text-white transition hover:bg-white/10"
                >
                  Explore Courses
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
