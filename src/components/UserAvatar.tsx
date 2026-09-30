import { Avatar, type AvatarProps } from '@mantine/core';
import { useSecureImageBlob, useObjectUrl } from './SecureImage';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

interface UserAvatarProps extends Omit<AvatarProps, 'src'> {
  name: string;
  /** Protected photo path; ignored when dataUrl is given. */
  path?: string | null;
  version?: string | null;
  dataUrl?: string | null;
}

export function UserAvatar({ name, path, version, dataUrl, ...props }: UserAvatarProps) {
  const query = useSecureImageBlob(dataUrl ? null : path, version);
  const url = useObjectUrl(query.data);
  return (
    <Avatar src={dataUrl ?? url} alt={`Foto ${name}`} color="blue" {...props}>
      {initials(name)}
    </Avatar>
  );
}
