import * as React from 'react';
/** Sidebar row: icon or thumbnail, label, mono meta line. */
export interface NavItemProps { icon?: string; label: string; meta?: string; active?: boolean; thumb?: boolean; onClick?: () => void; }
export declare function NavItem(props: NavItemProps): JSX.Element;
export interface NavSectionProps { title: string; children?: React.ReactNode; }
export declare function NavSection(props: NavSectionProps): JSX.Element;
