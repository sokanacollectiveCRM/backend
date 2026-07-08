import { RequestHandler } from 'express';

import { contractSignatureCompletionService } from '../services/contractSignatureCompletionService';

function extractDocumentId(payload: Record<string, unknown>): string | null {
  const direct =
    payload.document_id ??
    payload.documentId ??
    payload.id;

  if (typeof direct === 'string' || typeof direct === 'number') {
    const normalized = String(direct).trim();
    return normalized || null;
  }

  const document = payload.document as Record<string, unknown> | undefined;
  const nestedDocumentId = document?.id ?? document?.document_id;
  if (typeof nestedDocumentId === 'string' || typeof nestedDocumentId === 'number') {
    return String(nestedDocumentId).trim() || null;
  }

  const data = payload.data as Record<string, unknown> | undefined;
  const dataDocument = data?.document as Record<string, unknown> | undefined;
  const nested =
    data?.document_id ??
    data?.documentId ??
    dataDocument?.id ??
    dataDocument?.document_id;

  if (typeof nested === 'string' || typeof nested === 'number') {
    return String(nested).trim() || null;
  }

  return null;
}

function shouldProcessCompletion(payload: Record<string, unknown>): boolean {
  const markers = [
    payload.event,
    payload.event_type,
    payload.type,
    payload.action,
    payload.status,
    (payload.document as Record<string, unknown> | undefined)?.status,
    (payload.data as Record<string, unknown> | undefined)?.status,
  ]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.toLowerCase());

  if (payload.completed === true || payload.is_completed === true) {
    return true;
  }

  return markers.some(
    (value) =>
      value.includes('complete') ||
      value.includes('completed') ||
      value.includes('signed') ||
      value.includes('document.complete')
  );
}

export const signNowCallback: RequestHandler = async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const documentId = extractDocumentId(body);

    if (!documentId) {
      res.status(400).json({ error: 'Missing SignNow document id' });
      return;
    }

    if (!shouldProcessCompletion(body)) {
      res.status(200).json({
        received: true,
        processed: false,
        reason: 'event_not_actionable',
        documentId,
      });
      return;
    }

    const result = await contractSignatureCompletionService.finalizeSignedDocument(documentId);
    res.status(200).json({
      received: true,
      processed: true,
      documentId,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SignNow callback processing failed';
    res.status(500).json({ error: message });
  }
};

