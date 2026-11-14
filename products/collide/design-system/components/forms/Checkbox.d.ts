/** Square checkbox; fills signal red when checked. */
export interface CheckboxProps { checked?: boolean; onChange?: (v: boolean) => void; label?: string; disabled?: boolean; }
export declare function Checkbox(props: CheckboxProps): JSX.Element;
