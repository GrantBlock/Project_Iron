import * as React from 'react';
/** Native select in a glass shell. */
export interface SelectProps { value?: string; onChange?: (v: string) => void; options: (string | { value: string; label: string })[]; size?: 'sm' | 'md'; style?: React.CSSProperties; }
export declare function Select(props: SelectProps): JSX.Element;
