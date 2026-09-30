import { Center, Image, Skeleton, type ImageProps } from '@mantine/core';
import { IconPhotoOff } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiFetchBlob } from '@/lib/api/client';

/** Query key prefix for protected images; cleared on logout (never persisted). */
export const SECURE_IMAGE_KEY = 'secure-image';

export function useSecureImageBlob(path: string | null | undefined, version?: string | null) {
  return useQuery({
    queryKey: [SECURE_IMAGE_KEY, path, version ?? null],
    queryFn: ({ signal }) => apiFetchBlob(path!, { signal }),
    enabled: Boolean(path),
    staleTime: 5 * 60_000,
    gcTime: 5 * 60_000,
    retry: (count, error) => count < 1 && !(error as { status?: number }).status,
  });
}

/** Creates an object URL for the blob and revokes it on change/unmount. */
export function useObjectUrl(blob: Blob | undefined): string | null {
  // Created inside the effect so every revoke is paired with its own create
  // (StrictMode runs effects twice; a memoized URL would be revoked and reused).
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}

interface SecureImageProps extends Omit<ImageProps, 'src'> {
  /** API path, e.g. /api/v1/users/6/face-photo */
  path: string | null | undefined;
  alt: string;
  /** Changes the cache key when the image is replaced (e.g. face_photo_updated_at). */
  version?: string | null;
  onClick?: () => void;
}

/**
 * Image behind signature + token: fetched with apiFetch as a blob and shown via
 * an object URL. Kept only in the in-memory query cache.
 */
export function SecureImage({ path, alt, version, h, w, onClick, ...props }: SecureImageProps) {
  const query = useSecureImageBlob(path, version);
  const url = useObjectUrl(query.data);

  if (!path || query.isError) {
    return (
      <Center h={h} w={w} bg="var(--mantine-color-gray-1)" style={{ borderRadius: props.radius ? undefined : 4 }} aria-label={`${alt} tidak tersedia`}>
        <IconPhotoOff size={20} color="var(--mantine-color-gray-5)" />
      </Center>
    );
  }
  if (!url) return <Skeleton h={h} w={w} radius={props.radius} />;
  return (
    <Image
      src={url}
      alt={alt}
      h={h}
      w={w}
      onClick={onClick}
      style={onClick ? { cursor: 'zoom-in' } : undefined}
      {...props}
    />
  );
}
