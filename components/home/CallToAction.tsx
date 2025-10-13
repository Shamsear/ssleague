import Link from 'next/link';

export default function CallToAction() {
  return (
    <div className="text-center relative">
      <div className="absolute inset-0 rounded-3xl -z-10 opacity-5" style={{background: 'linear-gradient(to right, #0066FF, #9580FF)'}}></div>
      
      <div className="glass p-10 rounded-3xl border border-white/20">
        <h2 className="text-3xl font-bold mb-6 gradient-text">
          Ready to Start?
        </h2>
        
        <p className="text-xl text-gray-600 mb-8 max-w-xl mx-auto">
          Join the excitement of football auction today and experience the thrill of building your dream team
        </p>
        
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link 
            href="/register" 
            className="group px-8 py-4 rounded-2xl text-white font-medium shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 vision-button flex items-center justify-center"
            style={{background: 'linear-gradient(to right, #0066FF, #9580FF)'}}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
            </svg>
            <span>Create Account</span>
          </Link>
          
          <Link 
            href="/login" 
            className="group px-8 py-4 glass rounded-2xl text-gray-700 font-medium hover:bg-white/90 hover:-translate-y-1 transition-all duration-300 vision-button flex items-center justify-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path>
            </svg>
            <span>Sign In</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
