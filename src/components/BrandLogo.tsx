import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-7 w-[34px]',
  md: 'h-9 w-[44px]',
  lg: 'h-12 w-[58px]'
};

export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 'md', className = '' }) => {
  return (
    <div
      className={`relative overflow-hidden shrink-0 select-none ${SIZE_CLASSES[size]} ${className}`}
      aria-label="Campus Ambassador System Logo"
    >
      <img
        src="/assets/aistudio/03__3___1__89b83f4f.png"
        alt="Campus Ambassador System"
        className="h-full w-auto max-w-none object-left pointer-events-none"
      />
    </div>
  );
};
