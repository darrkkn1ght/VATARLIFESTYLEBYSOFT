import type { ReactNode } from 'react';
import { cn } from '@/lib/utilities/cn';

type ContainerElement = 'div' | 'section' | 'main' | 'header' | 'footer';

interface PageContainerProps {
  as?: ContainerElement;
  children: ReactNode;
  className?: string;
}

export function PageContainer({
  as: Component = 'div',
  children,
  className,
}: PageContainerProps) {
  return (
    <Component className={cn('mx-auto w-full max-w-7xl px-6 sm:px-8 lg:px-12', className)}>
      {children}
    </Component>
  );
}
