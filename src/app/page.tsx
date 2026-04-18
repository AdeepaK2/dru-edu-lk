"use client";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Footer, ChatBot } from "@/components/ui";
import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Calculator,
  CircleDollarSign,
  ClipboardList,
  FlaskConical,
  LineChart,
  Mail,
  MapPin,
  Phone,
  Sigma,
  Target,
  Zap,
} from "lucide-react";

type ResultStudent = {
  name: string;
  school: string;
  current: string;
  results: string[];
  highlight?: boolean;
  rank?: string;
};

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": ["EducationalOrganization", "LocalBusiness"],
    name: "Dr. U Education",
    alternateName: "Dr U Education Centre",
    url: "https://drueducation.com.au",
    logo: "https://drueducation.com.au/Logo.png",
    description:
      "Premier VCE and Selective School coaching centre in Melbourne offering expert tuition in Mathematics, Physics, Chemistry and more.",
    founder: {
      "@type": "Person",
      name: "Dr. Udugama Rakhitha",
      jobTitle: "Educational Director",
    },
    address: [
      {
        "@type": "PostalAddress",
        streetAddress: "Cranbourne Campus",
        addressLocality: "Cranbourne",
        addressRegion: "VIC",
        postalCode: "3977",
        addressCountry: "AU",
      },
      {
        "@type": "PostalAddress",
        streetAddress: "Glen Waverley Campus",
        addressLocality: "Glen Waverley",
        addressRegion: "VIC",
        postalCode: "3150",
        addressCountry: "AU",
      },
    ],
    areaServed: {
      "@type": "Place",
      name: "Melbourne, Victoria, Australia",
    },
    serviceType: [
      "VCE Mathematics Coaching",
      "VCE Physics Tuition",
      "VCE Chemistry Tuition",
      "Selective School Preparation",
      "Academic Coaching",
    ],
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      reviewCount: "150",
      bestRating: "5",
      worstRating: "1",
    },
    priceRange: "$$",
    telephone: "+61-3-XXXX-XXXX",
    email: "info@drueducation.com.au",
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "VCE and Selective School Courses",
      itemListElement: [
        {
          "@type": "OfferCatalog",
          name: "VCE Mathematics",
          itemListElement: [
            {
              "@type": "Course",
              name: "VCE Math Methods Units 3&4",
              description:
                "Comprehensive VCE Mathematics Methods coaching for Units 3 and 4",
            },
            {
              "@type": "Course",
              name: "VCE Specialist Math Units 3&4",
              description:
                "Expert VCE Specialist Mathematics coaching for Units 3 and 4",
            },
          ],
        },
        {
          "@type": "OfferCatalog",
          name: "VCE Sciences",
          itemListElement: [
            {
              "@type": "Course",
              name: "VCE Physics Units 3&4",
              description: "Expert VCE Physics coaching for Units 3 and 4",
            },
            {
              "@type": "Course",
              name: "VCE Chemistry Units 3&4",
              description:
                "Comprehensive VCE Chemistry coaching for Units 3 and 4",
            },
          ],
        },
      ],
    },
  };

  const results2024: ResultStudent[] = [
    {
      name: "Rivith",
      school: "Nossal High",
      current: "Monash Engineering",
      results: ["Specialist Math: 53.60", "Math Methods: 50"],
    },
    {
      name: "Puneet",
      school: "John Monash",
      current: "Medicine at Bond University",
      results: [
        "Specialist Math: 51",
        "Math Methods: 46",
        "Chemistry: 46",
        "Physics: 42",
      ],
    },
    {
      name: "Chenumi",
      school: "Nossal",
      current: "Monash Engineering",
      results: ["Specialist Math: 48", "Math Methods: 45"],
    },
    {
      name: "Karthilk",
      school: "Nossal High – School Captain 2024",
      current: "Medicine JCU",
      results: ["Specialist Math: 52", "Math Methods: 49"],
    },
    {
      name: "Sai",
      school: "Nossal High",
      current: "Monash Engineering",
      results: [
        "Specialist Math: 52",
        "Math Methods: 49",
        "Physics: 41",
        "Chemistry: 43",
      ],
    },
    {
      name: "Rochelle",
      school: "Nossal",
      current: "Monash Engineering",
      results: ["Specialist Math: 47", "Math Methods: 45"],
    },
    {
      name: "Declan",
      school: "John Monash",
      current: "Monash Engineering",
      results: ["Specialist Math: 49", "Math Methods: 45"],
    },
    {
      name: "Rehaan",
      school: "Alkira College – DUX 2024",
      current: "Monash Engineering",
      results: ["Specialist Math: 49", "Math Methods: 49", "Chemistry: 42"],
    },
    {
      name: "Akshay",
      school: "Kambrya College",
      current: "Monash Engineering",
      results: ["Specialist Math: 44", "Math Methods: 46"],
    },
    {
      name: "Methuli",
      school: "Mac.Robertson Girls' High School",
      current: "Monash Engineering",
      results: ["Specialist Math: 48.10", "Math Methods: 45.20"],
    },
    {
      name: "Kavithan",
      school: "Glen Waverley",
      current: "Monash Engineering",
      results: ["Specialist Math: 45.20", "Math Methods: 45.10"],
    },
    {
      name: "Revan",
      school: "Glen Waverley Secondary",
      current: "Monash Engineering",
      results: ["Specialist Math: 53.97", "Math Methods: 50", "Physics: 46"],
    },
    {
      name: "SriRaam",
      school: "Nossal High",
      current: "Medicine",
      results: ["Specialist Math: 51", "Math Methods: 46", "Chemistry: 40"],
    },
    {
      name: "Chami",
      school: "Mac.Robertson Girls' High School",
      current: "Monash Medicine",
      results: ["Math Methods: 47.5"],
    },
  ];

  const results2023: ResultStudent[] = [
    {
      name: "Thanuri",
      school: "Nossal High",
      current: "Monash Engineering",
      results: ["Specialist Math: 53.50", "Math Methods: 48.6", "ATAR: 99.75"],
      highlight: true,
    },
    {
      name: "Anupama",
      school: "Nossal High",
      current: "Monash Medicine",
      results: ["Specialist Math: 52.20", "Math Methods: 48.00", "ATAR: 99.7"],
      highlight: true,
    },
    {
      name: "Liyara",
      school: "Mac.Robertson Girls High",
      current: "Monash Engineering",
      results: ["Specialist Math: 49.50", "Math Methods: 48.60", "ATAR: 99.00"],
    },
    {
      name: "Dinithi",
      school: "Haileybury",
      current: "Melbourne Uni Law",
      results: ["Specialist Math: 49.00", "Math Methods: 45.00", "ATAR: 99.2"],
    },
    {
      name: "Amaan",
      school: "Melbourne High",
      current: "UNSW Medicine",
      results: ["Specialist Math: 52.00", "Math Methods: 47.00"],
    },
    {
      name: "Senithya",
      school: "Mac.Robertson Girls' High School",
      current: "Monash Engineering",
      results: ["Specialist Math: 45", "Math Methods: 44"],
    },
    {
      name: "Ishan",
      school: "Nossal High",
      current: "Eng & Commerce, Melbourne Uni",
      results: ["Specialist Math: 50.00", "Math Methods: 45.00"],
    },
    {
      name: "Sanithu",
      school: "Glen Waverley Secondary",
      current: "Monash Engineering",
      results: ["Math Methods: 48.00"],
    },
    {
      name: "Rusira",
      school: "Nossal High",
      current: "Monash Engineering",
      results: ["Math Methods: 47.00", "Physics: 45.00"],
    },
    {
      name: "Sandithma",
      school: "Nossal High",
      current: "Monash Engineering",
      results: ["Specialist Math: 46", "Math Methods: 43"],
    },
    {
      name: "Kisuri",
      school: "Mac.Robertson Girls' High School",
      current: "Medicine Bond Uni",
      results: ["Specialist Math: 45", "Math Methods: 44"],
    },
    {
      name: "Shanon",
      school: "Beaconhills College",
      current: "Engineering & Commerce, Melbourne Uni",
      results: ["Specialist Math: 45", "Math Methods: 44"],
    },
  ];

  const results2022: ResultStudent[] = [
    {
      name: "Anuk Ranathunga",
      school: "Melbourne High",
      current: "Monash Engineering",
      results: ["Specialist Math: 53.69", "Math Methods: 48.14"],
      rank: "1",
    },
    {
      name: "Shashini",
      school: "Nossal High",
      current: "Medicine",
      results: ["Specialist Math: 52.28", "Math Methods: 47.48"],
      rank: "2",
    },
    {
      name: "Dineth",
      school: "Melbourne High",
      current: "Monash Engineering",
      results: ["Specialist Math: 51", "Math Methods: 49"],
      rank: "3",
    },
    {
      name: "Isuru",
      school: "Melbourne High",
      current: "Monash Engineering",
      results: ["Specialist Math: 48.96", "Math Methods: 47.48"],
      rank: "4",
    },
    {
      name: "Shadman",
      school: "Melbourne High",
      current: "Monash Engineering",
      results: ["Specialist Math: 49", "Math Methods: 48"],
      rank: "5",
    },
  ];

  const [show2024, setShow2024] = useState(false);
  const [show2023, setShow2023] = useState(false);
  const [show2022, setShow2022] = useState(false);

  const openCollpase2024 = () => {
    setShow2024((prev) => !prev);
  };

  const openCollpase2023 = () => {
    setShow2023((prev) => !prev);
  };

  const openCollpase2022 = () => {
    setShow2022((prev) => !prev);
  };

  const display2024 = show2024 ? results2024 : results2024.slice(0, 5);
  const display2023 = show2023 ? results2023 : results2023.slice(0, 5);
  const display2022 = show2022 ? results2022 : results2022.slice(0, 5);

  const approachCards = [
    {
      title: "Structured Academic Support",
      subtitle: "Digital study support and homework discipline",
      description:
        "Students receive guided materials, targeted homework, and class support designed to strengthen understanding instead of encouraging passive revision.",
      image: "/images/1.png",
    },
    {
      title: "Regular Testing",
      subtitle: "Progress tracked through consistent assessment",
      description:
        "Frequent online and physical tests help us identify weaknesses early, measure progress properly, and keep students accountable throughout the year.",
      image: "/images/2.png",
    },
    {
      title: "Hybrid Learning Access",
      subtitle: "Video support alongside in-person classes",
      description:
        "Our hybrid model gives students extra flexibility while keeping the structure, standards, and continuity of a serious classroom environment.",
      image: "/images/3.png",
    },
  ];

  const premiumStats = [
    { value: "2010", label: "Proven coaching track record since 2010" },
    { value: "2", label: "Main Melbourne branches in Cranbourne and Glen Waverley" },
    { value: "150+", label: "Reviews and testimonials referenced across the site" },
    { value: "4.9", label: "Aggregate rating reflected in brand metadata" },
  ];

  const subjectCards = [
    {
      name: "VCE Math Methods",
      icon: BarChart3,
      tone: "from-[#123a8c] to-[#2a89e8]",
    },
    {
      name: "VCE Specialist Math",
      icon: Calculator,
      tone: "from-[#1f4f9d] to-[#4ca8ff]",
    },
    {
      name: "VCE Chemistry",
      icon: FlaskConical,
      tone: "from-[#0f6678] to-[#1bb5cb]",
    },
    {
      name: "VCE Physics",
      icon: Zap,
      tone: "from-[#9a6a10] to-[#f0aa2d]",
    },
    {
      name: "VCE Accounting",
      icon: Briefcase,
      tone: "from-[#0e5b4c] to-[#1ca789]",
    },
    {
      name: "VCE General Maths",
      icon: LineChart,
      tone: "from-[#3f4f76] to-[#768ab7]",
    },
    {
      name: "VCE Business Management",
      icon: ClipboardList,
      tone: "from-[#8a4316] to-[#db7c3a]",
    },
    {
      name: "VCE Economics",
      icon: CircleDollarSign,
      tone: "from-[#8d6910] to-[#deb44a]",
    },
    {
      name: "Mathematics (Y6-Y10)",
      icon: Sigma,
      tone: "from-[#374151] to-[#6b7280]",
    },
    {
      name: "Selective School Prep",
      icon: Target,
      tone: "from-[#7d285d] to-[#d56ab2]",
    },
  ];

  const yearlyResults = [
    {
      year: "2024",
      title: "Top results in 2024 VCE",
      description:
        "A cohort filled with strong Mathematics and Science outcomes, including multiple 50+ scaled Specialist Mathematics results and high-performing university pathways.",
      image: "/VCE2024.jpg",
      alt: "VCE 2024 Class Photo",
      students: display2024,
      toggle: openCollpase2024,
      expanded: show2024,
      grid: "md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
    },
    {
      year: "2023",
      title: "Top results in 2023 VCE",
      description:
        "A standout year across leading schools, with exceptional scores in Specialist Mathematics, Methods, and elite ATAR pathways into Engineering, Medicine, and Law.",
      image: "/VCE2023.jpg",
      alt: "VCE 2023 Class Photo",
      students: display2023,
      toggle: openCollpase2023,
      expanded: show2023,
      grid: "md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
    },
    {
      year: "2022",
      title: "Top results in 2022 VCE",
      description:
        "A high-performing cohort led by outstanding Mathematics results and students progressing into competitive university pathways.",
      image: "/VCE2022.jpg",
      alt: "VCE 2022 Class Photo",
      students: display2022,
      toggle: openCollpase2022,
      expanded: show2022,
      grid: "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="min-h-screen bg-[#f4f7fb] text-slate-900">
        <Navbar />
        <main>
          <section className="relative overflow-hidden bg-[radial-gradient(circle_at_15%_15%,_rgba(55,160,255,0.2),_transparent_26%),radial-gradient(circle_at_85%_20%,_rgba(255,255,255,0.08),_transparent_18%),linear-gradient(180deg,#02112f_0%,#081f4b_54%,#0d2c61_100%)] pt-24 pb-24 text-white">
            <div className="absolute inset-0 opacity-20">
              <div
                className="h-full w-full"
                style={{
                  backgroundImage:
                    'url("data:image/svg+xml,%3Csvg width=\'64\' height=\'64\' viewBox=\'0 0 64 64\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.06\'%3E%3Ccircle cx=\'32\' cy=\'32\' r=\'2\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                }}
              />
            </div>

            <div className="relative mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
              <div className="max-w-4xl">
                <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur">
                  Melbourne&apos;s premium VCE and selective coaching environment
                </span>
                <h1 className="mt-6 text-5xl font-black leading-[0.98] tracking-[-0.04em] md:text-7xl">
                  Serious academic coaching for ambitious students
                </h1>
                <p className="mt-6 max-w-3xl text-lg leading-8 text-white/78 md:text-xl">
                  Dr. U Education combines rigorous teaching, close progress
                  monitoring, and disciplined preparation across VCE, selective
                  entry, and school-year learning. We are built for families who
                  want clarity, structure, and outcomes that stand up.
                </p>
                <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                  <Link
                    href="/enroll"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 font-semibold text-[#02112f] transition hover:bg-slate-100"
                  >
                    Enroll Now
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/courses"
                    className="inline-flex items-center justify-center rounded-full border border-white/20 px-8 py-4 font-semibold text-white transition hover:bg-white/10"
                  >
                    Explore Courses
                  </Link>
                </div>
              </div>

              <div className="rounded-[34px] border border-white/12 bg-white/8 p-7 shadow-[0_30px_120px_rgba(1,20,61,0.28)] backdrop-blur-md">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#9edcff]">
                      What Families Choose
                    </p>
                    <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-white">
                      A higher standard than ordinary tutoring
                    </h2>
                  </div>
                  <div className="rounded-full border border-white/12 bg-white/10 px-4 py-2 text-sm font-semibold text-white/80">
                    Since 2010
                  </div>
                </div>

                <div className="mt-8 grid gap-4">
                  <div className="rounded-[24px] border border-white/10 bg-white/6 px-5 py-5">
                    <p className="text-base leading-7 text-white/82">
                      Close student monitoring with regular assessments, ongoing
                      feedback, and a structured preparation rhythm.
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/6 px-5 py-5">
                    <p className="text-base leading-7 text-white/82">
                      Premium subject focus across VCE Mathematics, Sciences,
                      selective entry, and strong foundational learning.
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/6 px-5 py-5">
                    <p className="text-base leading-7 text-white/82">
                      A disciplined academic culture designed for students who
                      want to perform, not just attend extra classes.
                    </p>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-4 border-t border-white/10 pt-6">
                  {premiumStats.slice(0, 4).map((stat) => (
                    <div key={stat.label} className="rounded-[20px] bg-white/5 px-4 py-4">
                      <div className="text-3xl font-black tracking-[-0.03em] text-white">
                        {stat.value}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-white/64">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="-mt-12 relative z-10">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
                <div className="rounded-[34px] bg-white p-8 shadow-[0_28px_100px_rgba(15,23,42,0.08)] md:p-10">
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0088e0]">
                    Our Positioning
                  </p>
                  <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-900 md:text-4xl">
                    Built for students aiming at competitive outcomes
                  </h2>
                  <p className="mt-5 text-lg leading-8 text-slate-600">
                    We support students across VCE, selective school
                    preparation, and school-year academics through a teaching
                    model that values structure, consistency, and serious
                    academic habits. The work is demanding for the right reasons,
                    and families trust that the standards stay high.
                  </p>
                  <div className="mt-8 grid gap-4">
                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-5 py-5 text-base leading-7 text-slate-700">
                      Founded by Dr. Udugama Rakhitha with a long-standing focus
                      on high-performance academic coaching in Melbourne.
                    </div>
                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-5 py-5 text-base leading-7 text-slate-700">
                      Main teaching locations in Cranbourne and Glen Waverley,
                      with support for families across the wider city.
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-3">
                  {approachCards.map((card) => (
                    <div
                      key={card.title}
                      className="overflow-hidden rounded-[30px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.07)]"
                    >
                      <div className="relative h-56">
                        <Image
                          src={card.image}
                          alt={card.title}
                          fill
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                        <div className="absolute bottom-0 p-5 text-white">
                          <h3 className="text-xl font-bold">{card.title}</h3>
                          <p className="mt-1 text-sm text-white/82">{card.subtitle}</p>
                        </div>
                      </div>
                      <div className="p-6">
                        <p className="text-base leading-7 text-slate-600">{card.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="py-24">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mb-12 max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0088e0]">
                  Signature Standards
                </p>
                <h2 className="mt-3 text-4xl font-black tracking-[-0.03em] text-[#02112f] md:text-5xl">
                  Why families take Dr. U Education seriously
                </h2>
                <p className="mt-4 text-lg leading-8 text-slate-600">
                  The centre is built around clear expectations, disciplined
                  preparation, and premium academic support that feels purposeful
                  at every stage.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <div className="rounded-[32px] bg-[#081c43] p-8 text-white shadow-[0_28px_100px_rgba(1,20,61,0.16)]">
                  <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[#7fd0ff]">
                    Expert Guidance
                  </div>
                  <p className="mt-5 text-2xl font-semibold leading-9">
                    Strong subject depth across the subjects that matter most to
                    competitive students.
                  </p>
                </div>
                <div className="rounded-[32px] bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
                  <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0088e0]">
                    Proven Outcomes
                  </div>
                  <p className="mt-5 text-2xl font-semibold leading-9 text-slate-900">
                    A visible track record of strong VCE results, elite pathways,
                    and families returning with confidence.
                  </p>
                </div>
                <div className="rounded-[32px] bg-[linear-gradient(180deg,#eef7ff_0%,#f8fbff_100%)] p-8 shadow-[0_24px_80px_rgba(15,23,42,0.05)]">
                  <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0088e0]">
                    Personal Attention
                  </div>
                  <p className="mt-5 text-2xl font-semibold leading-9 text-slate-900">
                    Close monitoring, regular testing, and real feedback instead
                    of vague promises.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-[linear-gradient(180deg,#071a40_0%,#0a2351_100%)] py-24 text-white">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mb-14 max-w-4xl">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#9edcff]">
                  Results
                </p>
                <h2 className="mt-3 text-4xl font-black tracking-[-0.03em] md:text-5xl">
                  A record of high-performing VCE cohorts
                </h2>
                <p className="mt-4 text-lg leading-8 text-white/74">
                  We keep the results front and centre because families should be
                  able to see the standard for themselves. These student outcomes
                  reflect the level of work, structure, and preparation expected
                  at Dr. U Education.
                </p>
              </div>

              <div className="space-y-16">
                {yearlyResults.map((group) => (
                  <div key={group.year} className="rounded-[36px] border border-white/10 bg-white/6 p-6 backdrop-blur md:p-8">
                    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
                      <div>
                        <div className="inline-flex rounded-full border border-white/12 bg-white/10 px-4 py-2 text-sm font-semibold text-white/85">
                          {group.year} cohort
                        </div>
                        <h3 className="mt-5 text-3xl font-black tracking-[-0.03em]">
                          {group.title}
                        </h3>
                        <p className="mt-4 text-base leading-8 text-white/72">
                          {group.description}
                        </p>
                        <button
                          onClick={group.toggle}
                          className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-[#02112f] transition hover:bg-slate-100"
                        >
                          {group.expanded ? "Hide Details" : "Show All Results"}
                        </button>
                      </div>

                      <div className="overflow-hidden rounded-[28px] border border-white/12">
                        <img
                          src={group.image}
                          alt={group.alt}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </div>

                    <div className={`mt-8 grid gap-4 ${group.grid}`}>
                      {group.students.map((student, index) => (
                        <div
                          key={`${group.year}-${index}`}
                          className={`relative rounded-[24px] border p-5 ${
                            group.year === "2022"
                              ? "border-[#2b8eed]/40 bg-gradient-to-br from-[#0f2d63] to-[#0c2149]"
                              : student.highlight
                                ? "border-[#55b3ff]/40 bg-gradient-to-br from-[#103467] to-[#0c2349]"
                                : "border-white/10 bg-[#0c2149]"
                          }`}
                        >
                          {"rank" in student && student.rank ? (
                            <div className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#2b8eed] text-xs font-bold text-white">
                              {student.rank}
                            </div>
                          ) : null}
                          <h4 className="pr-10 text-base font-bold text-white">
                            {student.name}
                          </h4>
                          <p className="mt-2 text-sm text-white/62">{student.school}</p>
                          <p className="mt-1 text-sm font-semibold text-[#7fd0ff]">
                            {student.current}
                          </p>
                          <div className="mt-4 space-y-2">
                            {student.results.map((result, idx) => (
                              <div
                                key={idx}
                                className={`rounded-full px-3 py-2 text-xs ${
                                  result.includes("ATAR")
                                    ? "bg-[#2b8eed]/20 font-semibold text-white"
                                    : "bg-white/7 text-white/78"
                                }`}
                              >
                                {result}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="subjects" className="py-24">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mb-12 max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0088e0]">
                  Our Subjects
                </p>
                <h2 className="mt-3 text-4xl font-black tracking-[-0.03em] text-[#02112f] md:text-5xl">
                  A focused subject portfolio built around demand and outcomes
                </h2>
                <p className="mt-4 text-lg leading-8 text-slate-600">
                  We focus on the subjects and pathways where serious coaching can
                  make a measurable difference.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                {subjectCards.map((subject) => (
                  <div
                    key={subject.name}
                    className="rounded-[30px] border border-slate-200/80 bg-white p-8 shadow-[0_20px_70px_rgba(15,23,42,0.05)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_90px_rgba(15,23,42,0.08)]"
                  >
                    <div
                      className={`mb-6 inline-flex h-16 w-16 items-center justify-center rounded-[18px] bg-gradient-to-br ${subject.tone} shadow-lg`}
                    >
                      <subject.icon className="h-8 w-8 text-white" strokeWidth={2.1} />
                    </div>
                    <h3 className="text-lg font-bold leading-7 text-[#02112f]">
                      {subject.name}
                    </h3>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="contact" className="pb-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="overflow-hidden rounded-[40px] bg-[radial-gradient(circle_at_10%_20%,_rgba(255,255,255,0.12),_transparent_20%),linear-gradient(135deg,#02112f_0%,#0d2f68_56%,#0088e0_100%)] px-8 py-12 text-white shadow-[0_34px_120px_rgba(1,20,61,0.18)] md:px-12">
                <div className="grid gap-10 lg:grid-cols-[1.02fr_0.98fr]">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#bde7ff]">
                      Take The Next Step
                    </p>
                    <h2 className="mt-3 text-4xl font-black tracking-[-0.03em] md:text-5xl">
                      Ready to aim higher?
                    </h2>
                    <p className="mt-5 max-w-2xl text-lg leading-8 text-white/82">
                      Join a learning environment designed for students who want
                      serious academic growth and families who value strong
                      guidance, structure, and visible outcomes.
                    </p>
                    <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                      <Link
                        href="/enroll"
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 font-semibold text-[#02112f] transition hover:bg-slate-100"
                      >
                        Enroll Now
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                      <a
                        href="tel:+61478716402"
                        className="inline-flex items-center justify-center rounded-full border border-white/20 px-8 py-4 font-semibold text-white transition hover:bg-white/10"
                      >
                        Call Us Today
                      </a>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <a
                      href="https://maps.google.com/?q=63A+High+Street+Cranbourne"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-[26px] border border-white/10 bg-white/7 px-6 py-6 backdrop-blur transition hover:bg-white/10"
                    >
                      <div className="flex items-start gap-4">
                        <MapPin className="mt-1 h-5 w-5 text-[#9edcff]" />
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/58">
                            Branches
                          </p>
                          <p className="mt-2 text-lg font-semibold text-white">
                            Cranbourne and Glen Waverley
                          </p>
                          <p className="mt-1 text-sm leading-6 text-white/68">
                            Serving Melbourne families with focused in-person
                            academic coaching.
                          </p>
                        </div>
                      </div>
                    </a>
                    <a
                      href="tel:+61478716402"
                      className="rounded-[26px] border border-white/10 bg-white/7 px-6 py-6 backdrop-blur transition hover:bg-white/10"
                    >
                      <div className="flex items-start gap-4">
                        <Phone className="mt-1 h-5 w-5 text-[#9edcff]" />
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/58">
                            Phone
                          </p>
                          <p className="mt-2 text-lg font-semibold text-white">
                            0478 716 402
                          </p>
                        </div>
                      </div>
                    </a>
                    <a
                      href="mailto:info@drueducation.com.au"
                      className="rounded-[26px] border border-white/10 bg-white/7 px-6 py-6 backdrop-blur transition hover:bg-white/10"
                    >
                      <div className="flex items-start gap-4">
                        <Mail className="mt-1 h-5 w-5 text-[#9edcff]" />
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/58">
                            Email
                          </p>
                          <p className="mt-2 text-lg font-semibold text-white">
                            info@drueducation.com.au
                          </p>
                        </div>
                      </div>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>

        <Footer />
        <ChatBot />
      </div>
    </>
  );
}
