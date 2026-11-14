import * as React from 'react';
/** Square icon-only button for toolbars. Always pass `label` for a11y. */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'glass' | 'solid' | 'round';
  /** Selected tool state */
  active?: boolean;
}
export declare function IconButton(props: IconButtonProps): JSX.Element;
