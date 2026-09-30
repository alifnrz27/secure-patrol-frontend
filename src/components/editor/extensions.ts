import { Extension, type Editor, type Extensions } from '@tiptap/core';
import { TableKit } from '@tiptap/extension-table';
import { Markdown } from '@tiptap/markdown';
import { Plugin, type EditorState, type Transaction } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';

const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:'];

export function isSafeUrl(url: string): boolean {
  try {
    return SAFE_PROTOCOLS.includes(new URL(url, 'https://placeholder.invalid').protocol);
  } catch {
    return false;
  }
}

function stripUnsafeLinks(state: EditorState): Transaction | null {
  const link = state.schema.marks.link;
  if (!link) return null;
  let tr: Transaction | null = null;
  state.doc.descendants((node, pos) => {
    for (const mark of node.marks) {
      if (mark.type === link && !isSafeUrl(String(mark.attrs.href ?? ''))) {
        tr = (tr ?? state.tr).removeMark(pos, pos + node.nodeSize, mark);
      }
    }
  });
  return tr;
}

/** Removes unsafe links (javascript:, data:, ...) from the document. */
export function sanitizeLinks(editor: Editor): void {
  const tr = stripUnsafeLinks(editor.state);
  if (tr) editor.view.dispatch(tr);
}

/** Markdown to store: always sanitized, because the Markdown parser skips link validation. */
export function getArticleMarkdown(editor: Editor): string {
  sanitizeLinks(editor);
  return editor.getMarkdown();
}

/** Also strips unsafe links typed or pasted while editing. */
const SafeLinks = Extension.create({
  name: 'safeLinks',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (transactions, _old, state) => (transactions.some((t) => t.docChanged) ? stripUnsafeLinks(state) : null),
      }),
    ];
  },
});

/**
 * Editor features limited to what Markdown can store (the backend keeps
 * Markdown and the mobile app renders it): no underline, colors or alignment.
 */
export function articleExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      underline: false,
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        isAllowedUri: (url, ctx) => isSafeUrl(url) && ctx.defaultValidate(url),
      },
    }),
    TableKit.configure({ table: { resizable: false } }),
    Markdown,
    SafeLinks,
  ];
}
