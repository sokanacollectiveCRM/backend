import { RequestHandler } from 'express';

import { SAFE_INTERNAL_ERROR_MESSAGE } from '../common/utils/safeLogging';
import { contractSignatureCompletionService } from '../services/contractSignatureCompletionService';
import { claimWebhookEvent } from '../security/webhookEventStore';

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

  const meta = payload.meta as Record<string, unknown> | undefined;
  const metaDoc = meta?.document_id;
  if (typeof metaDoc === 'string' || typeof metaDoc === 'number') {
    return String(metaDoc).trim() || null;
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

function buildSignNowEventKey(payload: Record<string, unknown>, documentId: string): string {
  const event =
    (typeof payload.event === 'string' && payload.event) ||
    (typeof payload.event_type === 'string' && payload.event_type) ||
    (typeof payload.type === 'string' && payload.type) ||
    'complete';
  return `signnow:${documentId}:${String(event).toLowerCase()}`;
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

    const claim = await claimWebhookEvent('signnow', buildSignNowEventKey(body, documentId));
    if (claim === 'duplicate') {
      res.status(200).json({
        received: true,
        processed: false,
        reason: 'duplicate',
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
  } catch {
    res.status(500).json({ error: SAFE_INTERNAL_ERROR_MESSAGE });
  }
};
