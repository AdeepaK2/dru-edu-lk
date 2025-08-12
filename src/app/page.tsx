"use client";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Footer, ChatBot } from "@/components/ui";
import { useState } from "react";

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

  const results2024 = [
    {
      name: "Rivith",
      school: "Nossal High",
      current: "Monash Engineering",
      results: ["Specialist Math: 53.60", "Math Methods: 50"],
    },
    {
      name: "Puneet",
      school: "John Monash",
      current: "Monash Engineering",
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

  const results2023 = [
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

  const results2022 = [
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="min-h-screen bg-gradient-to-br from-[#01143d] via-[#0a2147] to-[#0088e0] relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-30">
          <div
            className="w-full h-full"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          ></div>
        </div>

        {/* Navigation */}
        <Navbar />

        {/* Hero Section */}
        <section className="relative pt-2 pb-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto text-center relative z-10">
            <div className="mb-4 animate-fadeInUp">
              <span className="inline-block bg-white/20 backdrop-blur-sm text-white px-6 py-2 rounded-full text-sm font-medium border border-white/30 animate-pulse">
                🏆 Melbourne's Premier Education Centre
              </span>
            </div>
            <h1 className="text-6xl md:text-8xl font-extrabold text-white mb-8 leading-tight animate-fadeInUp delay-200">
              Master Your
              <span className="block bg-gradient-to-r from-[#0088e0] to-[#00b4d8] bg-clip-text text-transparent animate-slideInFromLeft delay-400">
                VCE Journey
              </span>
            </h1>
            <p className="text-lg md:text-xl text-white/90 mb-12 max-w-4xl mx-auto leading-relaxed font-light animate-fadeInUp delay-600">
              Experience personalized learning with close student monitoring,
              frequent assessments, and expert guidance. We track your progress
              through regular practice tests and provide tailored support -
              proven by past results to ensure your VCE success!
            </p>
            <div className="flex justify-center animate-fadeInUp delay-800">
              <Link
                href="/enroll"
                className="group bg-gradient-to-r from-[#0088e0] to-[#00b4d8] hover:from-[#0066b3] hover:to-[#0088e0] text-white font-semibold py-4 px-10 rounded-full transition-all duration-300 transform hover:scale-105 shadow-2xl hover:shadow-[#0088e0]/25"
              >
                <span className="flex items-center space-x-2">
                  <span>Enroll Now</span>
                  <svg
                    className="w-5 h-5 transition-transform group-hover:translate-x-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </svg>
                </span>
              </Link>
            </div>
          </div>

          {/* Floating elements */}
          <div className="absolute top-20 left-10 w-20 h-20 bg-white/10 rounded-full blur-xl animate-pulse"></div>
          <div className="absolute bottom-32 right-16 w-32 h-32 bg-[#0088e0]/20 rounded-full blur-2xl animate-bounce"></div>
          <div className="absolute top-1/2 right-8 w-16 h-16 bg-white/5 rounded-full blur-lg animate-pulse delay-300"></div>
        </section>

        {/* Our Learning Approach Section */}
        <section className="py-24 bg-gradient-to-br from-gray-50 to-white relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-20">
              <div className="inline-block bg-gradient-to-r from-[#01143d] to-[#0088e0] bg-clip-text text-transparent text-sm font-semibold uppercase tracking-wider mb-4">
                Our Approach
              </div>
              <h2 className="text-5xl font-bold text-[#01143d] mb-6">
                How We Support Your Success
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                Our comprehensive learning methodology ensures every student
                receives the support they need
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-12">
              {/* Study Materials & Homework Support */}
              <div className="group text-center">
                <div className="relative mb-8 overflow-hidden rounded-2xl shadow-2xl transform transition-all duration-300 hover:scale-105">
                  <Image
                    src="/images/1.png"
                    alt="Digital Study Support Materials"
                    width={400}
                    height={300}
                    className="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <h3 className="text-2xl font-bold mb-2">
                      Digital Study Support
                    </h3>
                    <p className="text-sm opacity-90">
                      Comprehensive materials and homework guidance
                    </p>
                  </div>
                </div>
                <div className="text-left">
                  <h4 className="text-xl font-semibold text-[#01143d] mb-3">
                    Study Materials & Homework
                  </h4>
                  <p className="text-gray-600 leading-relaxed">
                    We provide digitally delivered study support materials and
                    comprehensive homework assistance. In our classes, we push
                    students to learn through interactive sessions and
                    personalized guidance to ensure deep understanding of
                    concepts.
                  </p>
                </div>
              </div>

              {/* Regular Testing & Progress Monitoring */}
              <div className="group text-center">
                <div className="relative mb-8 overflow-hidden rounded-2xl shadow-2xl transform transition-all duration-300 hover:scale-105">
                  <Image
                    src="/images/2.png"
                    alt="Online Tests and Progress Monitoring"
                    width={400}
                    height={300}
                    className="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <h3 className="text-2xl font-bold mb-2">
                      Progress Monitoring
                    </h3>
                    <p className="text-sm opacity-90">
                      Regular assessments to track improvement
                    </p>
                  </div>
                </div>
                <div className="text-left">
                  <h4 className="text-xl font-semibold text-[#01143d] mb-3">
                    Regular Testing & Assessment
                  </h4>
                  <p className="text-gray-600 leading-relaxed">
                    We conduct online tests regularly to measure progress and
                    identify areas for improvement. Combined with physical
                    tests, our comprehensive assessment system ensures students
                    are always on track to achieve their academic goals.
                  </p>
                </div>
              </div>

              {/* Video Classes & Additional Support */}
              <div className="group text-center">
                <div className="relative mb-8 overflow-hidden rounded-2xl shadow-2xl transform transition-all duration-300 hover:scale-105">
                  <Image
                    src="/images/3.png"
                    alt="Video Classes and Online Support"
                    width={400}
                    height={300}
                    className="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <h3 className="text-2xl font-bold mb-2">Video Learning</h3>
                    <p className="text-sm opacity-90">
                      Flexible online and physical classes
                    </p>
                  </div>
                </div>
                <div className="text-left">
                  <h4 className="text-xl font-semibold text-[#01143d] mb-3">
                    Video Classes & Hybrid Learning
                  </h4>
                  <p className="text-gray-600 leading-relaxed">
                    Our video classes provide additional support alongside
                    traditional physical classes. This hybrid approach ensures
                    students have flexible access to quality education, allowing
                    them to learn at their own pace while maintaining structured
                    classroom interaction.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="about" className="py-24 bg-white relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-20">
              <div className="inline-block bg-gradient-to-r from-[#01143d] to-[#0088e0] bg-clip-text text-transparent text-sm font-semibold uppercase tracking-wider mb-4">
                Why Choose Us
              </div>
              <h2 className="text-5xl font-bold text-[#01143d] mb-6">
                Why Choose Dr. U Education?
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                We provide comprehensive coaching with a proven track record of
                student success
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="group text-center p-8 rounded-2xl border border-gray-100 hover:border-[#0088e0]/30 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 bg-gradient-to-br from-white to-gray-50/50">
                <div className="w-20 h-20 bg-gradient-to-br from-[#0088e0] to-[#00b4d8] rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <svg
                    className="w-10 h-10 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C20.832 18.477 19.246 18 17.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-[#01143d] mb-4 group-hover:text-[#0088e0] transition-colors">
                  Expert Teachers
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Qualified educators with years of teaching experience and deep
                  subject knowledge
                </p>
              </div>

              <div className="group text-center p-8 rounded-2xl border border-gray-100 hover:border-[#0088e0]/30 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 bg-gradient-to-br from-white to-gray-50/50">
                <div className="w-20 h-20 bg-gradient-to-br from-[#0088e0] to-[#00b4d8] rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <svg
                    className="w-10 h-10 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-[#01143d] mb-4 group-hover:text-[#0088e0] transition-colors">
                  Proven Results
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Track record of high ATAR scores and successful university
                  placements
                </p>
              </div>

              <div className="group text-center p-8 rounded-2xl border border-gray-100 hover:border-[#0088e0]/30 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 bg-gradient-to-br from-white to-gray-50/50">
                <div className="w-20 h-20 bg-gradient-to-br from-[#0088e0] to-[#00b4d8] rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <svg
                    className="w-10 h-10 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-[#01143d] mb-4 group-hover:text-[#0088e0] transition-colors">
                  Personalized Learning
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Tailored approach to meet each student's unique learning style
                  and needs
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* VCE Results Section */}
        <section className="py-24 bg-gradient-to-br from-[#01143d] to-[#0a2147] relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-20">
              <div className="inline-block bg-white/20 backdrop-blur-sm text-white px-6 py-2 rounded-full text-sm font-medium border border-white/30 mb-4">
                🏆 Outstanding Results
              </div>
              <h2 className="text-5xl font-bold text-white mb-6">
                TOP RESULTS IN 2024 VCE
              </h2>
              <p className="text-xl text-white/90 max-w-4xl mx-auto leading-relaxed">
                Kudos to our outstanding achievers! Your remarkable
                accomplishments have filled us with immense pride. Your
                dedication, hard work, and pursuit of excellence have set a
                shining example of success. Wishing you continued achievements
                and countless rewarding experiences in the journey ahead.
              </p>
            </div>

            {/* 2024 Class Photo */}
            <div className="text-center mb-12">
              <div className="relative inline-block">
                <img
                  src="/VCE2024.jpg"
                  alt="VCE 2024 Class Photo"
                  className="rounded-2xl shadow-2xl max-w-4xl w-full mx-auto border-4 border-white/20"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent rounded-2xl"></div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-16">
              {display2024.map((student, index) => (
                <div
                  key={index}
                  className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20 hover:bg-white/15 transition-all duration-300 transform hover:-translate-y-1"
                >
                  <div className="mb-3">
                    <h3 className="text-sm font-bold text-white mb-1">
                      {student.name}
                    </h3>
                    <p className="text-white/70 text-xs mb-1">
                      {student.school}
                    </p>
                    <p className="text-[#0088e0] font-semibold text-xs">
                      {student.current}
                    </p>
                  </div>
                  <div className="space-y-1">
                    {student.results.map((result, idx) => (
                      <div
                        key={idx}
                        className="text-white/80 text-xs bg-white/10 px-2 py-1 rounded"
                      >
                        {result}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center mt-6 mb-10">
              <button
              onClick={openCollpase2024}
              className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-gradient-to-r from-[#0088e0] to-[#00b4d8] text-white font-semibold shadow-lg hover:from-[#0066b3] hover:to-[#0088e0] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#0088e0] focus:ring-offset-2"
              >
              {show2024 ? "Hide Details" : "Show All"}
              </button>
            </div>

            {/* 2023 Results */}
            <div className="text-center mb-16">
              <h3 className="text-4xl font-bold text-white mb-6">
                TOP RESULTS IN 2023 VCE
              </h3>
              <p className="text-lg text-white/90 max-w-4xl mx-auto leading-relaxed mb-12">
                Congratulations to our stellar performers! Your incredible
                achievements have filled us with pride. Your unwavering
                dedication, tireless efforts, and commitment to excellence have
                paved the way for remarkable success.
              </p>
            </div>

            {/* 2023 Class Photo */}
            <div className="text-center mb-12">
              <div className="relative inline-block">
                <img
                  src="/VCE2023.jpg"
                  alt="VCE 2023 Class Photo"
                  className="rounded-2xl shadow-2xl max-w-4xl w-full mx-auto border-4 border-white/20"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent rounded-2xl"></div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-16">
              {display2023.map((student, index) => (
                <div
                  key={index}
                  className={`bg-white/10 backdrop-blur-sm p-4 rounded-xl border ${
                    student.highlight
                      ? "border-[#0088e0] bg-gradient-to-br from-[#0088e0]/20 to-white/10"
                      : "border-white/20"
                  } hover:bg-white/15 transition-all duration-300 transform hover:-translate-y-1`}
                >
                  <div className="mb-3">
                    <h3 className="text-sm font-bold text-white mb-1">
                      {student.name}
                    </h3>
                    <p className="text-white/70 text-xs mb-1">
                      {student.school}
                    </p>
                    <p className="text-[#0088e0] font-semibold text-xs">
                      {student.current}
                    </p>
                  </div>
                  <div className="space-y-1">
                    {student.results.map((result, idx) => (
                      <div
                        key={idx}
                        className={`text-white/80 text-xs px-2 py-1 rounded ${
                          result.includes("ATAR")
                            ? "bg-[#0088e0]/30 font-semibold"
                            : "bg-white/10"
                        }`}
                      >
                        {result}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center mt-6 mb-10">
              <button
              onClick={openCollpase2023}
              className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-gradient-to-r from-[#0088e0] to-[#00b4d8] text-white font-semibold shadow-lg hover:from-[#0066b3] hover:to-[#0088e0] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#0088e0] focus:ring-offset-2"
              >
              {show2023 ? "Hide Details" : "Show All"}
              </button>
            </div>


            {/* 2022 Results */}
            <div className="text-center mb-16">
              <h3 className="text-4xl font-bold text-white mb-6">
                TOP 5 RESULTS IN 2022 VCE
              </h3>
              <p className="text-lg text-white/90 max-w-4xl mx-auto leading-relaxed mb-12">
                To all our outstanding achievers, you have made us proud with
                your remarkable accomplishments. Your dedication, hard work, and
                commitment to excellence have set you on a path to great
                success.
              </p>
            </div>

            {/* 2022 Class Photo */}
            <div className="text-center mb-12">
              <div className="relative inline-block">
                <img
                  src="/VCE2022.jpg"
                  alt="VCE 2022 Class Photo"
                  className="rounded-2xl shadow-2xl max-w-4xl w-full mx-auto border-4 border-white/20"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent rounded-2xl"></div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {display2022.map((student, index) => (
                <div
                  key={index}
                  className="relative bg-gradient-to-br from-[#0088e0]/20 to-white/10 backdrop-blur-sm p-4 rounded-xl border border-[#0088e0]/50 hover:from-[#0088e0]/30 hover:to-white/15 transition-all duration-300 transform hover:-translate-y-1"
                >
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-[#0088e0] to-[#00b4d8] rounded-full flex items-center justify-center text-white font-bold text-xs shadow-lg">
                    {student.rank}
                  </div>
                  <div className="mb-3">
                    <h3 className="text-sm font-bold text-white mb-1">
                      {student.name}
                    </h3>
                    <p className="text-white/70 text-xs mb-1">
                      {student.school}
                    </p>
                    <p className="text-[#0088e0] font-semibold text-xs">
                      {student.current}
                    </p>
                  </div>
                  <div className="space-y-1">
                    {student.results.map((result, idx) => (
                      <div
                        key={idx}
                        className="text-white/80 text-xs bg-white/10 px-2 py-1 rounded"
                      >
                        {result}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Subjects Section */}
        <section
          id="subjects"
          className="py-24 bg-gradient-to-br from-gray-50 to-gray-100 relative"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-20">
              <div className="inline-block bg-gradient-to-r from-[#01143d] to-[#0088e0] bg-clip-text text-transparent text-sm font-semibold uppercase tracking-wider mb-4">
                Our Subjects
              </div>
              <h2 className="text-5xl font-bold text-[#01143d] mb-6">
                Subjects We Offer
              </h2>
              <p className="text-xl text-gray-600 leading-relaxed">
                Comprehensive coaching across VCE subjects and selective school
                preparation
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {[
                {
                  name: "VCE Math Methods",
                  icon: "📊",
                  color: "from-blue-500 to-cyan-500",
                },
                {
                  name: "VCE Specialist Math",
                  icon: "🔢",
                  color: "from-purple-500 to-pink-500",
                },
                {
                  name: "VCE Chemistry",
                  icon: "🧪",
                  color: "from-green-500 to-teal-500",
                },
                {
                  name: "VCE Physics",
                  icon: "⚡",
                  color: "from-yellow-500 to-orange-500",
                },
                {
                  name: "VCE Accounting",
                  icon: "💼",
                  color: "from-emerald-500 to-cyan-500",
                },
                {
                  name: "VCE General Maths",
                  icon: "📈",
                  color: "from-indigo-500 to-blue-500",
                },
                {
                  name: "VCE Business Management",
                  icon: "📋",
                  color: "from-orange-500 to-red-500",
                },
                {
                  name: "VCE Economics",
                  icon: "💰",
                  color: "from-amber-500 to-yellow-500",
                },
                {
                  name: "Mathematics (Y6-Y10)",
                  icon: "🔢",
                  color: "from-slate-500 to-gray-600",
                },
                {
                  name: "Selective School Prep",
                  icon: "🎯",
                  color: "from-rose-500 to-pink-500",
                },
              ].map((subject, index) => (
                <div
                  key={index}
                  className="group bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 hover:border-[#0088e0]/30"
                >
                  <div
                    className={`w-16 h-16 bg-gradient-to-br ${subject.color} rounded-xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}
                  >
                    <span className="text-3xl">{subject.icon}</span>
                  </div>
                  <h3 className="text-lg font-bold text-[#01143d] text-center group-hover:text-[#0088e0] transition-colors">
                    {subject.name}
                  </h3>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="py-16 bg-[#01143d]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-4xl font-bold text-white mb-4">
              Ready to Excel in VCE?
            </h2>
            <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto">
              Join thousands of successful students who have achieved their
              dreams with Dr. U Education
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Link
                href="/enroll"
                className="bg-[#0088e0] hover:bg-[#0066b3] text-white font-semibold py-4 px-8 rounded-full transition-all duration-300 transform hover:scale-105 relative z-20 cursor-pointer"
              >
                Enroll Now
              </Link>
              <a
                href="tel:+61478716402"
                className="border-2 border-white hover:bg-white hover:text-[#01143d] text-white font-semibold py-4 px-8 rounded-full transition-all duration-300 relative z-20 cursor-pointer"
              >
                Call Us Today
              </a>
            </div>

            <div className="grid md:grid-cols-3 gap-8 text-white">
              <div>
                <h3 className="text-lg font-semibold mb-2">Location</h3>
                <a
                  href="https://maps.google.com/?q=Dr+U+Education+Melbourne+Victoria"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/80 hover:text-white transition-colors duration-200 relative z-20 cursor-pointer inline-block"
                >
                  Melbourne, Victoria
                </a>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Phone</h3>
                <a
                  href="tel:+61478716402"
                  className="text-white/80 hover:text-white transition-colors duration-200 relative z-20 cursor-pointer inline-block"
                >
                  0478 716 402
                </a>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Email</h3>
                <a
                  href="mailto:info@drueducation.com.au"
                  className="text-white/80 hover:text-white transition-colors duration-200 relative z-20 cursor-pointer inline-block"
                >
                  info@drueducation.com.au
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="relative z-10">
          <Footer />
        </div>

        {/* AI Chat Bot */}
        <ChatBot />
      </div>
    </>
  );
}
