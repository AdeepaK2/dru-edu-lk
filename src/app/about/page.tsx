'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Footer, ChatBot } from '@/components/ui';

// Testimonial interface
interface Testimonial {
  name: string;
  text: string;
  stars: number;
}

const testimonials: Testimonial[] = [
  {
    name: "Arjun Weerasinghe",
    text: "My daughter recently looked towards Dr. U education and from the results we were amazed. Not only does Dr. U provide extensive and meticulous strategies for the Selective High School Entrance Exam but he also crafted excellent books for both, mathematics and numerical reasoning papers. These books were great practise and revision for her as each question was particularly challenging and required problem solving skills. Again, thank you so much Dr. U for all your hard work and time that took to create these very helpful resources which assisted my daughter take the Selective High School Entrance Exam. Couldn't have done it without you! All the best!",
    stars: 5
  },
  {
    name: "Shiyaamaa Fahme",
    text: "We were so blessed to Find Dr U Education for our Daughter's selective school coaching. Dr U is a very committed, motivated mentor with a vision. Dr U Rakhitha got the aptitude to estimate the actual capacity of the child and work in a way which suits the individual child's confidence and deliver the maximum output. More than whatsoever, what I respect the most is that, A parent can approach to him for a feedback. Yes he is busy nevertheless never forgets to give a call back or reply to a text. The BEST",
    stars: 5
  },
  {
    name: "Nuwan Dammika Abeysekera",
    text: "I highly recommend Dr U Education for any student who wants to excel in Maths. Dedication and commitment by Dr U Education staff is highly professional and targeted. Superb method of ensuring the student understand and excel in each area is a key benefit of Dr U Education institute. I sent my daughter to get her prepared for Grade 8 selective exam tests and I can't thank enough for support and guidance received from Dr Rakitha . With support of Dr Rakitha , my daughter achieved a superior grade in the exam. Thank you.",
    stars: 5
  },
  {
    name: "Anuk Ranatunga",
    text: "I am a graduate from Melbourne High School and achieved a 48 for Methods and 53 for Specialist Maths from going to Dr U. He really built discipline into me through his strict and difficult methods of teaching. It allowed me to reach a high level of mathematics hence the scores I got, I could not have done it without him. He constantly got in touch me with me personally to make sure I was on track when I was failing at any point throughout the years. His methods of teaching whilst getting students to do around 30+ papers allowed me to excel in my subjects. Would recommend him.",
    stars: 5
  },
  {
    name: "Saman Vidyananda",
    text: "It was truly a blessing to find Dr Udugama as a tutor for our son with maths methods and specialist maths. It's heart warming to see a tutor giving way more than what is expected from him to bring out the best of his students. He constantly provided feedback and was just a phone call away to discuss any issues. He guided my son with valuable advice to be on top of his studies and trained him to excel in his VCE exam. I have recommended him to many I know and not hesitant to recommend him here as well. You an amazing teacher and thank you for all your dedication for students.",
    stars: 5
  },
  {
    name: "Nafeesa Fawazdeen",
    text: "We're so blessed to have found Rakitha as a tutor, mentor and motivator for our daughter's SEHS exam. Full credit goes out to Dr. U in our daughter's success. Dr. U was just a phone call away if we had any questions or concerns. He takes that extra mile to motivate the child if necessary. Thank you so much Dr. U for the dedication and motivation. We will not hesitate to recommend you as a tutor and mentor.",
    stars: 5
  },
  {
    name: "Ifthi Idris",
    text: "Highly recommend Cranbourne Dr U Education Centre. Dr Rakhitha is an excellent tutor. We are delighted with the progress that my two sons have made in maths. Rakhitha explain the subject clearly he instilled a confidence that had previously been lacking. They thoroughly enjoy his lessons and I would recommend Rakhitha to anyone considering a tutor.",
    stars: 5
  },
  {
    name: "Dimuthu Ranawaka",
    text: "Dr Rakhitha is a passionate maths tutor. Without him, my son wouldn't have achieved a score of 45 in Maths Methods. His excellent personalised guidance was immensely helpful in my son's VCE journey. Also Dr. Rakhitha is hard working and puts students first. Highly recommend Dr. U Education centre.",
    stars: 5
  },
  {
    name: "Prasad Fernando",
    text: "Dr U's ability to communicate with each student and talent for making even tricky subjects like Maths, physics and chemistry understandable is truly superior, something reflected in the results of his students. He always goes the extra mile to drive his students to success. His methodology for taking a student step by step to success is truly remarkable. I wish him the best and thankful for his dedication to drive students to achieve the best in their lives.",
    stars: 5
  },
  {
    name: "Shashini Kandamulla",
    text: "Thanks to Dr.U's tutoring I was able to achieve 47 for Methods and 52 for Specialist Maths. From the start, Dr. U had a very clear plan, as he initially focused on finishing the syllabus (Units 1,2,3,4) for both math classes in Year 11, and then helped me cover 50+ papers during the course of year 12 for each maths class. This meant that I was more confident going into Year 12 because I had a solid understanding of what to expect. I also had more time to familiarise myself with certain concepts, identify my weaknesses and refine my skills before SACs and the final exams, so I could optimise my results. The significant amount of practice papers that Dr. U offered us was really helpful and allowed me to get used to exam style questions, practice my timing on each paper and understand the mark distribution. Through these papers, Dr. U tracked our progress and highlighted certain areas I had to improve on. He checks on students weekly, offers tips on how to improve and he gave me extra material if I needed additional help. Dr. U is a very dedicated tutor and he is willing to spend extra hours in order to help his students achieve their greatest potential. Two hour classes were extended to around four hours by Year 12. This allowed us to do practice papers in test conditions, mark the papers and go through difficult concepts. All of this practice and specialised training from Dr. U allowed me to succeed. I would highly recommend him to anyone.",
    stars: 5
  },
  {
    name: "Fahme Abulhasan",
    text: "Dr. U Education Mr Rakhitha. Thank you for your hard work in supporting my daughter and her education in maths has developed a lot with your guidance, my daughter has developed into a confident and capable child and got through selective entrance exam and your expertise in teaching has put our minds at ease. we will continuing with you. Your way of teaching is a different level! Thanks again.",
    stars: 5
  },
  {
    name: "Wayne Jansen",
    text: "Our older son Josh started off with Dr U mid-last year; have to admit we weren't 100% sure of what to expect and how the couple of months leading to the actual selective school exam would look like. Dr U immediately got to work with Josh and started encouraging Josh to consider various strategies and also started working even on a one-on-one basis to rectify areas of weakness. Within 2 months of attending classes, we were dealing with a kid that was ultra motivated and driven to fix the areas he identified together with Dr U. While Dr U prepared and coached Josh, he also took the time to work out strategies with us as parents on how we together along with him could make this work. It felt like we, as parents, got together with him to create a personalised strategy for our son to ensure we facilitate a common objective. Dr U always made himself available to answer doubts or questions we had; we felt that there was a genuine interest towards ensuring Josh got over the line. As we celebrated an excellent outcome, we look back and give full credit to Dr U and his commitment towards making a better Josh! We as a family, highly recommend the institute and Dr U.",
    stars: 5
  }
];

// Star Rating Component
const StarRating: React.FC<{ rating: number }> = ({ rating }) => {
  return (
    <div className="flex">
      {[...Array(5)].map((_, i) => (
        <svg 
          key={i}
          className={`w-5 h-5 ${i < rating ? 'text-yellow-400' : 'text-gray-300'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
};

// Testimonial Card Component
const TestimonialCard: React.FC<{ testimonial: Testimonial }> = ({ testimonial }) => {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 transition-all duration-300 hover:shadow-xl border border-gray-100">
      <div className="flex items-center mb-4">
        <div className="bg-primary-100 text-primary-700 rounded-full w-12 h-12 flex items-center justify-center font-bold text-xl">
          {testimonial.name.charAt(0)}
        </div>
        <div className="ml-4">
          <h3 className="font-semibold text-lg">{testimonial.name}</h3>
          <StarRating rating={testimonial.stars} />
        </div>
      </div>
      <p className="text-gray-600 leading-relaxed">{testimonial.text}</p>
    </div>
  );
};

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
          
          {/* Testimonials Section */}
          <div className="space-y-16">
            <div className="opacity-0 animate-[fadeInUp_0.8s_ease-out_forwards]" style={{ animationDelay: '200ms' }}>
              <div className="text-center mb-12">
                <div className="flex justify-center mb-6">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-r from-[#0088e0] to-[#00b4d8] flex items-center justify-center shadow-lg">
                    <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-[#01143d] mb-4">Student & Parent Testimonials</h2>
                <p className="text-gray-600 max-w-3xl mx-auto">
                  Welcome to the Dr. U Educational Testimonial Page! Here, we proudly present a selection of 
                  testimonials directly sourced from Google Reviews, featuring feedback from the parents of 
                  our esteemed students.
                </p>
                <div className="w-24 h-1 bg-gradient-to-r from-[#0088e0] to-[#00b4d8] mx-auto rounded-full mt-6"></div>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {testimonials.map((testimonial, index) => (
                  <TestimonialCard key={index} testimonial={testimonial} />
                ))}
              </div>
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
      <footer className="bg-black/20 border-t border-white/10 py-8 text-center">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-white/80">© 2025 Dr. U Education Centre. All rights reserved.</p>
        </div>
      </footer>
      
      {/* AI Chat Bot */}
      <ChatBot />
    </div>
  );
}
