/** Segmented control or underline tabs. */
export interface TabsProps { items: (string | { value: string; label: string })[]; value: string; onChange?: (v: string) => void; variant?: 'segmented' | 'underline'; style?: React.CSSProperties; }
export declare function Tabs(props: TabsProps): JSX.Element;
