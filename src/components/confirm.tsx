import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import type { ReactNode } from 'react';

/** Soft-delete confirmation used by every DELETE action. */
export function confirmDelete(options: { title: string; name?: ReactNode; onConfirm: () => void }) {
  modals.openConfirmModal({
    title: options.title,
    centered: true,
    children: (
      <Text size="sm">
        {options.name && (
          <>
            <b>{options.name}</b>
            <br />
          </>
        )}
        Data akan dihapus dan tidak lagi tampil.
      </Text>
    ),
    labels: { confirm: 'Hapus', cancel: 'Batal' },
    confirmProps: { color: 'red' },
    onConfirm: options.onConfirm,
  });
}
