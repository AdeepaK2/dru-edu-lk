'use client';

import Navbar from "@/components/Navbar";
import Footer from "@/components/ui/Footer";
import Link from "next/link";
import { useState } from "react";

export default function SchedulePage() {
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  const handleClassClick = (classItem: any, campus: string) => {
    setSelectedClass({ ...classItem, campus });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedClass(null);
  };
  // Time slots for the schedule tables (reduced to key hours with classes)
  const timeSlots = [
    "7:00 AM", "9:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", 
    "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM"
  ];

  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Cranbourne schedule organized by day and time
  const cranbourneClasses = [
    { subject: "VCE Math Methods [Units 3&4]", day: "Sunday", time: "7:00 AM - 11:00 AM", startHour: 7, duration: 4 },
    { subject: "VCE Specialist Math [Units 3&4]", day: "Saturday", time: "7:00 AM - 11:00 AM", startHour: 7, duration: 4 },
    { subject: "VCE Chemistry [Units 3&4]", day: "Monday", time: "7:30 PM - 9:30 PM", startHour: 19.5, duration: 2 },
    { subject: "VCE Physics [Units 3&4]", day: "Tuesday", time: "6:00 PM - 9:30 PM", startHour: 18, duration: 3.5 },
    { subject: "VCE Math Methods [Units 1&2]", day: "Thursday", time: "6:00 PM - 8:00 PM", startHour: 18, duration: 2 },
    { subject: "VCE Specialist Math [Units 1&2]", day: "Saturday", time: "4:30 PM - 6:30 PM", startHour: 16.5, duration: 2 },
    { subject: "VCE Chemistry [Units 1&2]", day: "Saturday", time: "2:30 PM - 4:30 PM", startHour: 14.5, duration: 2 },
    { subject: "VCE Physics [Units 1&2]", day: "Thursday", time: "8:00 PM - 9:30 PM", startHour: 20, duration: 1.5 },
    { subject: "VCE Accounting [Units 1&2]", day: "Tuesday", time: "6:15 PM - 7:45 PM", startHour: 18.25, duration: 1.5 },
    { subject: "VCE Accounting [Units 3&4]", day: "Wednesday", time: "6:00 PM - 8:30 PM", startHour: 18, duration: 2.5 },
    { subject: "VCE General Maths [Units 3&4]", day: "Tuesday", time: "7:45 PM - 9:15 PM", startHour: 19.75, duration: 1.5 },
    { subject: "Y 10 Mathematics", day: "Monday", time: "6:00 PM - 7:30 PM", startHour: 18, duration: 1.5 },
    { subject: "Y 9 Mathematics", day: "Sunday", time: "1:30 PM - 3:30 PM", startHour: 13.5, duration: 2 },
    { subject: "Y 8 Mathematics [Selective School]", day: "Sunday", time: "11:00 AM - 1:30 PM", startHour: 11, duration: 2.5 },
    { subject: "Y 8 English [Selective School]", day: "Sunday", time: "9:30 AM - 11:00 AM", startHour: 9.5, duration: 1.5 },
    { subject: "Y 7 Mathematics [Selective School]", day: "Tuesday", time: "6:00 PM - 7:30 PM", startHour: 18, duration: 1.5 },
    { subject: "Y 6 Mathematics", day: "Saturday", time: "5:30 PM - 7:00 PM", startHour: 17.5, duration: 1.5 },
    { subject: "John Monash Scholarship [Including Interview Prep]", day: "Saturday", time: "12:30 PM - 2:30 PM", startHour: 12.5, duration: 2 },
  ];

  // Glen Waverley schedule organized by day and time
  const glenWaverleyClasses = [
    { subject: "VCE Math Methods [Units 3&4]", day: "Sunday", time: "6:00 PM - 9:30 PM", startHour: 18, duration: 3.5 },
    { subject: "VCE Specialist Math [Units 3&4]", day: "Friday", time: "7:00 PM - 10:30 PM", startHour: 19, duration: 3.5 },
    { subject: "VCE Physics [Units 3&4]", day: "Saturday", time: "9:00 PM - 10:30 PM", startHour: 21, duration: 1.5 },
    { subject: "VCE Math Methods [Units 1&2]", day: "Friday", time: "5:00 PM - 7:00 PM", startHour: 17, duration: 2 },
    { subject: "VCE Specialist Math [Units 1&2]", day: "Saturday", time: "7:00 PM - 9:00 PM", startHour: 19, duration: 2 },
    { subject: "VCE Accounting [Units 3&4]", day: "Monday", time: "6:45 PM - 8:45 PM", startHour: 18.75, duration: 2 },
    { subject: "VCE Accounting [Units 1&2]", day: "Sunday", time: "12:00 PM - 1:30 PM", startHour: 12, duration: 1.5 },
    { subject: "VCE Business Management [Units 3&4]", day: "Monday", time: "4:45 PM - 6:45 PM", startHour: 16.75, duration: 2 },
    { subject: "VCE Economics [Units 3&4]", day: "Thursday", time: "7:00 PM - 9:00 PM", startHour: 19, duration: 2 },
    { subject: "VCE General Maths [Units 1&2]", day: "Sunday", time: "11:00 AM - 12:30 PM", startHour: 11, duration: 1.5 },
    { subject: "Y 10 Maths", day: "Wednesday", time: "4:30 PM - 6:00 PM", startHour: 16.5, duration: 1.5 },
    { subject: "Y 8 Maths [Selective School]", day: "Wednesday", time: "5:30 PM - 7:30 PM", startHour: 17.5, duration: 2 },
    { subject: "Y 6 Maths", day: "Wednesday", time: "7:00 PM - 8:30 PM", startHour: 19, duration: 1.5 },
  ];

  // Function to get classes for a specific day and campus
  const getClassesForDay = (day: string, classes: any[]) => {
    const dayMap: { [key: string]: string } = {
      "Mon": "Monday", "Tue": "Tuesday", "Wed": "Wednesday", 
      "Thu": "Thursday", "Fri": "Friday", "Sat": "Saturday", "Sun": "Sunday"
    };
    return classes.filter(cls => cls.day === dayMap[day]);
  };

  // Function to determine if a time slot overlaps with a class
  const getClassAtTimeSlot = (day: string, timeSlot: string, classes: any[]) => {
    const hour = parseInt(timeSlot.split(':')[0]);
    const isAM = timeSlot.includes('AM');
    const isPM = timeSlot.includes('PM');
    
    let slotHour = hour;
    if (isPM && hour !== 12) slotHour += 12;
    if (isAM && hour === 12) slotHour = 0;

    const dayClasses = getClassesForDay(day, classes);
    
    for (const cls of dayClasses) {
      const startHour = cls.startHour;
      const endHour = startHour + cls.duration;
      
      if (slotHour >= startHour && slotHour < endHour) {
        return cls;
      }
    }
    return null;
  };

  // Function to get abbreviated class name
  const getAbbreviatedClassName = (subject: string) => {
    return subject
      .replace("VCE ", "")
      .replace("Mathematics", "Math")
      .replace("[Units 3&4]", "3&4")
      .replace("[Units 1&2]", "1&2")
      .replace("[Selective School]", "SS")
      .replace("[Including Interview Prep]", "")
      .substring(0, 25);
  };

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
            At Dr. U Education Center, we're gearing up for an exciting year of learning in 2025. With our commitment to academic excellence, we're proud to offer classes at two campuses! Whether you're in Cranbourne or Glen Waverley, we're here to guide your educational journey.
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
            
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
              <div className="bg-gradient-to-r from-[#0088e0] to-[#00b4d8] p-4">
                <h3 className="text-xl font-bold text-white">Weekly Schedule</h3>
              </div>
              <div className="overflow-hidden">
                <table className="w-full table-fixed">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="p-2 text-left font-semibold text-[#01143d] border-r border-gray-200 w-16">Time</th>
                      {daysOfWeek.map(day => (
                        <th key={day} className="p-2 text-center font-semibold text-[#01143d] border-r border-gray-200">
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {timeSlots.map((timeSlot, index) => (
                      <tr key={timeSlot} className={index % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                        <td className="p-2 font-medium text-gray-700 border-r border-gray-200 bg-gray-50 text-xs">
                          {timeSlot.replace(":00", "")}
                        </td>
                        {daysOfWeek.map(day => {
                          const classItem = getClassAtTimeSlot(day, timeSlot, cranbourneClasses);
                          return (
                            <td key={day} className="p-1 border-r border-gray-200 text-center">
                              {classItem ? (
                                <div 
                                  className="bg-gradient-to-r from-[#0088e0] to-[#00b4d8] text-white rounded p-1 text-xs font-medium shadow-sm cursor-pointer hover:from-[#0066cc] hover:to-[#0099ff] transition-colors duration-200" 
                                  title={classItem.subject}
                                  onClick={() => handleClassClick(classItem, 'Cranbourne')}
                                >
                                  <div className="truncate text-xs leading-tight">
                                    {getAbbreviatedClassName(classItem.subject)}
                                  </div>
                                </div>
                              ) : (
                                <div className="h-6"></div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
            
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
              <div className="bg-gradient-to-r from-[#0088e0] to-[#00b4d8] p-4">
                <h3 className="text-xl font-bold text-white">Weekly Schedule</h3>
              </div>
              <div className="overflow-hidden">
                <table className="w-full table-fixed">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="p-2 text-left font-semibold text-[#01143d] border-r border-gray-200 w-16">Time</th>
                      {daysOfWeek.map(day => (
                        <th key={day} className="p-2 text-center font-semibold text-[#01143d] border-r border-gray-200">
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {timeSlots.map((timeSlot, index) => (
                      <tr key={timeSlot} className={index % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                        <td className="p-2 font-medium text-gray-700 border-r border-gray-200 bg-gray-50 text-xs">
                          {timeSlot.replace(":00", "")}
                        </td>
                        {daysOfWeek.map(day => {
                          const classItem = getClassAtTimeSlot(day, timeSlot, glenWaverleyClasses);
                          return (
                            <td key={day} className="p-1 border-r border-gray-200 text-center">
                              {classItem ? (
                                <div 
                                  className="bg-gradient-to-r from-[#0088e0] to-[#00b4d8] text-white rounded p-1 text-xs font-medium shadow-sm cursor-pointer hover:from-[#0066cc] hover:to-[#0099ff] transition-colors duration-200" 
                                  title={classItem.subject}
                                  onClick={() => handleClassClick(classItem, 'Glen Waverley')}
                                >
                                  <div className="truncate text-xs leading-tight">
                                    {getAbbreviatedClassName(classItem.subject)}
                                  </div>
                                </div>
                              ) : (
                                <div className="h-6"></div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

      {/* Class Details Modal */}
      {showModal && selectedClass && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-[#01143d] to-[#0088e0] p-6 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold mb-2">Class Details</h3>
                  <p className="text-blue-100 text-sm">{selectedClass.campus} Campus</p>
                </div>
                <button
                  onClick={closeModal}
                  className="text-white hover:text-gray-200 transition-colors duration-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-[#01143d] text-lg mb-2">Subject</h4>
                  <p className="text-gray-700">{selectedClass.subject}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h5 className="font-semibold text-[#01143d] mb-1">Day</h5>
                    <p className="text-gray-700">{selectedClass.day}</p>
                  </div>
                  <div>
                    <h5 className="font-semibold text-[#01143d] mb-1">Duration</h5>
                    <p className="text-gray-700">{selectedClass.duration} hours</p>
                  </div>
                </div>
                
                <div>
                  <h5 className="font-semibold text-[#01143d] mb-2">Schedule</h5>
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-center">
                        <p className="text-xs text-gray-600 uppercase tracking-wide">Start Time</p>
                        <p className="text-lg font-bold text-[#01143d]">{selectedClass.time.split(' - ')[0]}</p>
                      </div>
                      <div className="mx-4">
                        <svg className="w-6 h-6 text-[#0088e0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-600 uppercase tracking-wide">End Time</p>
                        <p className="text-lg font-bold text-[#01143d]">{selectedClass.time.split(' - ')[1]}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex gap-3">
                <button
                  onClick={closeModal}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors duration-200"
                >
                  Close
                </button>
                <Link
                  href="/enroll"
                  className="flex-1 bg-gradient-to-r from-[#01143d] to-[#0088e0] text-white py-2 px-4 rounded-lg font-medium text-center hover:from-[#001122] hover:to-[#0066cc] transition-colors duration-200"
                >
                  Enroll Now
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
