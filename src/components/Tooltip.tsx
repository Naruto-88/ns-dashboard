import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../contexts/ThemeContext';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  className?: string;
  widthClass?: string;
  key?: React.Key;
}

export default function Tooltip({ 
  content, 
  children, 
  position = 'top', 
  align = 'center', 
  className = '',
  widthClass = 'w-max min-w-[14rem] max-w-sm'
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    let top = 0;
    let left = 0;

    if (position === 'top') {
      top = rect.top + scrollY - 10;
      if (align === 'center') left = rect.left + scrollX + rect.width / 2;
      else if (align === 'start') left = rect.left + scrollX;
      else if (align === 'end') left = rect.right + scrollX;
    } else if (position === 'bottom') {
      top = rect.bottom + scrollY + 10;
      if (align === 'center') left = rect.left + scrollX + rect.width / 2;
      else if (align === 'start') left = rect.left + scrollX;
      else if (align === 'end') left = rect.right + scrollX;
    } else if (position === 'left') {
      top = rect.top + scrollY + rect.height / 2;
      left = rect.left + scrollX - 10;
    } else if (position === 'right') {
      top = rect.top + scrollY + rect.height / 2;
      left = rect.right + scrollX + 10;
    }

    setCoords({ top, left });
  };

  const handleMouseEnter = () => {
    updatePosition();
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  useEffect(() => {
    if (isVisible) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isVisible]);

  const getTransformClasses = () => {
    if (position === 'top') {
      if (align === 'center') return '-translate-x-1/2 -translate-y-full';
      if (align === 'start') return '-translate-y-full';
      if (align === 'end') return '-translate-x-full -translate-y-full';
    }
    if (position === 'bottom') {
      if (align === 'center') return '-translate-x-1/2';
      if (align === 'start') return '';
      if (align === 'end') return '-translate-x-full';
    }
    if (position === 'left') return '-translate-x-full -translate-y-1/2';
    if (position === 'right') return '-translate-y-1/2';
    return '';
  };

  return (
    <div 
      ref={triggerRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible && typeof document !== 'undefined' && createPortal(
        <div 
          ref={tooltipRef}
          style={{ 
            top: `${coords.top}px`, 
            left: `${coords.left}px`,
            position: 'absolute',
            zIndex: 999999
          }}
          className={`${getTransformClasses()} ${widthClass} p-3.5 rounded-2xl font-medium shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] border backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-150 text-left pointer-events-none ${
            theme === 'white' 
              ? 'bg-white/95 border-zinc-300 text-zinc-900 shadow-2xl ring-1 ring-black/5' 
              : 'bg-zinc-950/95 border-white/20 text-white shadow-2xl ring-1 ring-white/10'
          }`}
        >
          {typeof content === 'string' ? (
            <div className="text-[12px] leading-relaxed font-medium text-center">
              {content}
            </div>
          ) : (
            <div className="text-[12px] leading-relaxed w-full">
              {content}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
