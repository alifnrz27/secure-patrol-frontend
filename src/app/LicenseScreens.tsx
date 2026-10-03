import { Alert, AppShell, Button, Center, Container, Group, Stack, Text, Title } from '@mantine/core';
import { IconAlertTriangle, IconLock, IconLogout } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { BrandLogo } from '@/components/BrandLogo';
import { useBranding, useDocumentTitle } from '@/hooks/useBranding';
import { useSession } from '@/hooks/useSession';
import { session } from '@/lib/auth/session';
import { licenseBanner } from '@/lib/license';
import { LicensePanel } from '@/pages/settings/LicensePage';

/** Yellow (ends within 30 days) or red (grace period) banner for every role. */
export function LicenseBannerBar() {
  const { license } = useSession();
  const banner = licenseBanner(license);
  if (!banner) return null;
  return (
    <Alert color={banner.color} variant={banner.color === 'red' ? 'filled' : 'light'} icon={<IconAlertTriangle size={18} />} mb="md" radius="md">
      {banner.message}
    </Alert>
  );
}

/** License missing, expired or invalid: the Super-Admin only gets the License page. */
export function LicenseLockedLayout() {
  const { appName } = useBranding();
  const navigate = useNavigate();
  useDocumentTitle('License');
  return (
    <AppShell header={{ height: 60 }} padding="lg">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <BrandLogo size={28} />
            <Text fw={700} size="lg">{appName}</Text>
          </Group>
          <Button
            variant="subtle"
            color="gray"
            leftSection={<IconLogout size={16} />}
            onClick={() => void session.logout().then(() => navigate('/login', { replace: true }))}
          >
            Keluar
          </Button>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Container size="lg" px={0}>
          <Alert color="red" icon={<IconLock size={18} />} title="Sistem terkunci" mb="lg">
            License belum aktif, sehingga hanya Super-Admin yang dapat masuk dan hanya halaman ini yang tersedia. Pasang
            kode license dari vendor untuk membuka semua menu.
          </Alert>
          <Title order={2} mb="md">License</Title>
          <LicensePanel />
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}

/** This web App Client is above the license limit: every request is refused, login included. */
export function AppBlockedScreen() {
  const { appName } = useBranding();
  useDocumentTitle('Melebihi batas license');
  return (
    <Center mih="100vh" p="md">
      <Stack align="center" maw={460} gap="sm">
        <BrandLogo size={48} />
        <Title order={3} ta="center">{appName}</Title>
        <Alert color="red" icon={<IconLock size={18} />} title="Aplikasi ini melebihi batas license">
          Aplikasi web ini tidak dapat digunakan karena jumlah App Client melebihi batas license. Hubungi administrator.
        </Alert>
        <Button variant="light" onClick={() => window.location.reload()}>Coba lagi</Button>
      </Stack>
    </Center>
  );
}
