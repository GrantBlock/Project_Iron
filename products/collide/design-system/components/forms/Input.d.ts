import * as React from 'react';
/** Recessed text field. */
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  icon?: string;
  size?: 'sm' | 'md' | 'lg';
  invalid?: boolean;
  inputStyle?: React.CSSProperties;
}
export declare function Input(props: InputProps): JSX.Element;
