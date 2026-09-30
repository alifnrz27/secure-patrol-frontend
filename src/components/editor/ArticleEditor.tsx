import { ActionIcon, Button, Divider, Group, Input, Paper, Popover, Stack, Text, TextInput, Tooltip, TypographyStylesProvider } from '@mantine/core';
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBlockquote,
  IconBold,
  IconCode,
  IconColumnInsertRight,
  IconColumnRemove,
  IconH2,
  IconH3,
  IconItalic,
  IconLink,
  IconLinkOff,
  IconList,
  IconListNumbers,
  IconRowInsertBottom,
  IconRowRemove,
  IconSeparatorHorizontal,
  IconStrikethrough,
  IconTable,
  IconTableOff,
} from '@tabler/icons-react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import { useState, type ReactNode } from 'react';
import Placeholder from '@tiptap/extension-placeholder';
import { articleExtensions, getArticleMarkdown, isSafeUrl, sanitizeLinks } from './extensions';

function ToolButton({ label, icon, onClick, active, disabled }: { label: string; icon: ReactNode; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <Tooltip label={label} withArrow openDelay={300}>
      <ActionIcon
        variant={active ? 'light' : 'subtle'}
        color={active ? 'blue' : 'gray'}
        onClick={onClick}
        // Keep focus and selection in the editor, so typing continues right after a click.
        onMouseDown={(e) => e.preventDefault()}
        disabled={disabled}
        aria-label={label}
        aria-pressed={active}
        size="md"
      >
        {icon}
      </ActionIcon>
    </Tooltip>
  );
}

function LinkButton({ editor, active }: { editor: Editor; active: boolean }) {
  const [opened, setOpened] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const open = () => {
    setUrl(String(editor.getAttributes('link').href ?? ''));
    setError(null);
    setOpened(true);
  };
  const apply = () => {
    const value = url.trim();
    const href = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
    if (!value || !isSafeUrl(href)) {
      setError('Gunakan alamat http(s):// atau mailto:');
      return;
    }
    const chain = editor.chain().focus().extendMarkRange('link');
    if (editor.state.selection.empty && !active) chain.insertContent({ type: 'text', text: value, marks: [{ type: 'link', attrs: { href } }] }).run();
    else chain.setLink({ href }).run();
    setOpened(false);
  };

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom" withArrow trapFocus shadow="md">
      <Popover.Target>
        <div>
          <ToolButton label="Tautan" icon={<IconLink size={16} />} onClick={open} active={active} />
        </div>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs" w={280}>
          <TextInput
            label="Alamat tautan"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                apply();
              }
            }}
            error={error}
            data-autofocus
          />
          <Group justify="flex-end" gap="xs">
            <Button size="xs" variant="default" onClick={() => setOpened(false)}>
              Batal
            </Button>
            <Button size="xs" onClick={apply}>
              Simpan
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      link: e.isActive('link'),
      table: e.isActive('table'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const run = (fn: (c: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => () => fn(editor.chain().focus()).run();

  return (
    <Group gap={2} p={6} role="toolbar" aria-label="Format teks" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)', position: 'sticky', top: 0, zIndex: 1, background: 'var(--mantine-color-body)' }}>
      <ToolButton label="Tebal (Ctrl+B)" icon={<IconBold size={16} />} onClick={run((c) => c.toggleBold())} active={state.bold} />
      <ToolButton label="Miring (Ctrl+I)" icon={<IconItalic size={16} />} onClick={run((c) => c.toggleItalic())} active={state.italic} />
      <ToolButton label="Coret" icon={<IconStrikethrough size={16} />} onClick={run((c) => c.toggleStrike())} active={state.strike} />
      <ToolButton label="Kode" icon={<IconCode size={16} />} onClick={run((c) => c.toggleCode())} active={state.code} />
      <Divider orientation="vertical" mx={4} />
      <ToolButton label="Judul besar" icon={<IconH2 size={16} />} onClick={run((c) => c.toggleHeading({ level: 2 }))} active={state.h2} />
      <ToolButton label="Judul kecil" icon={<IconH3 size={16} />} onClick={run((c) => c.toggleHeading({ level: 3 }))} active={state.h3} />
      <Divider orientation="vertical" mx={4} />
      <ToolButton label="Daftar berbutir" icon={<IconList size={16} />} onClick={run((c) => c.toggleBulletList())} active={state.bullet} />
      <ToolButton label="Daftar bernomor" icon={<IconListNumbers size={16} />} onClick={run((c) => c.toggleOrderedList())} active={state.ordered} />
      <ToolButton label="Kutipan" icon={<IconBlockquote size={16} />} onClick={run((c) => c.toggleBlockquote())} active={state.quote} />
      <ToolButton label="Garis pemisah" icon={<IconSeparatorHorizontal size={16} />} onClick={run((c) => c.setHorizontalRule())} />
      <Divider orientation="vertical" mx={4} />
      <LinkButton editor={editor} active={state.link} />
      <ToolButton label="Hapus tautan" icon={<IconLinkOff size={16} />} onClick={run((c) => c.extendMarkRange('link').unsetLink())} disabled={!state.link} />
      <Divider orientation="vertical" mx={4} />
      {state.table ? (
        <>
          <ToolButton label="Tambah baris" icon={<IconRowInsertBottom size={16} />} onClick={run((c) => c.addRowAfter())} />
          <ToolButton label="Tambah kolom" icon={<IconColumnInsertRight size={16} />} onClick={run((c) => c.addColumnAfter())} />
          <ToolButton label="Hapus baris" icon={<IconRowRemove size={16} />} onClick={run((c) => c.deleteRow())} />
          <ToolButton label="Hapus kolom" icon={<IconColumnRemove size={16} />} onClick={run((c) => c.deleteColumn())} />
          <ToolButton label="Hapus tabel" icon={<IconTableOff size={16} />} onClick={run((c) => c.deleteTable())} />
        </>
      ) : (
        <ToolButton label="Sisipkan tabel" icon={<IconTable size={16} />} onClick={run((c) => c.insertTable({ rows: 3, cols: 2, withHeaderRow: true }))} />
      )}
      <Divider orientation="vertical" mx={4} />
      <ToolButton label="Urungkan (Ctrl+Z)" icon={<IconArrowBackUp size={16} />} onClick={run((c) => c.undo())} disabled={!state.canUndo} />
      <ToolButton label="Ulangi (Ctrl+Shift+Z)" icon={<IconArrowForwardUp size={16} />} onClick={run((c) => c.redo())} disabled={!state.canRedo} />
    </Group>
  );
}

interface Props {
  label: string;
  /** Markdown; only read when the editor is created. */
  initialValue: string;
  onChange: (markdown: string) => void;
  length: number;
  maxLength: number;
  error?: string;
}

/**
 * WYSIWYG editor (Tiptap, bundled from npm) that reads and writes Markdown,
 * the format the backend stores and the mobile app renders.
 */
export function ArticleEditor({ label, initialValue, onChange, length, maxLength, error }: Props) {
  const editor = useEditor({
    extensions: [...articleExtensions(), Placeholder.configure({ placeholder: 'Tulis isi artikel…' })],
    content: initialValue,
    contentType: 'markdown',
    immediatelyRender: true,
    editorProps: { attributes: { 'aria-label': label, 'aria-multiline': 'true', role: 'textbox', class: 'article-editor__content' } },
    onCreate: ({ editor: e }) => sanitizeLinks(e),
    onUpdate: ({ editor: e }) => onChange(getArticleMarkdown(e)),
  });

  return (
    <Input.Wrapper label={label} withAsterisk error={error} description={`${length.toLocaleString('id-ID')}/${maxLength.toLocaleString('id-ID')} karakter`}>
      <Paper withBorder radius="md" mt={4} style={{ borderColor: error ? 'var(--mantine-color-error)' : undefined }}>
        {editor && <Toolbar editor={editor} />}
        <TypographyStylesProvider px="md" py="xs" className="article-editor">
          <EditorContent editor={editor} />
        </TypographyStylesProvider>
      </Paper>
      <Text size="xs" c="dimmed" mt={4}>
        Format yang tersedia mengikuti yang bisa ditampilkan aplikasi mobile.
      </Text>
    </Input.Wrapper>
  );
}
