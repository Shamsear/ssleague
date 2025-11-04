import Image from 'next/image';

interface LogoPlaceholderProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  fallbackText?: string;
}

/**
 * LogoPlaceholder - Shows the club logo (`/logo.png`) instead of gradient placeholders.
 * 
 * Usage:
 * - Default: <LogoPlaceholder /> (64px)
 * - Small: <LogoPlaceholder size="sm" /> (40px)
 * - Medium: <LogoPlaceholder size="md" /> (48px)
 * - Large: <LogoPlaceholder size="lg" /> (64px)
 * - XL: <LogoPlaceholder size="xl" /> (80px)
 * - Custom: <LogoPlaceholder size={100} />
 * - With custom classes: <LogoPlaceholder className="rounded-full" />
 */
export default function LogoPlaceholder({ 
  size = 'lg', 
  className = '',
  fallbackText = 'SS'
}: LogoPlaceholderProps) {
  // Convert size prop to pixels
  const sizeMap = {
    sm: 40,
    md: 48,
    lg: 64,
    xl: 80,
  };
  
  const pixels = typeof size === 'number' ? size : sizeMap[size];
  
  return (
    <div 
      className={`relative flex items-center justify-center bg-white rounded-2xl overflow-hidden ${className}`}
      style={{ width: pixels, height: pixels }}
    >
      <Image
        src="/logo.png"
        alt="SS League Logo"
        width={pixels}
        height={pixels}
        className="object-contain p-1"
        priority
      />
    </div>
  );
}
