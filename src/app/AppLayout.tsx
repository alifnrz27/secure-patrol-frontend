import { AppShell, Burger, Divider, Group, Menu, NavLink, ScrollArea, Text, UnstyledButton } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAdjustments,
  IconApps,
  IconBuilding,
  IconCalendarTime,
  IconChartBar,
  IconChevronDown,
  IconFileText,
  IconHelp,
  IconHistory,
  IconLayoutDashboard,
  IconListCheck,
  IconLogout,
  IconMapPin,
  IconPalette,
  IconSettings,
  IconUser,
  IconUserShield,
  IconUsers,
  IconRadar,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BrandLogo } from '@/components/BrandLogo';
import { UnitPicker } from '@/components/UnitPicker';
import { useBranding } from '@/hooks/useBranding';
import { UserAvatar } from '@/components/UserAvatar';
import { useSession } from '@/hooks/useSession';
import { describeError } from '@/lib/api/errors';
import { session } from '@/lib/auth/session';
import { hasPermission, type Permission } from '@/lib/permissions';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  permission?: Permission;
  /** Sub menu; a parent with one visible child is shown as that single link. */
  children?: NavItem[];
}

const NAV_SECTIONS: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      { to: '/', label: 'Dashboard', icon: <IconLayoutDashboard size={18} /> },
      { to: '/monitoring', label: 'Monitoring Patroli', icon: <IconRadar size={18} /> },
      { to: '/checkpoints', label: 'Titik per Shift/Periode', icon: <IconListCheck size={18} /> },
      { to: '/scans', label: 'Riwayat Scan', icon: <IconHistory size={18} /> },
      { to: '/reports', label: 'Laporan', icon: <IconChartBar size={18} /> },
    ],
  },
  {
    title: 'Master Data',
    items: [
      { to: '/units', label: 'Unit', icon: <IconBuilding size={18} />, permission: 'viewUnits' },
      { to: '/patrol-points', label: 'Titik Patroli', icon: <IconMapPin size={18} />, permission: 'viewPatrolPoints' },
      { to: '/shifts', label: 'Pengaturan Shift', icon: <IconCalendarTime size={18} />, permission: 'viewShifts' },
      { to: '/users', label: 'Pengguna', icon: <IconUsers size={18} />, permission: 'viewUsers' },
      { to: '/roles', label: 'Role', icon: <IconUserShield size={18} />, permission: 'viewRoles' },
      { to: '/app-clients', label: 'App Client', icon: <IconApps size={18} />, permission: 'manageAppClients' },
      { to: '/audit-logs', label: 'Log Aktivitas', icon: <IconFileText size={18} />, permission: 'viewAuditLogs' },
      {
        to: '/settings',
        label: 'Pengaturan',
        icon: <IconSettings size={18} />,
        children: [
          { to: '/settings', label: 'Pengaturan Sistem', icon: <IconAdjustments size={16} />, permission: 'viewSettings' },
          { to: '/settings/branding', label: 'Tampilan Aplikasi', icon: <IconPalette size={16} />, permission: 'manageBranding' },
        ],
      },
    ],
  },
  {
    title: 'Lainnya',
    items: [
      { to: '/help-desk', label: 'Help Desk', icon: <IconHelp size={18} /> },
      { to: '/profile', label: 'Profil', icon: <IconUser size={18} /> },
    ],
  },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [opened, { toggle, close }] = useDisclosure();
  const { user, avatarDataUrl } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const role = user?.role.code;
  const { appName } = useBranding();

  const isActive = (to: string) => (to === '/' ? location.pathname === '/' : location.pathname.startsWith(to));
  // Sub menu links share a prefix (/settings, /settings/branding), so they match exactly.
  const isExact = (to: string) => location.pathname === to;
  const allowed = (item: NavItem) => !item.permission || hasPermission(role, item.permission);

  async function logout() {
    try {
      await session.logout();
      navigate('/login', { replace: true });
    } catch (error) {
      notifications.show({ color: 'red', message: describeError(error) });
    }
  }

  return (
    <AppShell header={{ height: 60 }} navbar={{ width: 260, breakpoint: 'md', collapsed: { mobile: !opened } }} padding="lg">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="md" size="sm" aria-label="Buka menu" />
            <BrandLogo size={28} />
            <Text fw={700} size="lg" truncate maw={320}>
              {appName}
            </Text>
          </Group>
          {user && (
            <Group gap="md" wrap="nowrap">
              <UnitPicker />
              <Menu position="bottom-end" width={220} withinPortal>
                <Menu.Target>
                  <UnstyledButton aria-label="Menu akun">
                    <Group gap="xs">
                      <UserAvatar
                        name={user.name}
                        dataUrl={avatarDataUrl}
                        path={user.face_photo_url ? '/api/v1/auth/me/face-photo' : null}
                        version={user.face_photo_updated_at}
                        size={34}
                        radius="xl"
                      />
                      <div style={{ lineHeight: 1.1 }}>
                        <Text size="sm" fw={600}>
                          {user.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {user.role.name}
                        </Text>
                      </div>
                      <IconChevronDown size={14} />
                    </Group>
                  </UnstyledButton>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item component={Link} to="/profile" leftSection={<IconUser size={16} />}>
                    Profil
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={() => void logout()}>
                    Keluar
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          )}
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm" component="nav" aria-label="Menu utama">
        <ScrollArea>
          {NAV_SECTIONS.map((section, index) => {
            const items = section.items
              .map((item) => {
                if (!item.children) return allowed(item) ? item : null;
                const children = item.children.filter(allowed);
                if (children.length === 0) return null;
                if (children.length === 1) return { ...children[0]!, label: item.label, icon: item.icon };
                return { ...item, children };
              })
              .filter((item): item is NavItem => item !== null);
            if (items.length === 0) return null;
            return (
              <div key={section.title ?? index}>
                {section.title && (
                  <>
                    <Divider my="xs" />
                    <Text size="xs" fw={700} c="dimmed" tt="uppercase" px="sm" py={4}>
                      {section.title}
                    </Text>
                  </>
                )}
                {items.map((item) =>
                  item.children ? (
                    <NavLink
                      key={item.label}
                      // A real button, so the group opens with the keyboard (NavLink defaults to <a> without href).
                      component="button"
                      type="button"
                      label={item.label}
                      leftSection={item.icon}
                      defaultOpened={isActive(item.to)}
                      style={{ borderRadius: 6 }}
                    >
                      {item.children.map((child) => (
                        <NavLink
                          key={child.to}
                          component={Link}
                          to={child.to}
                          label={child.label}
                          leftSection={child.icon}
                          active={isExact(child.to)}
                          onClick={close}
                          style={{ borderRadius: 6 }}
                        />
                      ))}
                    </NavLink>
                  ) : (
                    <NavLink
                      key={item.to}
                      component={Link}
                      to={item.to}
                      label={item.label}
                      leftSection={item.icon}
                      active={isActive(item.to)}
                      onClick={close}
                      style={{ borderRadius: 6 }}
                    />
                  ),
                )}
              </div>
            );
          })}
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
