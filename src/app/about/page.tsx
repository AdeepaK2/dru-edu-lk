‘use client’;

import React from ‘react’;
import Image from ‘next/image’;
import Link from ‘next/link’;
import Navbar from ‘@/components/Navbar’;
import { Footer, ChatBot } from ‘@/components/ui’;

export default function AboutPage() {
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
              🎓 Our Story & Success
            </span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-6 leading-tight">
            About <span className="bg-gradient-to-r from-[#0088e0] to-[#00b4d8] bg-clip-text text-transparent">Dr. U Education</span>
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto leading-relaxed">
            Excellence in education through personalized coaching, expert guidance, and proven methods.
          </p>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="relative bg-gradient-to-b from-white to-gray-50 rounded-t-3xl pt-16 pb-24 -mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Testimonials teaser */}
          <div className="mb-16">
            <div className="bg-gradient-to-r from-[#01143d] to-[#0a2147] rounded-3xl p-10 flex flex-col md:flex-row items-center gap-8 shadow-xl">
              <div className="flex-shrink-0 w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Hear From Our Students & Parents</h2>
                <p className="text-white/70 text-sm leading-relaxed">
                  Every testimonial on our platform is personally invited, email-verified, and reviewed by our team before going live —
                  so you can trust that every word is real.
                </p>
              </div>
              <Link
                href="/testimonials"
                className="flex-shrink-0 bg-white text-[#01143d] hover:bg-gray-100 px-7 py-3 rounded-full font-semibold shadow-lg transition-all duration-300 hover:scale-105 whitespace-nowrap"
              >
                Read Testimonials →
              </Link>
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center mt-20 bg-gradient-to-r from-[#01143d] to-[#0088e0] rounded-3xl p-12 text-white relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-4 left-4 w-20 h-20 bg-white rounded-full blur-xl animate-pulse"></div>
              <div className="absolute bottom-4 right-4 w-32 h-32 bg-white rounded-full blur-2xl animate-pulse"></div>
            </div>
            
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Join Dr. U Education Today</h2>
              <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
                Experience the difference with personalized coaching and expert guidance
              </p>
              <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6">
                <Link 
                  href="/enroll" 
                  className="bg-white text-[#01143d] hover:bg-gray-100 px-8 py-3 rounded-full font-semibold shadow-lg transition-all duration-300 transform hover:scale-105"
                >
                  Enroll Now
                </Link>
                <Link 
                  href="/courses" 
                  className="bg-transparent border-2 border-white hover:bg-white/10 px-8 py-3 rounded-full font-semibold transition-all duration-300"
                >
                  View Courses
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <Footer/>
      
      {/* AI Chat Bot */}
      <ChatBot />
    </div>
  );
}
