/** Transient glass notification, bottom-right. */
export interface ToastProps { tone?: 'neutral' | 'success' | 'error' | 'info'; title: string; description?: string; action?: string; onAction?: () => void; onClose?: () => void; }
export declare function Toast(props: ToastProps): JSX.Element;
