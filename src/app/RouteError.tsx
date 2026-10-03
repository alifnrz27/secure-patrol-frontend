import { Button, Center, Code, Group, Stack, Text, Title } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { NotFoundPage } from '@/pages/ErrorPages';

/** Shown instead of React Router's developer screen when a page crashes. */
export function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  const message = error instanceof Error ? error.message : String(error);
  return (
    <Center mih="70vh" p="md">
      <Stack align="center" gap="sm" maw={520}>
        <IconAlertTriangle size={40} color="var(--mantine-color-orange-6)" />
        <Title order={3} ta="center">Halaman ini mengalami masalah</Title>
        <Text c="dimmed" ta="center">Coba muat ulang halaman. Jika masih terjadi, laporkan pesan di bawah ini ke admin sistem.</Text>
        <Code block w="100%">{message}</Code>
        <Group>
          <Button onClick={() => window.location.reload()}>Muat ulang</Button>
          <Button variant="default" onClick={() => window.location.assign('/')}>Ke Dashboard</Button>
        </Group>
      </Stack>
    </Center>
  );
}
