import * as React from 'react';
/**
 * Collide's text button. One primary (signal red) per view.
 * @startingPoint section="Actions" subtitle="Primary, secondary, ghost, outline, danger" viewport="700x200"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  /** Lucide icon name, leading */
  icon?: string;
  /** Lucide icon name, trailing */
  iconRight?: string;
}
export declare function Button(props: ButtonProps): JSX.Element;
