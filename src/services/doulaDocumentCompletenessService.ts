import { DoulaDocumentRepository } from '../repositories/doulaDocumentRepository';
import {
  REQUIRED_DOULA_DOCUMENT_TYPES,
  type RequiredDoulaDocumentType,
} from '../constants/doulaDocuments';

export interface DocumentStatusItem {
  documentType: RequiredDoulaDocumentType;
  status: 'missing' | 'uploaded' | 'approved' | 'rejected';
  documentId?: string;
  fileName?: string;
  uploadedAt?: string;
  rejectionReason?: string;
}

export interface DocumentCompletenessSummary {
  totalRequired: number;
  totalComplete: number;
  missingTypes: RequiredDoulaDocumentType[];
  hasAllRequiredDocuments: boolean;
  canBeActive: boolean;
  items: DocumentStatusItem[];
}

/**
 * Computes document completeness for a doula.
 * Active requires all 5 required documents to be approved.
 */
export class DoulaDocumentCompletenessService {
  constructor(private documentRepository: DoulaDocumentRepository) {}

  async getCompleteness(doulaId: string): Promise<DocumentCompletenessSummary> {
    const currentDocs = await this.documentRepository.getCurrentDocumentsByDoulaId(doulaId);
    const docByType = new Map<string, (typeof currentDocs)[0]>();
    for (const doc of currentDocs) {
      docByType.set(doc.documentType, doc);
    }

    const items: DocumentStatusItem[] = [];
    const missingTypes: RequiredDoulaDocumentType[] = [];

    for (const type of REQUIRED_DOULA_DOCUMENT_TYPES) {
      const doc = docByType.get(type);
      const status: DocumentStatusItem['status'] = doc
        ? (doc.status === 'pending' ? 'uploaded' : doc.status)
        : 'missing';

      items.push({
        documentType: type,
        status,
        documentId: doc?.id,
        fileName: doc?.fileName,
        uploadedAt: doc?.uploadedAt?.toISOString(),
        rejectionReason: doc?.rejectionReason,
      });

      if (status === 'missing') {
        missingTypes.push(type);
      }
    }

    const totalComplete = items.filter((i) => i.status === 'approved').length;
    const hasAllRequiredDocuments = missingTypes.length === 0;
    const allApproved = items.every((i) => i.status === 'approved');
    const canBeActive = hasAllRequiredDocuments && allApproved;

    return {
      totalRequired: REQUIRED_DOULA_DOCUMENT_TYPES.length,
      totalComplete,
      missingTypes,
      hasAllRequiredDocuments,
      canBeActive,
      items,
    };
  }
}
