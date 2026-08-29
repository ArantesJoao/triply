'use client';

import { Fragment } from 'react';

import { cn } from '@/lib/cn';
import { parseNote, type Block, type Inline } from '@/lib/markdown';

/**
 * Renders a note's Markdown as React elements.
 *
 * Nothing here builds an HTML string, so the tag set the reader can produce is
 * exactly the set written below — `strong`, `em`, `del`, `a`, `p`, `ul`, `li`
 * and `br`. See `lib/markdown.ts` for why that matters.
 */
export function Markdown({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  const blocks = parseNote(source);

  return (
    <div className={cn('prose-note', className)}>
      {blocks.map((block, index) => (
        <BlockNode key={index} block={block} />
      ))}
    </div>
  );
}

function BlockNode({ block }: { block: Block }) {
  if (block.kind === 'paragraph') {
    return (
      <p>
        <InlineNodes nodes={block.children} />
      </p>
    );
  }

  const checklist = block.items.some((item) => item.checked !== null);

  return (
    <ul className={checklist ? 'is-checklist' : undefined}>
      {block.items.map((item, index) => (
        <li key={index} className={item.checked !== null ? 'is-task' : undefined}>
          {item.checked !== null && (
            <input
              type="checkbox"
              checked={item.checked}
              readOnly
              // The note is text; the box mirrors it rather than driving it.
              // Ticking one happens in the editor, where it is a `- [x]` edit.
              tabIndex={-1}
              aria-label={item.checked ? 'Done' : 'Not done'}
            />
          )}
          <span className={item.checked ? 'is-done' : undefined}>
            <InlineNodes nodes={item.children} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function InlineNodes({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((node, index) => (
        <Fragment key={index}>
          <InlineNode node={node} />
        </Fragment>
      ))}
    </>
  );
}

function InlineNode({ node }: { node: Inline }) {
  switch (node.kind) {
    case 'text':
      return <>{node.value}</>;
    case 'break':
      return <br />;
    case 'strong':
      return (
        <strong>
          <InlineNodes nodes={node.children} />
        </strong>
      );
    case 'em':
      return (
        <em>
          <InlineNodes nodes={node.children} />
        </em>
      );
    case 'del':
      return (
        <del>
          <InlineNodes nodes={node.children} />
        </del>
      );
    case 'link':
      return (
        <a
          href={node.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onClick={(event) => event.stopPropagation()}
        >
          <InlineNodes nodes={node.children} />
        </a>
      );
  }
}
