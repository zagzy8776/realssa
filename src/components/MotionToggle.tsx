import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MotionToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'amber' | 'emerald' | 'blue' | 'violet' | 'red';
  className?: string;
}

const SIZE_CONFIG = {
  sm: { track: 'w-8 h-5', thumb: 'w-4 h-4', translate: 12 },
  md: { track: 'w-12 h-7', thumb: 'w-5 h-5', translate: 20 },
  lg: { track: 'w-16 h-9', thumb: 'w-7 h-7', translate: 28 },
};

const COLOR_CONFIG = {
  amber: { on: 'bg-amber-500', off: 'bg-muted', thumbOn: 'bg-amber-50', thumbOff: 'bg-white' },
  emerald: { on: 'bg-emerald-500', off: 'bg-muted', thumbOn: 'bg-emerald-50', thumbOff: 'bg-white' },
  blue: { on: 'bg-blue-500', off: 'bg-muted', thumbOn: 'bg-blue-50', thumbOff: 'bg-white' },
  violet: { on: 'bg-violet-500', off: 'bg-muted', thumbOn: 'bg-violet-50', thumbOff: 'bg-white' },
  red: { on: 'bg-red-500', off: 'bg-muted', thumbOn: 'bg-red-50', thumbOff: 'bg-white' },
};

export const MotionToggle = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  color = 'amber',
  className = '',
}: MotionToggleProps) => {
  const { track, thumb, translate } = SIZE_CONFIG[size];
  const colors = COLOR_CONFIG[color];

  return (
    <div className={cn('flex items-start gap-3', className)}>
      <motion.button
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={cn(
          'relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          disabled && 'opacity-50 cursor-not-allowed',
          checked ? colors.on : colors.off,
          track
        )}
        aria-checked={checked}
        aria-label={label}
        role="switch"
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.02 }}
        style={{ touchAction: 'manipulation' }}
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={checked ? 'on' : 'off'}
            className={cn(
              'pointer-events-none inline-block rounded-full shadow transition-all duration-300',
              checked ? colors.thumbOn : colors.thumbOff,
              thumb
            )}
            initial={{ x: 0, scale: 0.9, opacity: 0 }}
            animate={{ x: checked ? translate : 0, scale: 1, opacity: 1 }}
            exit={{ x: checked ? 0 : translate, scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            style={{ willChange: 'transform, opacity' }}
          >
            {/* Inner glow effect when on */}
            {checked && (
              <motion.div
                className="absolute inset-1 rounded-full"
                style={{ background: 'currentColor', opacity: 0.15 }}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 400, damping: 25 }}
              />
            )}
          </motion.span>

          {/* Track background shimmer */}
          <AnimatePresence mode="wait">
            {checked && (
              <motion.div
                key="shimmer"
                className="absolute inset-0 rounded-full overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </AnimatePresence>
      </motion.button>

      {(label || description) && (
        <div className="flex-1 min-w-0 pt-1">
          {label && (
            <motion.span
              className={cn('text-sm font-medium', disabled ? 'text-muted-foreground/60' : 'text-foreground')}
              animate={{ color: checked ? 'hsl(var(--primary))' : 'inherit' }}
              transition={{ duration: 0.2 }}
            >
              {label}
            </motion.span>
          )}
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * MotionSwitch - Alternative design with icons inside
 */
export const MotionSwitch = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  onIcon,
  offIcon,
  className = '',
}: MotionToggleProps & { onIcon?: React.ReactNode; offIcon?: React.ReactNode }) => {
  const { track, thumb, translate } = SIZE_CONFIG[size];

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <motion.button
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={cn(
          'relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300 overflow-hidden',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          disabled && 'opacity-50 cursor-not-allowed',
          checked ? 'bg-emerald-500' : 'bg-muted',
          track
        )}
        aria-checked={checked}
        aria-label={label}
        role="switch"
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.02 }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={checked ? 'on' : 'off'}
            className="absolute inset-0 flex items-center justify-center px-1 transition-opacity"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {checked ? onIcon : offIcon}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.span
            key={checked ? 'on' : 'off'}
            className={cn(
              'pointer-events-none inline-block rounded-full bg-white shadow transition-all duration-300 flex items-center justify-center',
              thumb
            )}
            initial={{ x: 0, scale: 0.9, rotate: checked ? -90 : 0 }}
            animate={{ x: checked ? translate : 0, scale: 1, rotate: checked ? 0 : 90 }}
            exit={{ x: checked ? 0 : translate, scale: 0.9, rotate: checked ? 90 : -90 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            {checked ? onIcon : offIcon}
          </motion.span>
        </AnimatePresence>
      </motion.button>

      {(label || description) && (
        <div className="flex-1 min-w-0">
          {label && <span className={cn('text-sm font-medium', disabled && 'text-muted-foreground/60')}>{label}</span>}
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      )}
    </div>
  );
};

/**
 * MotionIconButton - Animated icon button for actions
 */
interface MotionIconButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  label?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  animateOnClick?: boolean;
}

const ICON_SIZE = { sm: 16, md: 20, lg: 24 };
const BUTTON_SIZE = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12' };

export const MotionIconButton = ({
  onClick,
  icon,
  label,
  variant = 'secondary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  animateOnClick = true,
}: MotionIconButtonProps) => {
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25',
    secondary: 'bg-card text-foreground border border-border hover:bg-muted hover:border-primary/30',
    ghost: 'bg-transparent text-foreground hover:bg-muted',
    danger: 'bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 hover:border-destructive/30',
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-xl transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        BUTTON_SIZE[size],
        className
      )}
      aria-label={label}
      whileTap={animateOnClick ? { scale: 0.9 } : undefined}
      whileHover={animateOnClick && !disabled && !loading ? { scale: 1.05 } : undefined}
      style={{ touchAction: 'manipulation' }}
    >
      {loading ? (
        <motion.svg
          className={`animate-spin text-current ${ICON_SIZE[size]}`}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <motion.circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <motion.path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.svg>
      ) : (
        <motion.span
          animate={animateOnClick ? { rotate: [0, 10, -10, 0] } : undefined}
          transition={{ duration: 0.4 }}
        >
          {icon}
        </motion.span>
      )}
    </motion.button>
  );
};

/**
 * StaggeredList - Container that animates children with stagger
 */
export const StaggeredList = ({
  children,
  className = '',
  staggerDelay = 0.05,
  delayChildren = 0.1,
  direction = 'y',
}: {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
  delayChildren?: number;
  direction?: 'x' | 'y';
}) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, [direction]: direction === 'y' ? 20 : -20 },
    show: {
      opacity: 1,
      [direction]: 0,
      transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {React.Children.map(children, (child, index) => (
        <motion.div key={index} variants={itemVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
};

/**
 * MotionCard - Card with hover/tap animations
 */
interface MotionCardProps {
  children: React.ReactNode;
  className?: string;
  hoverScale?: number;
  tapScale?: number;
  onClick?: () => void;
  elevated?: boolean;
}

export const MotionCard = ({
  children,
  className = '',
  hoverScale = 1.02,
  tapScale = 0.98,
  onClick,
  elevated = false,
}: MotionCardProps) => {
  return (
    <motion.div
      className={cn(
        'transition-all duration-300',
        elevated && 'shadow-lg shadow-black/20',
        onClick && 'cursor-pointer',
        className
      )}
      whileHover={{ scale: hoverScale, y: -6, boxShadow: elevated ? '0 24px 48px -12px rgba(0,0,0,0.35)' : '0 14px 36px -8px rgba(0,0,0,0.22)' }}
      whileTap={{ scale: tapScale }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      onClick={onClick}
      style={{ willChange: 'transform, box-shadow' }}
    >
      {children}
    </motion.div>
  );
};