import React from 'react';
import { formatSAR } from '../../lib/utils';
import { cn } from '../../lib/utils';

interface SARCurrencyProps {
  amount: number | string;
  className?: string;
  showSymbol?: boolean;
  symbolPosition?: 'left' | 'right';
  iconSize?: number;
}

// SVG Saudi Riyal Symbol Component
export function SaudiRiyalIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 1124.14 1256.39" 
      className={className}
      fill="currentColor"
    >
      <path d="M699.62,1113.02h0c-20.06,44.48-33.32,92.75-38.4,143.37l424.51-90.24c20.06-44.47,33.31-92.75,38.4-143.37l-424.51,90.24Z"/>
      <path d="M1085.73,895.8c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.33v-135.2l292.27-62.11c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.27V66.13c-50.67,28.45-95.67,66.32-132.25,110.99v403.35l-132.25,28.11V0c-50.67,28.44-95.67,66.32-132.25,110.99v525.69l-295.91,62.88c-20.06,44.47-33.33,92.75-38.42,143.37l334.33-71.05v170.26l-358.3,76.14c-20.06,44.47-33.32,92.75-38.4,143.37l375.04-79.7c30.53-6.35,56.77-24.4,73.83-49.24l68.78-101.97v-.02c7.14-10.55,11.3-23.27,11.3-36.97v-149.98l132.25-28.11v270.4l424.53-90.28Z"/>
    </svg>
  );
}

export function SARCurrency({ 
  amount, 
  className, 
  showSymbol = true, 
  symbolPosition = 'left',
  iconSize = 16
}: SARCurrencyProps) {
  const formattedAmount = formatSAR(amount);

  if (!showSymbol) {
    return <span className={className}>{formattedAmount}</span>;
  }

  return (
    <span className={cn("inline-flex items-center", className)}>
      {symbolPosition === 'left' && (
        <SaudiRiyalIcon size={iconSize} className="mr-1 text-current" />
      )}
      <span className="amount">{formattedAmount}</span>
      {symbolPosition === 'right' && (
        <SaudiRiyalIcon size={iconSize} className="ml-1 text-current" />
      )}
    </span>
  );
}

// Utility component for analytics dashboard
export function SARAmount({ 
  amount, 
  className,
  iconSize = 16
}: { 
  amount: number | string; 
  className?: string;
  iconSize?: number;
}) {
  const formattedAmount = formatSAR(amount);

  return (
    <span className={cn("inline-flex items-center", className)}>
      <SaudiRiyalIcon size={iconSize} className="mr-1 text-current" />
      <span>{formattedAmount}</span>
    </span>
  );
}