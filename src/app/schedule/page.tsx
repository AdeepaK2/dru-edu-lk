import Navbar from "@/components/Navbar";
import Footer from "@/components/ui/Footer";
import Link from "next/link";

export default function SchedulePage() {
  const cranbourneSchedule = [
    {
      category: "VCE Subjects",
      classes: [
        { subject: "VCE Math Methods [Units 3&4]", day: "Sunday", time: "7.00 am - 11.00 am" },
        { subject: "VCE Specialist Math [Units 3&4]", day: "Saturday", time: "7.00 am - 11.00 am" },
        { subject: "VCE Chemistry [Units 3&4]", day: "Monday", time: "7.30 pm - 9.30 pm" },
        { subject: "VCE Physics [Units 3&4]", day: "Tuesday", time: "6.00 pm - 9.30 pm" },
        { subject: "VCE Math Methods [Units 1&2]", day: "Thursday", time: "6.00pm - 8.00 pm" },
        { subject: "VCE Specialist Math [Units 1&2]", day: "Saturday", time: "4.30 pm - 6.30 pm" },
        { subject: "VCE Chemistry [Units 1&2]", day: "Saturday", time: "2.30 pm - 4.30 pm" },
        { subject: "VCE Physics [Units 1&2]", day: "Thursday", time: "8.00 pm - 9.30 pm" },
        { subject: "VCE Accounting [Units 1&2]", day: "Tuesday", time: "6.15 pm - 7.45 pm" },
        { subject: "VCE Accounting [Units 3&4]", day: "Wednesday", time: "6.00 pm - 8.30 pm" },
        { subject: "VCE General Maths [Units 3&4]", day: "Tuesday", time: "7.45 pm - 9.15 pm" },
      ]
    },
    {
      category: "Grade 5 to Grade 10",
      classes: [
        { subject: "Y 10 Mathematics", day: "Monday", time: "6.00 pm - 7.30 pm" },
        { subject: "Y 9 Mathematics", day: "Sunday", time: "1.30 pm - 3.30 pm" },
        { subject: "Y 8 Mathematics [Selective School]", day: "Sunday", time: "11.00 am - 1.30 pm" },
        { subject: "Y 8 English [Selective School]", day: "Sunday", time: "9.30 am - 11.00 am" },
        { subject: "Y 7 Mathematics [Selective School]", day: "Tuesday", time: "6.00 pm - 7.30 pm" },
        { subject: "Y 6 Mathematics", day: "Saturday", time: "5.30pm - 7.00 pm" },
        { subject: "John Monash Scholarship [Including Interview Prep]", day: "Saturday", time: "12.30 pm - 2.30 pm" },
      ]
    }
  ];

  const glenWaverleySchedule = [
    {
      category: "All Subjects",
      classes: [
        { subject: "VCE Math Methods [Units 3&4]", day: "Sunday", time: "6.00 pm - 9.30 pm" },
        { subject: "VCE Specialist Math [Units 3&4]", day: "Friday", time: "7.00 pm - 10.30 pm" },
        { subject: "VCE Physics [Units 3&4]", day: "Saturday", time: "9.00 pm - 10.30 pm" },
        { subject: "VCE Math Methods [Units 1&2]", day: "Friday", time: "5.00 pm - 7.00 pm" },
        { subject: "VCE Specialist Math [Units 1&2]", day: "Saturday", time: "7.00 pm - 9.00 pm" },
        { subject: "VCE Accounting [Units 3&4]", day: "Monday", time: "6.45 pm - 8.45 pm" },
        { subject: "VCE Accounting [Units 1&2]", day: "Sunday", time: "12.00 pm - 1.30 pm" },
        { subject: "VCE Business Management [Units 3&4]", day: "Monday", time: "4.45 pm - 6.45 pm" },
        { subject: "VCE Economics [Units 3&4]", day: "Thursday", time: "7.00 pm - 9.00 pm" },
        { subject: "VCE General Maths [Units 1&2]", day: "Sunday", time: "11.00 am - 12.30 pm" },
        { subject: "Y 10 Maths", day: "Wednesday", time: "4.30 pm - 6.00 pm" },
        { subject: "Y 8 Maths [Selective School]", day: "Wednesday", time: "5.30 pm - 7.30 pm" },
        { subject: "Y 6 Maths", day: "Wednesday", time: "7.00 pm - 8.30 pm" },
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
              📅 Schedule 2025/2026 Time Table
            </span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-6 leading-tight">
            Class <span className="bg-gradient-to-r from-[#0088e0] to-[#00b4d8] bg-clip-text text-transparent">Schedule</span>
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto leading-relaxed mb-8">
            At Dr. U Education Center, we're gearing up for an exciting year of learning in 2025. With our commitment to academic excellence, we're proud to offer classes at not one, not two, but three campuses! Whether you're in Cranbourne or Glen Waverley, we're here to guide your educational journey.
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative bg-gradient-to-b from-white to-gray-50 rounded-t-3xl pt-16 pb-24 -mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Cranbourne Campus */}
          <div className="mb-20 opacity-0 animate-[fadeInUp_0.8s_ease-out_forwards]">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-3 bg-gradient-to-r from-[#01143d] to-[#0088e0] text-white px-6 py-3 rounded-full mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="font-bold text-lg">Cranbourne Campus</span>
              </div>
            </div>
            
            <div className="grid lg:grid-cols-2 gap-8">
              {cranbourneSchedule.map((category, categoryIndex) => (
                <div key={categoryIndex} className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
                  <div className="bg-gradient-to-r from-[#0088e0] to-[#00b4d8] p-4">
                    <h3 className="text-xl font-bold text-white">{category.category}</h3>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      {category.classes.map((classItem, classIndex) => (
                        <div key={classIndex} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors duration-200">
                          <div className="flex-1">
                            <h4 className="font-semibold text-[#01143d] mb-1">{classItem.subject}</h4>
                            <div className="flex items-center text-sm text-gray-600">
                              <svg className="w-4 h-4 mr-2 text-[#0088e0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="font-medium mr-4">{classItem.day}</span>
                              <svg className="w-4 h-4 mr-2 text-[#0088e0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>{classItem.time}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Glen Waverley Campus */}
          <div className="mb-20 opacity-0 animate-[fadeInUp_0.8s_ease-out_forwards]" style={{ animationDelay: '400ms' }}>
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-3 bg-gradient-to-r from-[#01143d] to-[#0088e0] text-white px-6 py-3 rounded-full mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="font-bold text-lg">Glen Waverley Campus</span>
              </div>
            </div>
            
            <div className="max-w-4xl mx-auto">
              {glenWaverleySchedule.map((category, categoryIndex) => (
                <div key={categoryIndex} className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
                  <div className="bg-gradient-to-r from-[#0088e0] to-[#00b4d8] p-4">
                    <h3 className="text-xl font-bold text-white">{category.category}</h3>
                  </div>
                  <div className="p-6">
                    <div className="grid md:grid-cols-2 gap-4">
                      {category.classes.map((classItem, classIndex) => (
                        <div key={classIndex} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors duration-200">
                          <div className="flex-1">
                            <h4 className="font-semibold text-[#01143d] mb-1">{classItem.subject}</h4>
                            <div className="flex items-center text-sm text-gray-600">
                              <svg className="w-4 h-4 mr-2 text-[#0088e0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="font-medium mr-4">{classItem.day}</span>
                              <svg className="w-4 h-4 mr-2 text-[#0088e0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>{classItem.time}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center mt-20 bg-gradient-to-r from-[#01143d] to-[#0088e0] rounded-3xl p-12 text-white relative overflow-hidden opacity-0 animate-[fadeInUp_0.8s_ease-out_forwards]" style={{ animationDelay: '600ms' }}>
            {/* Background decoration */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-4 left-4 w-20 h-20 bg-white rounded-full blur-xl animate-pulse-slow"></div>
              <div className="absolute bottom-4 right-4 w-32 h-32 bg-white rounded-full blur-2xl animate-bounce-slow"></div>
            </div>
            
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Join Our Classes?</h2>
              <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
                Secure your spot in our 2025/2026 academic year classes across our Melbourne campuses.
              </p>
              <Link
                href="/enroll"
                className="inline-flex items-center gap-3 bg-white text-[#01143d] font-bold py-4 px-8 rounded-full hover:bg-gray-100 transition-all duration-300 transform hover:scale-105 shadow-2xl"
              >
                Enroll Now
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer/>
    </div>
  );
}
