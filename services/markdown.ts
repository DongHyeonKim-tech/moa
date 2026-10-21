export type Selection = {
  start: number;
  end: number;
};

export type MarkdownAction = 'h1' | 'h2' | 'h3' | 'bold' | 'italic' | 'bullet' | 'number' | 'task' | 'quote' | 'hr' | 'link';

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'link'; text: string; href: string };

export type MarkdownBlock =
  | { type: 'h1' | 'h2' | 'h3'; inlines: Inline[] }
  | { type: 'paragraph'; inlines: Inline[] }
  | { type: 'bullet'; items: Inline[][] }
  | { type: 'number'; items: Inline[][] }
  | { type: 'task'; items: { checked: boolean; inlines: Inline[]; line: number }[] }
  | { type: 'quote'; inlines: Inline[] }
  | { type: 'hr' }
  | { type: 'image'; alt: string; attachmentId: string };

const IMAGE_LINE = /^!\[([^\]]*)\]\(attachment:([A-Za-z0-9-]+)\)$/;
const HEADING_LINE = /^(#{1,3})\s+(.*)$/;
const TASK_LINE = /^[-*]\s+\[([ xX])\]\s+(.*)$/;
const BULLET_LINE = /^[-*]\s+(.*)$/;
const NUMBER_LINE = /^\d+\.\s+(.*)$/;
const QUOTE_LINE = /^>\s?(.*)$/;

export function applyMarkdownAction(
  source: string,
  selection: Selection,
  action: MarkdownAction,
  extra?: { url?: string },
): { text: string; selection: Selection } {
  if (action === 'bold') {
    return wrapSelection(source, selection, '**', '**', '굵은 글씨');
  }
  if (action === 'italic') {
    return wrapSelection(source, selection, '*', '*', '기울인 글씨');
  }
  if (action === 'hr') {
    return insertSnippet(source, selection, '\n\n---\n\n');
  }
  if (action === 'link') {
    const url = extra?.url?.trim() ?? '';
    const selected = selectedText(source, selection);
    const label = selected || '링크';
    return insertSnippet(source, selection, `[${label}](${url})`);
  }
  if (action === 'h1' || action === 'h2' || action === 'h3') {
    const marker = action === 'h1' ? '# ' : action === 'h2' ? '## ' : '### ';
    return prefixLines(source, selection, (line) => `${marker}${line.replace(/^#{1,3}\s+/, '')}`);
  }
  if (action === 'bullet') {
    return prefixLines(source, selection, (line) => `- ${line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '')}`);
  }
  if (action === 'number') {
    let index = 1;
    return prefixLines(source, selection, (line) => {
      const next = `${index}. ${line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '')}`;
      index += 1;
      return next;
    });
  }
  if (action === 'task') {
    return prefixLines(source, selection, (line) => `- [ ] ${line.replace(/^[-*]\s+\[[ xX]\]\s+/, '').replace(/^[-*]\s+/, '')}`);
  }
  return prefixLines(source, selection, (line) => `> ${line.replace(/^>\s?/, '')}`);
}

export function insertSnippet(source: string, selection: Selection, snippet: string): { text: string; selection: Selection } {
  const { start, end } = ordered(selection);
  const text = source.slice(0, start) + snippet + source.slice(end);
  const cursor = start + snippet.length;
  return { text, selection: { start: cursor, end: cursor } };
}

export function insertImageMarkdown(source: string, selection: Selection, attachmentId: string): { text: string; selection: Selection } {
  const start = ordered(selection).start;
  const needsBreak = start > 0 && source[start - 1] !== '\n';
  const snippet = `${needsBreak ? '\n' : ''}![사진](attachment:${attachmentId})\n`;
  return insertSnippet(source, selection, snippet);
}

export type EditorPiece =
  | { kind: 'text'; text: string; hiddenStart: number; hiddenEnd: number }
  | { kind: 'image'; id: string; alt: string; raw: string };

export function editorPieces(source: string): EditorPiece[] {
  const pieces: EditorPiece[] = [];
  let cursor = 0;

  for (const match of source.matchAll(/!\[([^\]]*)\]\(attachment:([A-Za-z0-9-]+)\)/g)) {
    const start = match.index ?? 0;
    pushEditorText(pieces, source.slice(cursor, start), true);
    pieces.push({
      kind: 'image',
      id: match[2] ?? '',
      alt: match[1] || '사진',
      raw: match[0],
    });
    cursor = start + match[0].length;
  }

  const tail = source.slice(cursor);
  if (tail.length > 0 || pieces.length === 0 || pieces[pieces.length - 1]?.kind === 'image') {
    pushEditorText(pieces, tail, false);
  }
  return pieces;
}

export function shownText(piece: Extract<EditorPiece, { kind: 'text' }>): string {
  const end = piece.text.length - piece.hiddenEnd;
  return piece.text.slice(piece.hiddenStart, Math.max(piece.hiddenStart, end));
}

export function markdownFromPieces(pieces: readonly EditorPiece[]): string {
  return pieces.map((piece) => (piece.kind === 'text' ? piece.text : piece.raw)).join('');
}

export function replaceShownText(pieces: readonly EditorPiece[], index: number, shown: string): string {
  return markdownFromPieces(
    pieces.map((piece, pieceIndex) => {
      if (pieceIndex !== index || piece.kind !== 'text') {
        return piece;
      }
      const prefix = piece.text.slice(0, piece.hiddenStart);
      const suffix = piece.hiddenEnd > 0 ? piece.text.slice(piece.text.length - piece.hiddenEnd) : '';
      return { ...piece, text: `${prefix}${shown}${suffix}` };
    }),
  );
}

export function markdownWithoutImage(source: string, attachmentId: string): string {
  return editorPieces(source)
    .filter((piece) => piece.kind !== 'image' || piece.id !== attachmentId)
    .map((piece) => (piece.kind === 'text' ? piece.text : piece.raw))
    .join('');
}

export function absoluteSelection(pieces: readonly EditorPiece[], pieceIndex: number, selection: Selection): Selection {
  const piece = pieces[pieceIndex];
  const base = pieceOffset(pieces, pieceIndex) + (piece?.kind === 'text' ? piece.hiddenStart : 0);
  return { start: base + selection.start, end: base + selection.end };
}

export function selectionInPiece(
  pieces: readonly EditorPiece[],
  selection: Selection,
): { pieceIndex: number; selection: Selection } | null {
  const start = Math.min(selection.start, selection.end);
  const end = Math.max(selection.start, selection.end);
  let found: { pieceIndex: number; selection: Selection } | null = null;

  for (let index = 0; index < pieces.length; index += 1) {
    const piece = pieces[index];
    if (!piece || piece.kind !== 'text') {
      continue;
    }
    const abs = pieceOffset(pieces, index);
    const displayStart = abs + piece.hiddenStart;
    const displayEnd = abs + piece.text.length - piece.hiddenEnd;
    if (start < displayStart || start > displayEnd) {
      continue;
    }
    const localEnd = Math.min(Math.max(end, displayStart), displayEnd) - displayStart;
    found = { pieceIndex: index, selection: { start: start - displayStart, end: localEnd } };
    if (start < displayEnd || end > start) {
      return found;
    }
  }

  return found;
}

export function toggleTask(source: string, lineIndex: number): string {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const line = lines[lineIndex];
  if (!line) {
    return source;
  }
  if (line.includes('[ ]')) {
    lines[lineIndex] = line.replace('[ ]', '[x]');
  } else if (/\[x\]/i.test(line)) {
    lines[lineIndex] = line.replace(/\[x\]/i, '[ ]');
  }
  return lines.join('\n');
}

export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (line.trim().length === 0) {
      index += 1;
      continue;
    }
    if (line.trim() === '---') {
      blocks.push({ type: 'hr' });
      index += 1;
      continue;
    }

    const image = IMAGE_LINE.exec(line.trim());
    if (image?.[2]) {
      blocks.push({ type: 'image', alt: image[1] ?? '사진', attachmentId: image[2] });
      index += 1;
      continue;
    }

    const heading = HEADING_LINE.exec(line);
    if (heading?.[1] && heading[2] !== undefined) {
      const level = heading[1].length;
      blocks.push({
        type: level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3',
        inlines: parseInlines(heading[2]),
      });
      index += 1;
      continue;
    }

    if (TASK_LINE.test(line)) {
      const items: { checked: boolean; inlines: Inline[]; line: number }[] = [];
      while (index < lines.length && TASK_LINE.test(lines[index] ?? '')) {
        const task = TASK_LINE.exec(lines[index] ?? '');
        if (task) {
          items.push({
            checked: task[1]?.toLowerCase() === 'x',
            inlines: parseInlines(task[2] ?? ''),
            line: index,
          });
        }
        index += 1;
      }
      blocks.push({ type: 'task', items });
      continue;
    }

    if (BULLET_LINE.test(line)) {
      const items: Inline[][] = [];
      while (index < lines.length && BULLET_LINE.test(lines[index] ?? '') && !TASK_LINE.test(lines[index] ?? '')) {
        const item = BULLET_LINE.exec(lines[index] ?? '');
        items.push(parseInlines(item?.[1] ?? ''));
        index += 1;
      }
      blocks.push({ type: 'bullet', items });
      continue;
    }

    if (NUMBER_LINE.test(line)) {
      const items: Inline[][] = [];
      while (index < lines.length && NUMBER_LINE.test(lines[index] ?? '')) {
        const item = NUMBER_LINE.exec(lines[index] ?? '');
        items.push(parseInlines(item?.[1] ?? ''));
        index += 1;
      }
      blocks.push({ type: 'number', items });
      continue;
    }

    if (QUOTE_LINE.test(line)) {
      const parts: string[] = [];
      while (index < lines.length && QUOTE_LINE.test(lines[index] ?? '')) {
        const quote = QUOTE_LINE.exec(lines[index] ?? '');
        parts.push(quote?.[1] ?? '');
        index += 1;
      }
      blocks.push({ type: 'quote', inlines: parseInlines(parts.join(' ')) });
      continue;
    }

    const parts: string[] = [];
    while (index < lines.length && (lines[index] ?? '').trim().length > 0 && !isSpecialLine(lines[index] ?? '')) {
      parts.push(lines[index] ?? '');
      index += 1;
    }
    blocks.push({ type: 'paragraph', inlines: parseInlines(parts.join(' ')) });
  }

  return blocks;
}

export function toPlainText(markdown: string): string {
  return parseMarkdown(markdown)
    .flatMap((block) => {
      if (block.type === 'hr' || block.type === 'image') {
        return [];
      }
      if (block.type === 'bullet' || block.type === 'number') {
        return block.items.map((item) => inlineText(item));
      }
      if (block.type === 'task') {
        return block.items.map((item) => inlineText(item.inlines));
      }
      return [inlineText(block.inlines)];
    })
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

export function titleFromMarkdown(markdown: string): string {
  const heading = markdown.match(/^#\s+(.+)$/m);
  const title = heading?.[1]?.trim();
  if (title) {
    return title.slice(0, 80);
  }
  const plain = toPlainText(markdown).split('\n').find((line) => line.trim().length > 0);
  return plain ? plain.slice(0, 80) : '모아본 기록';
}

function pushEditorText(pieces: EditorPiece[], text: string, nextIsImage: boolean) {
  const prevIsImage = pieces[pieces.length - 1]?.kind === 'image';
  let hiddenStart = prevIsImage && text.startsWith('\n') ? 1 : 0;
  let hiddenEnd = nextIsImage && text.endsWith('\n') ? 1 : 0;
  if (hiddenStart + hiddenEnd > text.length) {
    hiddenEnd = Math.max(0, text.length - hiddenStart);
  }
  if (text.length > 0 || pieces.length === 0) {
    pieces.push({ kind: 'text', text, hiddenStart, hiddenEnd });
  }
}

function pieceOffset(pieces: readonly EditorPiece[], index: number): number {
  let offset = 0;
  for (let cursor = 0; cursor < index; cursor += 1) {
    const piece = pieces[cursor];
    offset += piece?.kind === 'text' ? piece.text.length : piece?.kind === 'image' ? piece.raw.length : 0;
  }
  return offset;
}

function isSpecialLine(line: string): boolean {
  return (
    line.trim() === '---' ||
    IMAGE_LINE.test(line.trim()) ||
    HEADING_LINE.test(line) ||
    TASK_LINE.test(line) ||
    BULLET_LINE.test(line) ||
    NUMBER_LINE.test(line) ||
    QUOTE_LINE.test(line)
  );
}

function inlineText(inlines: readonly Inline[]): string {
  return inlines
    .map((inline) => (inline.type === 'link' ? inline.text : inline.text))
    .join('')
    .trim();
}

export function parseInlines(input: string): Inline[] {
  const inlines: Inline[] = [];
  let rest = input;

  while (rest.length > 0) {
    const image = /^!\[([^\]]*)\]\(attachment:[A-Za-z0-9-]+\)/.exec(rest);
    const link = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/.exec(rest);
    const bold = /^\*\*([^*]+)\*\*/.exec(rest);
    const italic = /^\*([^*]+)\*/.exec(rest);
    const match = image ?? link ?? bold ?? italic;

    if (!match) {
      const next = rest.slice(1).search(/[!\[*]/);
      const cut = next === -1 ? rest.length : next + 1;
      pushText(inlines, rest.slice(0, cut));
      rest = rest.slice(cut);
      continue;
    }

    if (image && match === image) {
      pushText(inlines, image[1] ? image[1] : '사진');
    } else if (link && match === link) {
      inlines.push({ type: 'link', text: link[1] ?? '', href: link[2] ?? '' });
    } else if (bold && match === bold) {
      inlines.push({ type: 'bold', text: bold[1] ?? '' });
    } else if (italic) {
      inlines.push({ type: 'italic', text: italic[1] ?? '' });
    }
    rest = rest.slice(match[0].length);
  }

  return inlines;
}

function pushText(inlines: Inline[], text: string) {
  if (!text) {
    return;
  }
  const last = inlines[inlines.length - 1];
  if (last?.type === 'text') {
    last.text += text;
    return;
  }
  inlines.push({ type: 'text', text });
}

function wrapSelection(
  source: string,
  selection: Selection,
  before: string,
  after: string,
  placeholder: string,
): { text: string; selection: Selection } {
  const { start, end } = ordered(selection);
  const selected = source.slice(start, end);
  const inner = selected || placeholder;
  const text = source.slice(0, start) + before + inner + after + source.slice(end);
  const cursor = start + before.length;
  return { text, selection: { start: cursor, end: cursor + inner.length } };
}

function prefixLines(
  source: string,
  selection: Selection,
  mapLine: (line: string) => string,
): { text: string; selection: Selection } {
  const range = lineBounds(source, selection);
  const block = source.slice(range.start, range.end);
  const nextBlock = block.split('\n').map(mapLine).join('\n');
  const text = source.slice(0, range.start) + nextBlock + source.slice(range.end);
  return { text, selection: { start: range.start, end: range.start + nextBlock.length } };
}

function lineBounds(source: string, selection: Selection): Selection {
  const { start, end } = ordered(selection);
  const lineStart = source.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  let lineEnd = source.indexOf('\n', end);
  if (lineEnd === -1) {
    lineEnd = source.length;
  }
  if (end < lineEnd && end > start && source[end - 1] === '\n') {
    lineEnd = end - 1;
  }
  return { start: lineStart, end: lineEnd };
}

function selectedText(source: string, selection: Selection): string {
  const { start, end } = ordered(selection);
  return source.slice(start, end);
}

function ordered(selection: Selection): Selection {
  return selection.start <= selection.end
    ? selection
    : { start: selection.end, end: selection.start };
}
