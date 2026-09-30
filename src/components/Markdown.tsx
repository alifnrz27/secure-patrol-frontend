import { TypographyStylesProvider } from '@mantine/core';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// No rehype-raw and no dangerouslySetInnerHTML: raw HTML in the source (e.g.
// <script>) is shown as escaped text, and react-markdown strips javascript: URLs. External
// images are shown as text because the CSP only allows our own images.
export function Markdown({ children }: { children: string }) {
  return (
    <TypographyStylesProvider>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer nofollow" />,
          img: ({ node: _node, alt }) => <span>[gambar: {alt}]</span>,
        }}
      >
        {children}
      </ReactMarkdown>
    </TypographyStylesProvider>
  );
}
