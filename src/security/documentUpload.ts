export const DOCUMENT_TYPE_ERROR =
  "That file type isn't supported. Please upload a JPEG, PNG or PDF.";
export const DOCUMENT_ACCEPT =
  '.jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf';
export const DOCUMENT_SIZE_LIMIT = 10 * 1024 * 1024;

/** Detect the format from bytes, independently of the supplied name and MIME. */
export function documentContentType(bytes: Uint8Array): string | null {
  const starts = (values: number[]) =>
    values.every((value, i) => bytes[i] === value);
  if (starts([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return 'image/png';
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  return null;
}

export function documentTypeMatches(
  name: string,
  mime: string,
  detected: string | null
): boolean {
  const extension = name.split('.').pop()?.toLowerCase();
  const expected =
    extension === 'jpg' || extension === 'jpeg'
      ? 'image/jpeg'
      : extension === 'png'
        ? 'image/png'
        : extension === 'pdf'
          ? 'application/pdf'
          : null;
  return (
    expected !== null &&
    detected === expected &&
    (mime === expected || (expected === 'image/jpeg' && mime === 'image/jpg'))
  );
}

export function validateDocumentFile(file: {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}): string | null {
  if (
    file.size > DOCUMENT_SIZE_LIMIT ||
    file.buffer.length > DOCUMENT_SIZE_LIMIT
  ) {
    return 'File size exceeds 10MB limit';
  }
  if (
    !documentTypeMatches(
      file.originalname,
      file.mimetype,
      documentContentType(file.buffer)
    )
  ) {
    return DOCUMENT_TYPE_ERROR;
  }
  return null;
}
