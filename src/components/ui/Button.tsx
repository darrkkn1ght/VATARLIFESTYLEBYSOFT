import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/lib/utilities/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface BaseButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  className?: string;
}

type NativeButtonProps = BaseButtonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    to?: undefined;
  };

type RouterLinkButtonProps = BaseButtonProps &
  Omit<LinkProps, 'className' | 'children'> & {
    to: string;
  };

export type ButtonProps = NativeButtonProps | RouterLinkButtonProps;

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-gold text-brand-black border border-brand-gold hover:bg-brand-gold-hover hover:border-brand-gold-hover',
  secondary:
    'bg-transparent text-brand-cream border border-brand-cream/30 hover:border-brand-gold hover:text-brand-gold',
  ghost:
    'bg-transparent text-brand-muted border border-transparent hover:text-brand-white',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-xs tracking-[0.16em]',
  md: 'px-6 py-3 text-xs tracking-[0.18em]',
  lg: 'px-8 py-4 text-sm tracking-[0.18em]',
};

const baseStyles =
  'inline-flex items-center justify-center gap-2 font-heading font-medium uppercase transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold disabled:pointer-events-none disabled:opacity-50 cursor-pointer';

export function Button(props: ButtonProps) {
  const { variant = 'primary', size = 'md', className, children } = props;
  const classes = cn(baseStyles, variantStyles[variant], sizeStyles[size], className);

  if (typeof props.to === 'string') {
    const {
      to,
      variant: _variant,
      size: _size,
      className: _className,
      children: _children,
      ...linkRest
    } = props;

    return (
      <Link to={to} className={classes} {...linkRest}>
        {children}
      </Link>
    );
  }

  const {
    type = 'button',
    variant: _variant,
    size: _size,
    className: _className,
    children: _children,
    ...buttonRest
  } = props;

  return (
    <button type={type} className={classes} {...buttonRest}>
      {children}
    </button>
  );
}
