import { MERGE_FIELDS, MergeContext } from './types';

const FIELD_PATTERN = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

export function extractMergeFields(text: string): string[] {
  const found = new Set<string>();
  text.replace(FIELD_PATTERN, (_match, name: string) => {
    found.add(String(name).toLowerCase());
    return _match;
  });
  return [...found];
}

export function unknownMergeFields(...parts: string[]): string[] {
  const allowed = new Set<string>(MERGE_FIELDS);
  const unknown = new Set<string>();
  for (const part of parts) {
    for (const field of extractMergeFields(part || '')) {
      if (!allowed.has(field)) unknown.add(field);
    }
  }
  return [...unknown];
}

export function renderTemplate(
  template: string,
  context: MergeContext
): string {
  return template.replace(FIELD_PATTERN, (_match, name: string) => {
    const key = String(name).toLowerCase() as keyof MergeContext;
    const value = context[key];
    return value == null ? '' : String(value);
  });
}

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char] as string
  );
}

export function htmlFromText(text: string): string {
  return `<p>${escapeHtml(text).replace(/\n+/g, '</p><p>')}</p>`;
}
