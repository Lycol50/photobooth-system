import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

type ButtonProps = {
  children: ReactNode;
  icon?: ReactNode;
  iconAfter?: ReactNode;
  loading?: boolean;
  variant?: ButtonVariant;
  wide?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className = '',
    disabled,
    icon,
    iconAfter,
    loading = false,
    type = 'button',
    variant = 'primary',
    wide = false,
    ...props
  },
  ref,
) {
  return (
    <button
      aria-busy={loading ? 'true' : undefined}
      className={`button button--${variant}${wide ? ' button--wide' : ''} ${className}`.trim()}
      disabled={disabled ? true : loading}
      ref={ref}
      type={type}
      {...props}
    >
      {icon ? <span className="button__icon">{icon}</span> : null}
      <span className="button__label">{children}</span>
      {loading ? <span className="sr-only">Loading</span> : null}
      {iconAfter ? <span className="button__icon">{iconAfter}</span> : null}
    </button>
  );
});
