import { notifications } from '@mantine/notifications';
import { describeError, translateServerMessage } from '@/lib/api/errors';

export function notifySuccess(message: string): void {
  notifications.show({ color: 'green', message });
}

export function notifyError(error: unknown, extraMessages: string[] = []): void {
  const message = extraMessages.length ? extraMessages.map(translateServerMessage).join(' ') : describeError(error);
  notifications.show({ color: 'red', title: 'Gagal', message });
}
