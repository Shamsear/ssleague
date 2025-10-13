'use client';

import Link from 'next/link';

export default function Hero() {
  return (
    <div className="relative text-center mb-24 sm:mb-32">
      {/* Background blur effect */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[120%] h-56 opacity-20 blur-3xl rounded-full -z-10" style={{background: 'linear-gradient(to right, #0066FF, #9580FF)'}}></div>
      
      {/* Main heading */}
      <h1 className="text-4xl md:text-6xl font-extrabold mb-6 gradient-text tracking-tight">
        Welcome to <span className="block sm:inline">Football Auction</span>
      </h1>
      
      {/* Subtitle */}
      <p className="text-lg sm:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
        Experience the thrill of building your dream football team through strategic bidding and competitive auctions
      </p>
      
      {/* CTA Buttons */}
      <div className="flex flex-col sm:flex-row justify-center gap-4">
        <Link 
          href="/login" 
          className="group px-8 py-4 rounded-2xl text-white font-medium shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 vision-button flex items-center justify-center"
          style={{background: 'linear-gradient(to right, #0066FF, #9580FF)'}}
        >
          <span>Get Started</span>
          <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
          </svg>
        </Link>
        
        <a 
          href="#features" 
          className="px-8 py-4 glass rounded-2xl hover:bg-white/90 text-gray-700 font-medium hover:-translate-y-1 transition-all duration-300 vision-button flex items-center justify-center"
        >
          <span>Learn More</span>
          <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </a>
      </div>
      
      {/* Decorative Elements */}
      <div className="hidden md:block absolute -right-16 top-0 w-32 h-32 rounded-full blur-2xl opacity-10" style={{backgroundColor: '#0066FF'}}></div>
      <div className="hidden md:block absolute -left-16 bottom-0 w-32 h-32 rounded-full blur-2xl opacity-10" style={{backgroundColor: '#9580FF'}}></div>
    </div>
  );
}
