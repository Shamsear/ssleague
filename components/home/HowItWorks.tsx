export default function HowItWorks() {
  const steps = [
    {
      number: 1,
      title: 'Register',
      description: 'Create your account and set up your team profile with preferences'
    },
    {
      number: 2,
      title: 'Join Rounds',
      description: 'Participate in position-specific auction rounds based on schedule'
    },
    {
      number: 3,
      title: 'Place Bids',
      description: 'Bid on players within your budget and compete with other teams'
    },
    {
      number: 4,
      title: 'Build Team',
      description: 'Create your dream team with acquired players and track performance'
    }
  ];

  return (
    <div className="glass p-10 rounded-3xl mb-24 relative overflow-hidden border border-white/20">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 rounded-full -mr-32 -mt-32 blur-3xl opacity-10" style={{background: 'linear-gradient(to bottom, #0066FF, transparent)'}}></div>
      
      <h2 className="text-3xl font-bold mb-10 text-center gradient-text relative z-10">
        How It Works
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10">
        {steps.map((step) => (
          <div key={step.number} className="flex flex-col items-center text-center group">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-all duration-300" style={{background: 'linear-gradient(to right, #0066FF, #9580FF)'}}>
              <span className="text-white text-xl font-bold">{step.number}</span>
            </div>
            
            <h3 className="font-semibold text-lg mb-3 transition-colors">
              <span className="group-hover:text-primary">{step.title}</span>
            </h3>
            
            <p className="text-gray-600 leading-relaxed">
              {step.description}
            </p>
            
            <div className="h-1.5 w-16 rounded-full mt-4 group-hover:w-24 transition-all duration-300 opacity-20" style={{background: 'linear-gradient(to right, #0066FF, #9580FF)'}}></div>
          </div>
        ))}
      </div>
    </div>
  );
}
