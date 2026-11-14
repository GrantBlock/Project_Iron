import * as React from 'react';
/**
 * The Collide surface: translucent fill + gradient hairline border + inner top lip.
 * @startingPoint section="Surfaces" subtitle="Glass panel with header" viewport="700x220"
 */
export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** solid = opaque-ish app panel; floating = blurred overlay with deeper shadow */
  variant?: 'solid' | 'floating';
  radius?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** signal-red edge for the active/focused panel */
  glow?: boolean;
  pattern?: 'dots' | 'hatch' | 'grid' | 'dots-fine';
  padding?: number | string;
}
export declare function GlassPanel(props: GlassPanelProps): JSX.Element;
export interface PanelHeaderProps { title: string; children?: React.ReactNode; style?: React.CSSProperties; }
export declare function PanelHeader(props: PanelHeaderProps): JSX.Element;
