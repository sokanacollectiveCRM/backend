import { ContractSnapshot, ContractTemplateField } from '../domain/types';
import { PdfTemplateField } from '../pdf/types';

type SigningSnapshotField = ContractTemplateField & {
  type: Exclude<ContractTemplateField['type'], 'optional_text'>;
};

function snapshotFieldToPdfField(
  field: SigningSnapshotField
): PdfTemplateField {
  return {
    id: field.id,
    kind: field.type,
    page: field.page,
    coordinates: field.coordinates,
    required: field.required,
    label: field.label,
  };
}

/** Frozen signing fields copied onto the contract at creation time. */
export function signingManifestFromSnapshot(
  snapshot: ContractSnapshot
): readonly PdfTemplateField[] {
  return snapshot.fields
    .filter(
      (field): field is SigningSnapshotField => field.type !== 'optional_text'
    )
    .map(snapshotFieldToPdfField);
}
