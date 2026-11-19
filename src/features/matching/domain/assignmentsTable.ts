/**
 * Same detection the client controller uses for a missing assignments table.
 * "doula_assignments" counts because it contains "assignments".
 */
export function isAssignmentsTableMissing(error: unknown): boolean {
  const message = (
    error instanceof Error ? error.message : String(error)
  ).toLowerCase();
  return (
    message.includes('assignments') &&
    (message.includes('could not find') ||
      message.includes('schema cache') ||
      message.includes('does not exist') ||
      message.includes('relation'))
  );
}
