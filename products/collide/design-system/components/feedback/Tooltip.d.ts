import * as React from 'react';
/** Hover label with optional shortcut keycaps. */
export interface TooltipProps { label: string; shortcut?: string; placement?: 'top' | 'bottom'; open?: boolean; children: React.ReactNode; }
export declare function Tooltip(props: TooltipProps): JSX.Element;
