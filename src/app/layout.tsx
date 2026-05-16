import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui";
import { TimezoneProvider } from "@/components/TimezoneProvider";
import { Analytics } from "@vercel/analytics/next"

export const metadata: Metadata = {
  title: {
    default: "Dr. U Education - Premier VCE & Selective School Coaching in Melbourne",
    template: "%s | Dr. U Education"
  },
  description: "Excel in VCE Mathematics, Physics, Chemistry and Selective School entrance exams with Melbourne's premier education centre. Expert coaching with proven results since 2010.",
  keywords: [
    "VCE tuition Melbourne",
    "VCE Math Methods coaching",
    "VCE Specialist Math tutor",
    "Selective school preparation",
    "Melbourne High School coaching",
    "Mac.Robertson Girls coaching",
    "John Monash Science School prep",
    "VCE Physics tutor",
    "VCE Chemistry tutor",
    "Mathematics tutor Melbourne",
    "Dr U Education",
    "Cranbourne tuition",
    "Glen Waverley tuition",
    "VCE coaching Australia",
    "VCE online classes",
    "VCE exam preparation"
  ],
  authors: [{ name: "Dr. Udugama Rakhitha" }],
  creator: "Dr. U Education",
  publisher: "Dr. U Education",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_AU",
    url: "https://drueducation.com.au",
    siteName: "Dr. U Education",
    title: "Dr. U Education - Premier VCE & Selective School Coaching in Melbourne",
    description: "Excel in VCE Mathematics, Physics, Chemistry and Selective School entrance exams with Melbourne's premier education centre. Expert coaching with proven results since 2010.",
    images: [
      {
        url: "https://drueducation.com.au/Logo.png",
        width: 1200,
        height: 630,
        alt: "Dr. U Education - Melbourne's Premier Education Centre",
      },
      {
        url: "https://drueducation.com/Logo.png",
        width: 1200,
        height: 630,
        alt: "Dr. U Education - Melbourne's Premier Education Centre",
      }
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dr. U Education - Premier VCE & Selective School Coaching in Melbourne",
    description: "Excel in VCE Mathematics, Physics, Chemistry and Selective School entrance exams with Melbourne's premier education centre.",
    images: [
      "https://drueducation.com.au/Logo.png",
      "https://drueducation.com/Logo.png"
    ],
    site: "@drueducationau"
  },
  alternates: {
    canonical: "https://drueducation.com.au",
    languages: {
      "en-AU": "https://drueducation.com.au",
      "en": "https://drueducation.com/"
    }
  },
  verification: {
    google: "google-site-verification-code", // Replace with your actual Google Search Console verification code
    other: {
      bing: "bing-site-verification-code", // Replace with Bing verification if needed
      yandex: "yandex-site-verification-code"
    }
  },
  category: "Education",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "name": "Dr. U Education",
    "alternateName": ["Dr U Education Centre", "Dr. U Education Centre"],
    "url": ["https://drueducation.com.au", "https://drueducation.com"],
    "sameAs": [
      "https://drueducation.com.au",
      "https://drueducation.com"
    ],
    "logo": "https://drueducation.com.au/Logo.png",
    "description": "Premier VCE and Selective School coaching centre in Melbourne offering expert tuition in Mathematics, Physics, Chemistry and more.",
    "founder": {
      "@type": "Person",
      "name": "Dr. Udugama Rakhitha"
    },
    "address": [
      {
        "@type": "PostalAddress",
        "streetAddress": "Cranbourne Campus",
        "addressLocality": "Cranbourne",
        "addressRegion": "VIC",
        "addressCountry": "AU"
      },
      {
        "@type": "PostalAddress",
        "streetAddress": "Glen Waverley Campus",
        "addressLocality": "Glen Waverley",
        "addressRegion": "VIC",
        "addressCountry": "AU"
      }
    ],
    "areaServed": {
      "@type": "Place",
      "name": "Melbourne, Victoria, Australia"
    },
    "serviceType": [
      "VCE Mathematics Coaching",
      "VCE Physics Tuition",
      "VCE Chemistry Tuition",
      "Selective School Preparation",
      "Academic Coaching"
    ],
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "reviewCount": "150+"
    },
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "VCE and Academic Courses",
      "itemListElement": [
        {
          "@type": "Course",
          "name": "VCE Mathematics Methods",
          "description": "Comprehensive VCE Mathematics Methods coaching",
          "provider": {
            "@type": "EducationalOrganization",
            "name": "Dr. U Education"
          }
        },
        {
          "@type": "Course",
          "name": "VCE Specialist Mathematics",
          "description": "Expert VCE Specialist Mathematics coaching",
          "provider": {
            "@type": "EducationalOrganization",
            "name": "Dr. U Education"
          }
        },
        {
          "@type": "Course",
          "name": "VCE Physics",
          "description": "Professional VCE Physics tuition",
          "provider": {
            "@type": "EducationalOrganization",
            "name": "Dr. U Education"
          }
        },
        {
          "@type": "Course",
          "name": "VCE Chemistry",
          "description": "Comprehensive VCE Chemistry coaching",
          "provider": {
            "@type": "EducationalOrganization",
            "name": "Dr. U Education"
          }
        }
      ]
    }
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#01143d" />
        <link rel="canonical" href="https://drueducation.com.au" />
        <link rel="alternate" href="https://drueducation.com/" hrefLang="en" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/Logo.png" />
        {/* Social meta tags for both domains */}
        <meta property="og:site_name" content="Dr. U Education" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://drueducation.com.au" />
        <meta property="og:url" content="https://drueducation.com" />
        <meta property="og:image" content="https://drueducation.com.au/Logo.png" />
        <meta property="og:image" content="https://drueducation.com/Logo.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Dr. U Education - Premier VCE & Selective School Coaching in Melbourne" />
        <meta name="twitter:description" content="Excel in VCE Mathematics, Physics, Chemistry and Selective School entrance exams with Melbourne's premier education centre." />
        <meta name="twitter:image" content="https://drueducation.com.au/Logo.png" />
        <meta name="twitter:image" content="https://drueducation.com/Logo.png" />
      </head>
      <body className="antialiased font-sans min-h-screen">
        <TimezoneProvider>
          <ToastProvider>
            {children}
            <Analytics />
          </ToastProvider>
        </TimezoneProvider>
      </body>
    </html>
  );
}
