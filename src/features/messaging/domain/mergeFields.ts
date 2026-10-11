import { ALLOWED_MERGE_FIELDS, MergeContext } from './types';

const FIELD_PATTERN = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

export function extractMergeFields(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(FIELD_PATTERN)) {
    found.add(match[1]);
  }
  return [...found];
}

export function unknownMergeFields(
  ...parts: Array<string | null | undefined>
): string[] {
  const allowed = new Set<string>(ALLOWED_MERGE_FIELDS);
  const unknown = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const field of extractMergeFields(part)) {
      if (!allowed.has(field)) unknown.add(field);
    }
  }
  return [...unknown];
}

export function renderMergeTemplate(
  template: string,
  context: MergeContext
): string {
  return template.replace(FIELD_PATTERN, (_full, key: string) => {
    const value = context[key as keyof MergeContext];
    return value == null ? '' : String(value);
  });
}

export function htmlFromText(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<p>${escaped.replace(/\n+/g, '</p><p>')}</p>`;
}
