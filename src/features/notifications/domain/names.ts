export function displayFirstName(value: string | null | undefined): string {
  const cleaned = String(value || '')
    .replace(/[\r\n]+/g, ' ')
    .trim();
  const first = cleaned.split(/\s+/)[0] || 'there';
  return first.slice(0, 40);
}
