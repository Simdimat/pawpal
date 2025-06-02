import type { SVGProps } from 'react';
import { cn } from '@/lib/utils';

const Logo = ({ className, ...props }: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("lucide lucide-paw-print", className)}
      {...props}
      data-ai-hint="paw print"
    >
      <circle cx="11" cy="4" r="2" />
      <circle cx="18" cy="8" r="2" />
      <circle cx="6" cy="8" r="2" />
      <path d="M16 4.5c2.5 0 4.5 2 4.5 4.5v0c0 2.2-1.7 4-4 4.5h-2.5V9A4.5 4.5 0 0 1 16 4.5Z" />
      <path d="M8 4.5c-2.5 0-4.5 2-4.5 4.5v0c0 2.2 1.7 4 4 4.5h2.5V9A4.5 4.5 0 0 0 8 4.5Z" />
      <path d="M7.1 14.1c-2.3.8-4.1 2.7-4.1 5.4V20h18v-.5c0-2.7-1.8-4.6-4.1-5.4" />
    </svg>
  );
};

export default Logo;
