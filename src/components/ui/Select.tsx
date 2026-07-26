import React, { forwardRef } from 'react';
import { twMerge } from 'tailwind-merge';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, error, placeholder, id, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label htmlFor={id} className="text-xs font-semibold tracking-wide text-foreground/80 select-none">
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full">
          <select
            ref={ref}
            id={id}
            className={twMerge(
              'w-full bg-card text-sm h-10 pl-3.5 pr-10 rounded-lg border border-border outline-none appearance-none transition-all cursor-pointer',
              'focus:border-primary focus:ring-1 focus:ring-primary',
              'disabled:bg-muted/40 disabled:text-muted-foreground disabled:cursor-not-allowed',
              error && 'border-destructive focus:border-destructive focus:ring-destructive',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3.5 text-muted-foreground/60 select-none pointer-events-none">
            <ChevronDown className="h-4 w-4" />
          </div>
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

Select.displayName = 'Select';

export default Select;
