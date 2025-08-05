'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const Navbar: React.FC = () => {
  return (
    <nav className="bg-white/15 backdrop-blur-md border-b border-white/30 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity duration-200">
              <div className="w-10 h-10 rounded-full flex items-center justify-center">
                <Image 
                  src="/Logo.png" 
                  alt="Dr. U Education Logo" 
                  width={40} 
                  height={40} 
                  className="rounded-full"
                />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Dr. U Education</h1>
            </Link>
          </div>
          <div className="hidden md:block">
            <div className="ml-10 flex items-center space-x-6">
              <a href="#about" className="text-white/90 hover:text-white hover:bg-white/10 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200">About</a>
              
              {/* Courses page link */}
              <Link href="/courses" className="text-white/90 hover:text-white hover:bg-white/10 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200">Courses</Link>
              
              {/* Books page link */}
              <Link href="/books" className="text-white/90 hover:text-white hover:bg-white/10 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200">Books</Link>
              
              {/* Schedule page link */}
              <Link href="/schedule" className="text-white/90 hover:text-white hover:bg-white/10 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200">Schedule</Link>
              
              <a href="#contact" className="text-white/90 hover:text-white hover:bg-white/10 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200">Contact</a>
              
              {/* Login Dropdown */}
              <div className="relative group">
                <button className="bg-[#0088e0] hover:bg-[#0066b3] text-white px-6 py-2 rounded-full text-sm font-semibold transition-all duration-200 flex items-center space-x-2 shadow-lg">
                  <span>Login</span>
                  <svg className="w-4 h-4 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 border border-gray-100">
                  <div className="py-2">
                    <Link href="/student" className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-[#01143d] transition-colors">
                      <svg className="w-5 h-5 mr-3 text-[#0088e0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Student Portal
                    </Link>
                    <Link href="/teacher" className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-[#01143d] transition-colors">
                      <svg className="w-5 h-5 mr-3 text-[#0088e0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C20.832 18.477 19.246 18 17.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      Teacher Portal
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
