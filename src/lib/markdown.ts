/**
 * The note's Markdown subset.
 *
 * A note is stored as one Markdown string in `items.blurb` — the column it has
 * always used, which is why today's plain-text notes are already valid and
 * need no migration. What the editor and the reader agree on is deliberately
 * small: paragraphs and line breaks, bold, italic, strikethrough, bullet
 * lists, checklists, and links. Headings, images, tables and colour are out on
 * purpose — a note is a note, not a document.
 *
 * This parses to an AST rather than to an HTML string. The renderer turns that
 * AST into React elements, so the allow-list is enforced by construction:
 * there is no point in the pipeline where markup could be injected, and
 * nothing downstream ever calls `dangerouslySetInnerHTML`. Anything the parser
 * doesn't recognise — a `#` heading, a `|` table row, a stray `<script>` —
 * survives as literal text, which is both the safe outcome and the honest one.
 */

export type Inline =
  | { kind: 'text'; value: string }
  | { kind: 'strong'; children: Inline[] }
  | { kind: 'em'; children: Inline[] }
  | { kind: 'del'; children: Inline[] }
  | { kind: 'link'; href: string; children: Inline[] }
  /** A single newline inside a paragraph. */
  | { kind: 'break' };

export type ListItem = {
  /** `null` for a plain bullet, boolean for a checklist item. */
  checked: boolean | null;
  children: Inline[];
};

export type Block =
  | { kind: 'paragraph'; children: Inline[] }
  | { kind: 'list'; items: ListItem[] };

/* --------------------------------------------------------------------- *
 * Links
 * --------------------------------------------------------------------- */

/**
 * Only schemes that can't execute. `javascript:` and `data:` are the two that
 * matter, and an unrecognised scheme is rejected rather than guessed at — a
 * link we won't follow renders as its own text instead.
 */
const SAFE_SCHEME = /^(https?:|mailto:)/i;

export function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed) return false;
  // Protocol-relative and root-relative are fine; a bare scheme is not.
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return true;
  if (!trimmed.includes(':')) return true;
  return SAFE_SCHEME.test(trimmed);
}

/**
 * Bare URLs are linked as typed — the "auto-linked on paste" rule.
 *
 * Anchored, and matched during the inline scan rather than afterwards: a path
 * like `/a_b_c` would otherwise reach the delimiter pass first and come out
 * the far side as `a`, an italic `b`, and `c`.
 */
const BARE_URL = /^https?:\/\/[^\s<>()]+[^\s<>().,;:!?]/i;

/* --------------------------------------------------------------------- *
 * Inline scanning
 *
 * One left-to-right pass. At each position the earliest delimiter that
 * actually closes wins, so `**bold** and *em*` doesn't mis-pair, and an
 * unclosed `**` stays as two asterisks rather than swallowing the rest of the
 * line.
 * --------------------------------------------------------------------- */

type Delimiter = {
  open: string;
  close: string;
  kind: 'strong' | 'em' | 'del';
};

const DELIMITERS: Delimiter[] = [
  { open: '**', close: '**', kind: 'strong' },
  { open: '__', close: '__', kind: 'strong' },
  { open: '~~', close: '~~', kind: 'del' },
  { open: '*', close: '*', kind: 'em' },
  { open: '_', close: '_', kind: 'em' },
];

function parseInline(source: string): Inline[] {
  const nodes: Inline[] = [];
  let text = '';

  const flush = () => {
    if (!text) return;
    nodes.push({ kind: 'text', value: text });
    text = '';
  };

  let at = 0;
  while (at < source.length) {
    const char = source[at];

    // Escapes: a backslash makes the next character literal.
    if (char === '\\' && at + 1 < source.length) {
      text += source[at + 1];
      at += 2;
      continue;
    }

    if (char === '\n') {
      flush();
      nodes.push({ kind: 'break' });
      at += 1;
      continue;
    }

    if (char === 'h' || char === 'H') {
      const url = source.slice(at).match(BARE_URL);
      if (url) {
        flush();
        nodes.push({
          kind: 'link',
          href: url[0],
          children: [{ kind: 'text', value: url[0] }],
        });
        at += url[0].length;
        continue;
      }
    }

    // [label](href)
    if (char === '[') {
      const link = matchLink(source, at);
      if (link) {
        flush();
        nodes.push({
          kind: 'link',
          href: link.href,
          children: parseInline(link.label),
        });
        at = link.end;
        continue;
      }
    }

    const delimiter = matchDelimiter(source, at);
    if (delimiter) {
      flush();
      nodes.push({
        kind: delimiter.kind,
        children: parseInline(delimiter.inner),
      } as Inline);
      at = delimiter.end;
      continue;
    }

    text += char;
    at += 1;
  }

  flush();
  return nodes;
}

function matchLink(
  source: string,
  at: number,
): { label: string; href: string; end: number } | null {
  const labelEnd = source.indexOf(']', at + 1);
  if (labelEnd === -1 || source[labelEnd + 1] !== '(') return null;
  const hrefEnd = source.indexOf(')', labelEnd + 2);
  if (hrefEnd === -1) return null;

  const href = source.slice(labelEnd + 2, hrefEnd).trim();
  if (!isSafeHref(href)) return null;

  return { label: source.slice(at + 1, labelEnd), href, end: hrefEnd + 1 };
}

const WORD = /[\p{L}\p{N}]/u;

function matchDelimiter(
  source: string,
  at: number,
): { kind: 'strong' | 'em' | 'del'; inner: string; end: number } | null {
  for (const delimiter of DELIMITERS) {
    if (!source.startsWith(delimiter.open, at)) continue;

    // `snake_case` is a word, not an italic. Asterisks keep working inside a
    // word, which is the usual Markdown split and the one people rely on.
    if (delimiter.open.startsWith('_') && at > 0 && WORD.test(source[at - 1])) {
      continue;
    }

    const from = at + delimiter.open.length;
    // An empty span (`****`) is not emphasis, it's four asterisks.
    const closeAt = source.indexOf(delimiter.close, from + 1);
    if (closeAt === -1) continue;

    const inner = source.slice(from, closeAt);
    // Emphasis never spans a blank line, and never opens on whitespace.
    if (!inner.trim() || inner.startsWith(' ')) continue;

    return {
      kind: delimiter.kind,
      inner,
      end: closeAt + delimiter.close.length,
    };
  }
  return null;
}

/* --------------------------------------------------------------------- *
 * Block scanning
 * --------------------------------------------------------------------- */

const BULLET = /^\s{0,3}[-*+]\s+(.*)$/;
const TASK = /^\[( |x|X)\]\s*(.*)$/;

/**
 * Markdown → blocks. A blank line ends a paragraph or a list; consecutive
 * non-blank lines inside a paragraph become soft breaks, which is what Enter
 * produces in the editor.
 */
export function parseNote(source: string): Block[] {
  const lines = normalise(source).split('\n');
  const blocks: Block[] = [];

  let paragraph: string[] = [];
  let items: ListItem[] | null = null;

  const endParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: 'paragraph', children: parseInline(paragraph.join('\n')) });
    paragraph = [];
  };

  const endList = () => {
    if (!items) return;
    blocks.push({ kind: 'list', items });
    items = null;
  };

  for (const line of lines) {
    if (!line.trim()) {
      endParagraph();
      endList();
      continue;
    }

    const bullet = line.match(BULLET);
    if (bullet) {
      endParagraph();
      const task = bullet[1].match(TASK);
      const entry: ListItem = task
        ? { checked: task[1].toLowerCase() === 'x', children: parseInline(task[2]) }
        : { checked: null, children: parseInline(bullet[1]) };
      items = items ? [...items, entry] : [entry];
      continue;
    }

    endList();
    paragraph.push(line);
  }

  endParagraph();
  endList();
  return blocks;
}

/**
 * Line endings and trailing whitespace only. Nothing is stripped or rewritten:
 * a note read out and written back unchanged has to come back byte-identical,
 * which is what lets the MCP tools hand the same string around.
 */
export function normalise(source: string): string {
  return source.replace(/\r\n?/g, '\n');
}

/** True when the note has nothing to render — used to pick the empty state. */
export function isEmptyNote(source: string | null | undefined): boolean {
  return !source || !source.trim();
}

/**
 * The constructs the editor deliberately can't render. Not used to reject
 * anything in the UI — they degrade to literal text there — but the MCP
 * surface needs to name them rather than accept them silently.
 */
export function unsupportedConstructs(source: string): string[] {
  const found = new Set<string>();
  for (const line of normalise(source).split('\n')) {
    if (/^\s{0,3}#{1,6}\s/.test(line)) found.add('headings');
    if (/^\s{0,3}(```|~~~)/.test(line)) found.add('code blocks');
    if (/^\s{0,3}>/.test(line)) found.add('block quotes');
    if (/^\s{0,3}\|.*\|/.test(line)) found.add('tables');
    if (/!\[[^\]]*\]\(/.test(line)) found.add('images');
    if (/<[a-z][^>]*>/i.test(line)) found.add('raw HTML');
  }
  return [...found];
}
