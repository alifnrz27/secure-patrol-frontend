import { useEffect, useRef, useState, type ReactNode } from 'react';
import { copyText } from '@/lib/clipboard';
import { notifyError } from '@/lib/notify';

/**
 * Drop-in for Mantine's CopyButton that also works over plain HTTP (Mantine
 * relies on navigator.clipboard, which browsers only offer on HTTPS/localhost).
 */
export function CopyAction({ value, timeout = 1500, children }: { value: string; timeout?: number; children: (state: { copied: boolean; copy: () => void }) => ReactNode }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = () => {
    void copyText(value).then((ok) => {
      if (!ok) {
        notifyError(null, ['Browser tidak mengizinkan menyalin otomatis. Pilih teksnya lalu tekan Ctrl+C / Cmd+C.']);
        return;
      }
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), timeout);
    });
  };

  return <>{children({ copied, copy })}</>;
}
