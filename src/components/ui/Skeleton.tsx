import React from 'react';
import { twMerge } from 'tailwind-merge';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => {
  return (
    <div
      className={twMerge(
        'rounded-md bg-muted/60 animate-shimmer relative overflow-hidden',
        className
      )}
      {...props}
    />
  );
};

export default Skeleton;
