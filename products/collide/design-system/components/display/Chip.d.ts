import * as React from 'react';
/** Pill chip for prompt modifiers and filters. */
export interface ChipProps { children?: React.ReactNode; onRemove?: () => void; selected?: boolean; onClick?: () => void; style?: React.CSSProperties; }
export declare function Chip(props: ChipProps): JSX.Element;
