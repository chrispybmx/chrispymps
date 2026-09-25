import { useEffect, type RefObject } from 'react';
export function useDialogFocus(open: boolean, ref: RefObject<HTMLElement>, onClose: () => void) {
  useEffect(() => {
    if (!open || !ref.current) return;
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex="0"]')).filter(el => el.getClientRects().length > 0);
    focusables()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const list = focusables(), first = list[0], last = list[list.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); if (previous?.isConnected) previous.focus(); };
  // Closing callbacks are inline at call sites; rerunning would steal focus on every input.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ref]);
}
