const ATTACHMENT_PATTERN = /!\[[^\]]*\]\(attachment:([A-Za-z0-9-]+)\)/g;

export function referencedAttachmentIds(markdown: string): string[] {
  const ids: string[] = [];
  for (const match of markdown.matchAll(ATTACHMENT_PATTERN)) {
    const id = match[1];
    if (id && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

export function attachmentMarkdown(id: string): string {
  return `![사진](attachment:${id})`;
}
