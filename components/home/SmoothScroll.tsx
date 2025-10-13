'use client';

import { useEffect } from 'react';

export default function SmoothScroll() {
  useEffect(() => {
    // Smooth scroll for anchor links
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href^="#"]');
      
      if (anchor) {
        const href = anchor.getAttribute('href');
        if (href && href.startsWith('#')) {
          e.preventDefault();
          const element = document.querySelector(href);
          if (element) {
            element.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          }
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);

    // Add fade-in animation on scroll
    const animateElements = document.querySelectorAll('.hover-float, .glass');
    
    const checkScroll = () => {
      animateElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        
        if (rect.top <= windowHeight * 0.8) {
          el.classList.add('animate-fade-in');
        }
      });
    };
    
    window.addEventListener('scroll', checkScroll);
    checkScroll(); // Check on initial load

    return () => {
      document.removeEventListener('click', handleAnchorClick);
      window.removeEventListener('scroll', checkScroll);
    };
  }, []);

  return null;
}
