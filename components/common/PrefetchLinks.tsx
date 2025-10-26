/**
 * Prefetch Links Component
 * Intelligently prefetches likely navigation targets
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, ButtonHTMLAttributes } from 'react';

interface FastLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  prefetch?: boolean;
}

/**
 * Faster Link component with automatic prefetching
 */
export function FastLink({ href, children, className, prefetch = true }: FastLinkProps) {
  return (
    <Link 
      href={href} 
      className={className}
      prefetch={prefetch}
    >
      {children}
    </Link>
  );
}

/**
 * Navigation button with instant feedback
 */
interface FastButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  href?: string;
  loading?: boolean;
}

export function FastButton({ href, loading, children, onClick, ...props }: FastButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Add loading state immediately for instant feedback
    onClick?.(e);
    
    // Navigate if href provided
    if (href && !e.defaultPrevented) {
      window.location.href = href;
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      {...props}
    >
      {loading ? (
        <span className="inline-flex items-center">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading...
        </span>
      ) : children}
    </button>
  );
}
