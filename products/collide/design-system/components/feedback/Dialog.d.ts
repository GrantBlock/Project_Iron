import * as React from 'react';
/** Modal glass dialog with optional footer actions. */
export interface DialogProps { open?: boolean; title: string; description?: string; children?: React.ReactNode; footer?: React.ReactNode; onClose?: () => void; width?: number; /** render without the fixed backdrop (for docs/previews) */ inline?: boolean; }
export declare function Dialog(props: DialogProps): JSX.Element | null;
