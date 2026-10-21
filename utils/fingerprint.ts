export function contentFingerprint(title: string, markdown: string): string {
  const normalized = `${title.trim()}\n${markdown.replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim()}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;

  for (let index = 0; index < normalized.length; index += 1) {
    const code = normalized.charCodeAt(index);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= code;
    h2 = Math.imul(h2, 0x811c9dc5);
  }

  return `${(h1 >>> 0).toString(16)}-${(h2 >>> 0).toString(16)}`;
}

export function plainTextLength(title: string, markdown: string): number {
  const stripped = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~]/g, ' ');

  return `${title} ${stripped}`.replace(/\s+/g, ' ').trim().length;
}
