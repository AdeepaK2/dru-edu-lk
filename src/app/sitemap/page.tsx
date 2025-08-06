import { Footer } from "@/components/ui";
import Link from "next/link";

export default function Sitemap() {
  const siteStructure = {
    "Main Pages": [
      { name: "Home", url: "/" },
      { name: "Courses", url: "/courses" },
      { name: "Books & Materials", url: "/books" },
      { name: "Practice Tests", url: "/test-study" },
      { name: "Schedule", url: "/schedule" },
      { name: "Consultation", url: "/consult" },
      { name: "Enrollment", url: "/enroll" }
    ],
    "Portals": [
      { name: "Student Portal", url: "/student" },
      { name: "Teacher Portal", url: "/teacher" },
      { name: "Admin Portal", url: "/admin" }
    ],
    "Legal": [
      { name: "Privacy Policy", url: "/privacy" },
      { name: "Terms of Service", url: "/terms" },
      { name: "Sitemap", url: "/sitemap" }
    ]
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-primary-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Sitemap</h1>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {Object.entries(siteStructure).map(([category, pages]) => (
            <div key={category} className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">
                {category}
              </h2>
              <ul className="space-y-2">
                {pages.map((page) => (
                  <li key={page.url}>
                    <Link 
                      href={page.url}
                      className="text-primary-600 hover:text-primary-700 hover:underline transition-colors duration-200"
                    >
                      {page.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-600">
            Can't find what you're looking for? 
            <a href="mailto:info@drueducation.com" className="text-primary-600 hover:text-primary-700 ml-1">
              Contact us
            </a>
          </p>
        </div>
      </div>
      
      <Footer variant="minimal" />
    </div>
  );
}
