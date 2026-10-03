import { MantineProvider, createTheme } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
import { RouterProvider } from 'react-router-dom';
import { useSession } from '@/hooks/useSession';
import { appBlock } from '@/lib/api/appBlock';
import { setDisplayTimezone } from '@/lib/format';
import { AppBlockedScreen } from './LicenseScreens';
import { queryClient } from './queryClient';
import { router } from './router';

const theme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'md',
  fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  components: {
    Table: { defaultProps: { verticalSpacing: 'sm', highlightOnHover: true } },
  },
});

function SessionEffects() {
  const { status, config } = useSession();
  useEffect(() => {
    setDisplayTimezone(config?.timezone);
  }, [config?.timezone]);
  useEffect(() => {
    // Drops cached data, including protected photos, when the session ends.
    if (status === 'unauthenticated') queryClient.clear();
  }, [status]);
  return null;
}

export function App() {
  const appBlocked = useSyncExternalStore(appBlock.subscribe, appBlock.get);
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <DatesProvider settings={{ locale: 'id', firstDayOfWeek: 1 }}>
        <QueryClientProvider client={queryClient}>
          <ModalsProvider labels={{ confirm: 'Ya', cancel: 'Batal' }}>
            <Notifications position="top-right" />
            <SessionEffects />
            {appBlocked ? <AppBlockedScreen /> : <RouterProvider router={router} />}
          </ModalsProvider>
        </QueryClientProvider>
      </DatesProvider>
    </MantineProvider>
  );
}
