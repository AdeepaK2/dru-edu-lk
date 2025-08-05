import Navbar from "@/components/Navbar";
import Link from "next/link";
import Image from "next/image";

export default function CoursesPage() {
  const courseCategories = [
    {
      title: "VCE Mathematics",
      image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=300&fit=crop&crop=center",
      courses: [
        { 
          name: "Math Methods - [VCE 2024]", 
          schedule: "SUNDAY 7:45PM – 11:45PM",
          location: "GLEN WAVERLEY",
          year: "VCE 2024",
          href: "/enroll" 
        },
        { 
          name: "Specialist Math - [VCE 2024]", 
          schedule: "Friday 8:00PM – 11:30PM",
          location: "GLEN WAVERLEY",
          year: "VCE 2024",
          href: "/enroll" 
        },
        { 
          name: "Math Methods – [VCE 2025]", 
          schedule: "SUNDAY 6:15pm - 7:45pm",
          location: "GLEN WAVERLEY",
          year: "VCE 2025",
          href: "/enroll" 
        },
        { 
          name: "Math Methods - [VCE 2024]", 
          schedule: "Sunday 7:00am – 11:00aM",
          location: "DR. U EDUCATION CENTRE - Cranbourne",
          year: "VCE 2024",
          href: "/enroll" 
        },
        { 
          name: "Specialist Math – [VCE 2024]", 
          schedule: "Saturday 7:00am - 11:00am",
          location: "DR. U EDUCATION CENTRE - Cranbourne",
          year: "VCE 2024",
          href: "/enroll" 
        },
        { 
          name: "Specialist Math – [VCE 2025]", 
          schedule: "SATURDAY 2:00PM – 4:00PM",
          location: "DR. U EDUCATION CENTRE - Cranbourne",
          year: "VCE 2025",
          href: "/enroll" 
        },
        { 
          name: "Math Methods – [VCE 2025]", 
          schedule: "Monday 7:30PM – 9:30PM",
          location: "DR. U EDUCATION CENTRE - Cranbourne",
          year: "VCE 2025",
          href: "/enroll" 
        },
        { 
          name: "Math Methods – [VCE 2025]", 
          schedule: "Monday 7:30PM – 9:30PM",
          location: "Niddrie (northern Suburbs)",
          year: "VCE 2025",
          href: "/enroll" 
        },
      ]
    },
    {
      title: "VCE Sciences",
      image: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=400&h=300&fit=crop&crop=center",
      courses: [
        { 
          name: "Physics - [VCE 2024]", 
          schedule: "THURDAY 8:30pm - 10:30pm",
          location: "GLEN WAVERLEY",
          year: "VCE 2024",
          href: "/enroll" 
        },
        { 
          name: "Chemistry - [VCE 2025]", 
          schedule: "SATURDAY 4:45PM – 6:15PM",
          location: "GLEN WAVERLEY",
          year: "VCE 2025",
          href: "/enroll" 
        },
        { 
          name: "Physics - [VCE 2025]", 
          schedule: "Thursday 5:00PM – 6:30PM",
          location: "DR. U EDUCATION CENTRE - Cranbourne",
          year: "VCE 2025",
          href: "/enroll" 
        },
        { 
          name: "Chemistry - [VCE 2024]", 
          schedule: "sunday 2:00PM – 4:00PM",
          location: "DR. U EDUCATION CENTRE - CRANBOURNE",
          year: "VCE 2024",
          href: "/enroll" 
        },
        { 
          name: "Physics - [VCE 2024]", 
          schedule: "Saturday 11:00AM-12:30PM",
          location: "DR. U EDUCATION CENTRE - CRANBOURNE",
          year: "VCE 2024",
          href: "/enroll" 
        },
        { 
          name: "Chemistry - [VCE 2025]", 
          schedule: "SATURDAY 12:30PM – 2:00PM",
          location: "DR. U EDUCATION CENTRE - CRANBOURNE",
          year: "VCE 2025",
          href: "/enroll" 
        },
      ]
    },
    {
      title: "Selective School Coaching",
      image: "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=400&h=300&fit=crop&crop=center",
      courses: [
        { 
          name: "SELECTIVE SCHOOL PREPARATION 2023 [GRADE 8]", 
          schedule: "MONDAY 6:00PM – 8:00PM",
          location: "DR. U EDUCATION CENTRE - Cranbourne",
          year: "2023",
          href: "/enroll" 
        },
        { 
          name: "SELECTIVE SCHOOL PREPARATION 2024 [GRADE 7]", 
          schedule: "SUNDAY 11.30AM-1.00PM",
          location: "DR. U EDUCATION CENTRE - CRANBOURNE",
          year: "2024",
          href: "/enroll" 
        },
      ]
    },
    {
      title: "Foundation Mathematics (Years 5-9)",
      image: "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=400&h=300&fit=crop&crop=center",
      courses: [
        { 
          name: "Y 9 Math - [Accelerated]", 
          schedule: "Friday 4:45pm - 6:30Pm",
          location: "GLEN WAVERLEY",
          year: "Year 9",
          href: "/enroll" 
        },
        { 
          name: "Y 7 Math – [Accelerated]", 
          schedule: "Tuesday 5:30PM – 7:00PM",
          location: "Glen Waverly",
          year: "Year 7",
          href: "/enroll" 
        },
        { 
          name: "Y 6 Math - [Accelerated]", 
          schedule: "TUESDAY 7:00PM – 8:30PM",
          location: "GLEN WAVERLEY",
          year: "Year 6",
          href: "/enroll" 
        },
      ]
    },
    {
      title: "Business & Economics & Accounting",
      image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=300&fit=crop&crop=center",
      courses: [
        { 
          name: "Accounting - [VCE 2025]", 
          schedule: "Monday 5:30pm - 7:00Pm",
          location: "GLEN WAVERLEY",
          year: "VCE 2025",
          href: "/enroll" 
        },
        { 
          name: "Business Managment – [VCE 2025]", 
          schedule: "Tuesday 5:30PM – 7:00PM",
          location: "Glen Waverly",
          year: "VCE 2025",
          href: "/enroll" 
        },
        { 
          name: "Economics - [VCE 2025]", 
          schedule: "monDAY 7:00PM – 8:30PM",
          location: "GLEN WAVERLEY",
          year: "VCE 2025",
          href: "/enroll" 
        },
      ]
    },
    {
      title: "English",
      image: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=300&fit=crop&crop=center",
      courses: [
        { 
          name: "Y 6 - [ENGLISH]", 
          schedule: "Monday 5:30pm - 7:00Pm",
          location: "DR. U EDUCATION CENTRE - Cranbourne",
          year: "Year 6",
          href: "/enroll" 
        },
        { 
          name: "Y 7 - [ENGLISH]", 
          schedule: "FRIDAY 5:30PM – 7:00PM",
          location: "DR. U EDUCATION CENTRE - Cranbourne",
          year: "Year 7",
          href: "/enroll" 
        },
        { 
          name: "Y 5 - [ENGLISH]", 
          schedule: "SATURDAY 9:00AM – 10:00PM",
          location: "NIDDRIE (NORTHERN SUBURBS)",
          year: "Year 5",
          href: "/enroll" 
        },
        { 
          name: "Y 7 - [ENGLISH]", 
          schedule: "tHURSDAY 6:30Pm – 8:00Pm",
          location: "gLEN WAVERLY",
          year: "Year 7",
          href: "/enroll" 
        },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#01143d] via-[#0a2147] to-[#0088e0] relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-20">
        <div className="w-full h-full" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
      </div>

      <Navbar />

      {/* Hero Section */}
      <header className="relative py-20 px-4 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <span className="inline-block bg-white/20 backdrop-blur-sm text-white px-6 py-2 rounded-full text-sm font-medium border border-white/30">
              🎓 Comprehensive Education Programs
            </span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-6 leading-tight">
            Our <span className="bg-gradient-to-r from-[#0088e0] to-[#00b4d8] bg-clip-text text-transparent">Courses</span>
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto leading-relaxed">
            Discover our comprehensive range of VCE and foundation programs with specific schedules and locations across Melbourne.
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative bg-gradient-to-b from-white to-gray-50 rounded-t-3xl pt-16 pb-24 -mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Course Categories */}
          <div className="space-y-16">
            {courseCategories.map((category, categoryIndex) => (
              <div key={categoryIndex} className="opacity-0 animate-[fadeInUp_0.8s_ease-out_forwards]" style={{ animationDelay: `${categoryIndex * 200}ms` }}>
                <div className="text-center mb-12">
                  <div className="flex justify-center mb-6">
                    <div className="relative w-20 h-20 rounded-full overflow-hidden shadow-lg">
                      <Image 
                        src={category.image} 
                        alt={category.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-[#01143d] mb-4">{category.title}</h2>
                  <div className="w-24 h-1 bg-gradient-to-r from-[#0088e0] to-[#00b4d8] mx-auto rounded-full"></div>
                </div>
                
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {category.courses.map((course, courseIndex) => (
                    <div
                      key={courseIndex}
                      className="group bg-white p-6 rounded-2xl border border-gray-100 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 relative overflow-hidden"
                    >
                      {/* Gradient overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-br from-[#0088e0]/5 to-[#00b4d8]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"></div>
                      
                      <div className="relative z-10">
                        {/* Course Header */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="text-right">
                            <span className="text-xs font-semibold text-[#0088e0] bg-blue-50 px-3 py-1 rounded-full">
                              {course.year}
                            </span>
                          </div>
                        </div>

                        {/* Course Info */}
                        <h3 className="text-lg font-bold text-[#01143d] mb-3 group-hover:text-[#0088e0] transition-colors duration-300">
                          {course.name}
                        </h3>
                        
                        {/* Schedule */}
                        <div className="flex items-center mb-3 text-sm text-gray-600">
                          <svg className="w-4 h-4 mr-2 text-[#0088e0] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-medium">{course.schedule}</span>
                        </div>

                        {/* Location */}
                        <div className="flex items-center mb-6 text-sm text-gray-600">
                          <svg className="w-4 h-4 mr-2 text-[#0088e0] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="font-medium">{course.location}</span>
                        </div>

                        {/* Action Button */}
                        <Link
                          href={course.href}
                          className="block w-full bg-gradient-to-r from-[#0088e0] to-[#00b4d8] hover:from-[#0066b3] hover:to-[#0088e0] text-white font-semibold py-3 px-6 rounded-xl text-center transition-all duration-300 transform group-hover:scale-105 shadow-lg hover:shadow-xl"
                        >
                          Enroll Now
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Call to Action */}
          <div className="text-center mt-20 bg-gradient-to-r from-[#01143d] to-[#0088e0] rounded-3xl p-12 text-white relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-4 left-4 w-20 h-20 bg-white rounded-full blur-xl animate-pulse-slow"></div>
              <div className="absolute bottom-4 right-4 w-32 h-32 bg-white rounded-full blur-2xl animate-bounce-slow"></div>
            </div>
            
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Start Your Journey?</h2>
              <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
                Join thousands of successful students who have achieved their academic goals with Dr. U Education across our Melbourne locations.
              </p>
              <Link
                href="/enroll"
                className="inline-flex items-center gap-3 bg-white text-[#01143d] font-bold py-4 px-8 rounded-full hover:bg-gray-100 transition-all duration-300 transform hover:scale-105 shadow-2xl"
              >
                Start Your Enrollment
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-black/20 border-t border-white/10 py-8 text-center">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-white/80">© 2025 Dr. U Education Centre. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
