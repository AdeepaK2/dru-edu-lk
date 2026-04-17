'use client';

import { useState } from 'react';
import Link from 'next/link';
import { addDoc, collection } from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';

interface ConsultationRequest {
  parentName: string;
  studentName: string;
  email: string;
  phone: string;
  grade: string;
  subjects: string[];
  preferredTime: string;
  concerns: string;
  howDidYouHear: string;
  createdAt: Date;
  status: 'pending' | 'scheduled' | 'completed';
}

export default function ConsultationPage() {
  const [formData, setFormData] = useState({
    parentName: '',
    studentName: '',
    email: '',
    phone: '',
    grade: '',
    subjects: [] as string[],
    preferredTime: '',
    concerns: '',
    howDidYouHear: ''
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const grades = [
    'Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12',
    'Foundation', 'Primary School'
  ];

  const subjects = [
    'Mathematics', 'English', 'Science', 'Physics', 'Chemistry', 
    'Biology', 'History', 'Geography', 'Economics', 'Psychology',
    'Legal Studies', 'Business Studies', 'Computing', 'Literature'
  ];

  const timeSlots = [
    'Weekday Morning (9am-12pm)',
    'Weekday Afternoon (12pm-5pm)', 
    'Weekday Evening (5pm-8pm)',
    'Saturday Morning (9am-12pm)',
    'Saturday Afternoon (12pm-5pm)',
    'Sunday Morning (9am-12pm)',
    'Sunday Afternoon (12pm-5pm)'
  ];

  const hearAboutUs = [
    'Google Search', 'Facebook', 'Instagram', 'Friend/Family Referral',
    'School Recommendation', 'Flyer/Advertisement', 'Existing Student', 'Other'
  ];
  const glassInputClassName =
    'force-dark-input w-full px-4 py-3 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-[#0088e0]';
  const glassSelectClassName =
    'force-dark-input w-full px-4 py-3 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-[#0088e0]';

  const handleSubjectChange = (subject: string) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter(s => s !== subject)
        : [...prev.subjects, subject]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const consultationRequest: ConsultationRequest = {
        ...formData,
        createdAt: new Date(),
        status: 'pending'
      };

      await addDoc(collection(firestore, 'consultationRequests'), consultationRequest);
      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting consultation request:', error);
      alert('Failed to submit consultation request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#01143d] via-[#01143d] to-[#0088e0]">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20">
            <div className="text-center">
              <div className="mb-6">
                <svg className="w-16 h-16 text-green-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-white mb-4">
                Thank You for Your Interest!
              </h1>
              <p className="text-white/80 mb-8 text-lg">
                We've received your consultation request. Our team will contact you within 24 hours to schedule your free consultation session.
              </p>
              <div className="space-y-4">
                <Link 
                  href="/"
                  className="inline-block bg-gradient-to-r from-[#0088e0] to-[#00b4d8] hover:from-[#0066b3] hover:to-[#0088e0] text-white font-semibold py-3 px-8 rounded-full transition-all duration-300"
                >
                  Return to Home
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#01143d] via-[#01143d] to-[#0088e0]">
      {/* Navigation */}
      <nav className="bg-white/10 backdrop-blur-md border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="text-2xl font-bold text-white">
              Dr U Education
            </Link>
            <Link 
              href="/"
              className="text-white/80 hover:text-white transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-6">
              Free Consultation
            </h1>
            <p className="text-xl text-white/80 max-w-2xl mx-auto">
              Book a personalized consultation to discuss your child's academic goals and how we can help them succeed.
            </p>
          </div>

          {/* Form */}
          <div className="force-dark-surface bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Contact Information */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-white font-medium mb-2">
                    Parent/Guardian Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.parentName}
                    onChange={(e) => setFormData({...formData, parentName: e.target.value})}
                    className={glassInputClassName}
                    placeholder="Your full name"
                  />
                </div>
                <div>
                  <label className="block text-white font-medium mb-2">
                    Student Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.studentName}
                    onChange={(e) => setFormData({...formData, studentName: e.target.value})}
                    className={glassInputClassName}
                    placeholder="Student's full name"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-white font-medium mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className={glassInputClassName}
                    placeholder="your.email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-white font-medium mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className={glassInputClassName}
                    placeholder="04XX XXX XXX"
                  />
                </div>
              </div>

              {/* Academic Information */}
              <div>
                <label className="block text-white font-medium mb-2">
                  Current Grade/Year *
                </label>
                <select
                  required
                  value={formData.grade}
                  onChange={(e) => setFormData({...formData, grade: e.target.value})}
                  className={glassSelectClassName}
                >
                  <option value="">Select grade/year</option>
                  {grades.map(grade => (
                    <option key={grade} value={grade} className="bg-[#01143d]">
                      {grade}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subjects */}
              <div>
                <label className="block text-white font-medium mb-3">
                  Subjects of Interest *
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {subjects.map(subject => (
                    <label key={subject} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.subjects.includes(subject)}
                        onChange={() => handleSubjectChange(subject)}
                        className="rounded border-white/30 bg-white/20 text-[#0088e0] focus:ring-[#0088e0]"
                      />
                      <span className="text-white text-sm">{subject}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Preferred Time */}
              <div>
                <label className="block text-white font-medium mb-2">
                  Preferred Consultation Time *
                </label>
                <select
                  required
                  value={formData.preferredTime}
                  onChange={(e) => setFormData({...formData, preferredTime: e.target.value})}
                  className={glassSelectClassName}
                >
                  <option value="">Select preferred time</option>
                  {timeSlots.map(time => (
                    <option key={time} value={time} className="bg-[#01143d]">
                      {time}
                    </option>
                  ))}
                </select>
              </div>

              {/* Concerns */}
              <div>
                <label className="block text-white font-medium mb-2">
                  Academic Concerns or Goals
                </label>
                <textarea
                  rows={4}
                  value={formData.concerns}
                  onChange={(e) => setFormData({...formData, concerns: e.target.value})}
                  className={`${glassInputClassName} resize-none`}
                  placeholder="Tell us about your child's current academic situation, challenges, or goals..."
                />
              </div>

              {/* How did you hear about us */}
              <div>
                <label className="block text-white font-medium mb-2">
                  How did you hear about us?
                </label>
                <select
                  value={formData.howDidYouHear}
                  onChange={(e) => setFormData({...formData, howDidYouHear: e.target.value})}
                  className={glassSelectClassName}
                >
                  <option value="">Select an option</option>
                  {hearAboutUs.map(option => (
                    <option key={option} value={option} className="bg-[#01143d]">
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-[#0088e0] to-[#00b4d8] hover:from-[#0066b3] hover:to-[#0088e0] text-white font-semibold py-4 px-8 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Submitting...' : 'Schedule Free Consultation'}
                </button>
              </div>

              {/* Note */}
              <div className="text-center text-white/60 text-sm">
                <p>
                  * Required fields. We'll contact you within 24 hours to confirm your consultation appointment.
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
