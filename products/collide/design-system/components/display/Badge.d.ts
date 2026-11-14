import * as React from 'react';
/** Mono uppercase status label. */
export interface BadgeProps { tone?: 'neutral' | 'accent' | 'info' | 'success' | 'warning'; dot?: boolean; children?: React.ReactNode; style?: React.CSSProperties; }
export declare function Badge(props: BadgeProps): JSX.Element;
