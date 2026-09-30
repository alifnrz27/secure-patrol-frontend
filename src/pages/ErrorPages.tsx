import { Button, Center, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';

function ErrorPage({ code, title, description }: { code: string; title: string; description: string }) {
  return (
    <Center mih="60vh">
      <Stack align="center" gap="xs">
        <Text fz={64} fw={800} c="gray.4" lh={1}>
          {code}
        </Text>
        <Title order={3}>{title}</Title>
        <Text c="dimmed" ta="center" maw={420}>
          {description}
        </Text>
        <Button component={Link} to="/" mt="sm" variant="light">
          Kembali ke Dashboard
        </Button>
      </Stack>
    </Center>
  );
}

export function ForbiddenPage() {
  return <ErrorPage code="403" title="Anda tidak memiliki akses" description="Role Anda tidak diizinkan membuka halaman ini." />;
}

export function NotFoundPage() {
  return <ErrorPage code="404" title="Halaman tidak ditemukan" description="Halaman yang Anda cari tidak ada atau sudah dipindahkan." />;
}
