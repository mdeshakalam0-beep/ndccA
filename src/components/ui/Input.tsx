import React, { forwardRef } from 'react';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, error, icon, id, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label htmlFor={id} className="text-xs font-semibold tracking-wide text-foreground/80 select-none">
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full">
          {icon && (
            <div className="absolute left-3.5 text-muted-foreground select-none pointer-events-none">
              {icon}
            </div>
          )}
          <input
            type={type}
            ref={ref}
            id={id}
            className={twMerge(
              'w-full bg-card text-sm h-10 px-3.5 rounded-lg border border-border outline-none transition-all placeholder:text-muted-foreground/60',
              'focus:border-primary focus:ring-1 focus:ring-primary',
              'disabled:bg-muted/40 disabled:text-muted-foreground disabled:cursor-not-allowed',
              icon && 'pl-10',
              error && 'border-destructive focus:border-destructive focus:ring-destructive',
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <span className="text-[11px] font-medium text-destructive leading-none select-none">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
