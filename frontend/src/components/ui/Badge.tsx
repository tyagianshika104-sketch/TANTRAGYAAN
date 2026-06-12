import { forwardRef } from 'react';
import { cn } from './utils';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'purple' | 'glass';
}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variants = {
      default: "bg-surface-200 text-zinc-300",
      success: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
      warning: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
      purple: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
      glass: "bg-white/5 backdrop-blur-md border border-white/10 text-zinc-300",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
          variants[variant],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
