import { Button, Group, Image, Input, Stack, Text } from '@mantine/core';
import { Dropzone, MIME_TYPES } from '@mantine/dropzone';
import { IconPhoto, IconUpload, IconX } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { formatBytes } from '@/lib/format';
import { MAX_PHOTO_BYTES, validateImageFile } from '@/lib/validation';
import { SecureImage } from './SecureImage';

interface Props {
  label: string;
  value: File | null;
  onChange: (file: File | null) => void;
  /** Called with a validation message, or null when the file is valid. */
  onValidation: (message: string | null) => void;
  error?: string;
  required?: boolean;
  existingPath?: string | null;
  existingVersion?: string | null;
}

export function PhotoDropzone({ label, value, onChange, onValidation, error, required, existingPath, existingVersion }: Props) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const accept = async (file: File) => {
    const message = await validateImageFile(file);
    onValidation(message);
    onChange(message ? null : file);
  };

  return (
    <Input.Wrapper label={label} withAsterisk={required} error={error} description="JPEG/PNG, maksimal 5 MB. Foto dipakai untuk validasi wajah.">
      <Group align="flex-start" mt={6} wrap="nowrap">
        <div style={{ width: 120, flexShrink: 0 }}>
          {preview ? (
            <Image src={preview} alt="Pratinjau foto wajah" h={120} w={120} radius="md" fit="cover" />
          ) : existingPath ? (
            <SecureImage path={existingPath} version={existingVersion} alt="Foto wajah saat ini" h={120} w={120} radius="md" fit="cover" />
          ) : (
            <Stack h={120} w={120} align="center" justify="center" bg="gray.1" style={{ borderRadius: 8 }}>
              <IconPhoto color="var(--mantine-color-gray-5)" />
            </Stack>
          )}
        </div>
        <Stack gap={6} style={{ flex: 1 }}>
          <Dropzone
            onDrop={(files) => files[0] && void accept(files[0])}
            onReject={(rejections) => {
              const code = rejections[0]?.errors[0]?.code;
              onValidation(code === 'file-too-large' ? 'Ukuran file maksimal 5 MB.' : 'File harus berupa gambar JPEG atau PNG.');
            }}
            maxSize={MAX_PHOTO_BYTES}
            accept={[MIME_TYPES.jpeg, MIME_TYPES.png]}
            multiple={false}
            aria-label={label}
            p="md"
          >
            <Group justify="center" gap="xs" style={{ pointerEvents: 'none' }}>
              <Dropzone.Accept>
                <IconUpload size={22} />
              </Dropzone.Accept>
              <Dropzone.Reject>
                <IconX size={22} />
              </Dropzone.Reject>
              <Dropzone.Idle>
                <IconPhoto size={22} />
              </Dropzone.Idle>
              <Text size="sm">Seret foto ke sini atau klik untuk memilih</Text>
            </Group>
          </Dropzone>
          {value && (
            <Group gap="xs">
              <Text size="xs" c="dimmed">
                {value.name} · {formatBytes(value.size)}
              </Text>
              <Button size="compact-xs" variant="subtle" color="gray" onClick={() => onChange(null)}>
                Batalkan
              </Button>
            </Group>
          )}
        </Stack>
      </Group>
    </Input.Wrapper>
  );
}
