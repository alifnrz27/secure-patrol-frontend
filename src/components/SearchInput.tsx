import { TextInput } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

/** Search box that reports its value after the user stops typing. */
export function SearchInput({ value, onChange, placeholder = 'Cari…', w = 280 }: { value: string; onChange: (v: string) => void; placeholder?: string; w?: number | string }) {
  const [text, setText] = useState(value);
  const debounced = useDebouncedCallback(onChange, 400);
  useEffect(() => setText(value), [value]);
  return (
    <TextInput
      aria-label={placeholder}
      placeholder={placeholder}
      leftSection={<IconSearch size={16} />}
      value={text}
      w={w}
      onChange={(e) => {
        setText(e.currentTarget.value);
        debounced(e.currentTarget.value.trim());
      }}
    />
  );
}
