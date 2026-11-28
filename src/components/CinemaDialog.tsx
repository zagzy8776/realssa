import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export default function CinemaDialog({ label, player = false, onDismiss, children }: {
  label: string;
  player?: boolean;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement;
    dialog.showModal();
    dialog.focus({ preventScroll: true });
    return () => {
      dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <dialog ref={ref} tabIndex={-1} aria-label={label}
      className={player ? 'cinema-dialog cinema-dialog--player' : 'cinema-dialog'}
      onCancel={event => { event.preventDefault(); onDismiss(); }}>
      {children}
    </dialog>,
    document.body
  );
}
