import { ReactNode, forwardRef } from 'react';
import { cn } from './utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  glass?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ children, className, glass = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl border border-white/5 bg-surface-100",
          glass && "bg-surface-100/60 backdrop-blur-md shadow-lg",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export { Card };
