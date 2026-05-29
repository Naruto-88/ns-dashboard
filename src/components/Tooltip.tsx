import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  className?: string;
  key?: React.Key;
}

export default function Tooltip({ content, children, position = 'top', align = 'center', className = '' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { theme } = useTheme();

  const getPositionClasses = () => {
    let classes = '';
    
    // Position
    if (position === 'top') classes += 'bottom-full mb-3 ';
    if (position === 'bottom') classes += 'top-full mt-3 ';
    if (position === 'left') classes += 'right-full mr-3 top-1/2 -translate-y-1/2 ';
    if (position === 'right') classes += 'left-full ml-3 top-1/2 -translate-y-1/2 ';

    // Alignment for top/bottom
    if (position === 'top' || position === 'bottom') {
      if (align === 'center') classes += 'left-1/2 -translate-x-1/2 ';
      if (align === 'start') classes += 'left-0 ';
      if (align === 'end') classes += 'right-0 ';
    }

    return classes;
  };

  const animationClasses = {
    top: 'slide-in-from-bottom-2',
    bottom: 'slide-in-from-top-2',
    left: 'slide-in-from-right-2',
    right: 'slide-in-from-left-2'
  };

  return (
    <div 
      className={`relative inline-block ${className} ${isVisible ? 'z-[1000]' : ''}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className={`absolute ${getPositionClasses()} w-56 p-3 rounded-3xl font-medium z-[9999] shadow-[0_30px_60px_rgba(0,0,0,0.6)] border backdrop-blur-3xl animate-in fade-in ${animationClasses[position]} duration-200 text-left pointer-events-none tooltip-override ${
          theme === 'white' ? 'bg-white/100 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/10 text-white'
        }`}>
          {typeof content === 'string' ? (
            <div className="text-[12px] leading-relaxed font-medium text-center tooltip-override">
              {content}
            </div>
          ) : (
            <div className="text-[12px] leading-relaxed tooltip-override w-full">
              {content}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
