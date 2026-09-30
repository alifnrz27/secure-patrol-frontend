import { Button, Group, Modal, Progress, Stack, Text } from '@mantine/core';
import { useCallback, useRef, useState } from 'react';
import { notifyError, notifySuccess } from '@/lib/notify';

type Progress = { loaded: number; total: number };
type ExportTask = (signal: AbortSignal, onProgress: (loaded: number, total: number) => void) => Promise<number>;

/** Runs a multi-page export with progress and a cancel button. */
export function useExport() {
  const controller = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);

  const run = useCallback(async (task: ExportTask) => {
    const abort = new AbortController();
    controller.current = abort;
    setProgress({ loaded: 0, total: 0 });
    try {
      const rows = await task(abort.signal, (loaded, total) => setProgress({ loaded, total }));
      notifySuccess(`Ekspor selesai: ${rows} baris.`);
    } catch (error) {
      if (!abort.signal.aborted) notifyError(error);
    } finally {
      controller.current = null;
      setProgress(null);
    }
  }, []);

  const cancel = useCallback(() => controller.current?.abort(), []);

  const modal = (
    <Modal opened={progress !== null} onClose={cancel} title="Mengekspor CSV" centered closeOnClickOutside={false}>
      <Stack>
        <Text size="sm">
          Mengambil data {progress?.loaded ?? 0}
          {progress?.total ? ` dari ${progress.total}` : ''} baris…
        </Text>
        <Progress value={progress?.total ? (progress.loaded / progress.total) * 100 : 5} animated aria-label="Progres ekspor" />
        <Group justify="flex-end">
          <Button variant="default" onClick={cancel}>
            Batal
          </Button>
        </Group>
      </Stack>
    </Modal>
  );

  return { run, running: progress !== null, modal };
}
