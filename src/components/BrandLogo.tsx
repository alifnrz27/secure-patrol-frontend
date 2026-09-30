import { IconShieldCheck } from '@tabler/icons-react';
import { useBranding } from '@/hooks/useBranding';

/** Logo set by the Super-Admin, or the built-in shield. */
export function BrandLogo({ size = 26, logoUrl }: { size?: number; /** Override for previews */ logoUrl?: string | null }) {
  const current = useBranding();
  const url = logoUrl === undefined ? current.logoUrl : logoUrl;
  if (!url) return <IconShieldCheck size={size} color="var(--mantine-color-blue-6)" aria-hidden />;
  return <img src={url} alt="" width={size} height={size} style={{ objectFit: 'contain', display: 'block' }} />;
}
