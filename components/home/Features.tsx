export default function Features() {
  const features = [
    {
      title: 'Team Management',
      description: 'Build and manage your dream team with strategic player acquisitions and smart budget management.',
      icon: (
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
        </svg>
      ),
      features: [
        'Balanced roster building',
        'Budget allocation'
      ]
    },
    {
      title: 'Live Bidding',
      description: 'Participate in real-time auctions with dynamic bidding and instant updates on your competition.',
      icon: (
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      ),
      features: [
        'Real-time updates',
        'Tiebreaker resolution'
      ]
    },
    {
      title: 'Secure Platform',
      description: 'Enjoy a safe and fair bidding environment with secure transactions and transparent processes.',
      icon: (
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
        </svg>
      ),
      features: [
        'Secure transactions',
        'Fair competition'
      ]
    }
  ];

  return (
    <div id="features" className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-24">
      {features.map((feature, index) => (
        <div 
          key={index}
          className="glass p-8 rounded-3xl hover-float group transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 border border-white/20"
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transform group-hover:rotate-6 transition-transform" style={{background: 'linear-gradient(to right, #0066FF, #9580FF)'}}>
            {feature.icon}
          </div>
          
          <h3 className="text-2xl font-semibold mb-4 transition-colors" style={{color: 'inherit'}}>
            <span className="group-hover:text-primary">{feature.title}</span>
          </h3>
          
          <p className="text-gray-600 leading-relaxed mb-4">
            {feature.description}
          </p>
          
          <ul className="text-gray-600 space-y-2">
            {feature.features.map((item, idx) => (
              <li key={idx} className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="#0066FF" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                </svg>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
