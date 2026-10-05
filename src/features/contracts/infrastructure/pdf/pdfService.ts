import { sha256, verifySha256 } from './hash';
import { renderCompletedPdf, renderUnsignedPdf } from './renderer';
import {
  artifactObjectPath,
  loadRegisteredPdfTemplate,
} from './templateLoader';
import {
  CompletePdfInput,
  GeneratedPdfArtifact,
  PdfGenerationDependencies,
} from './types';

async function persistArtifact(
  dependencies: PdfGenerationDependencies,
  contractId: string,
  kind: 'unsigned' | 'completed',
  bytes: Buffer,
  metadata: Record<string, string>
): Promise<GeneratedPdfArtifact> {
  const hash = sha256(bytes);
  const existing = await dependencies.artifacts?.findByHash(
    contractId,
    kind,
    hash
  );
  if (existing) {
    const expectedPath = artifactObjectPath(contractId, kind, hash);
    if (existing.sha256 !== hash || existing.path !== expectedPath) {
      throw new Error('Artifact repository returned non-canonical content');
    }
    return {
      path: existing.path,
      sha256: existing.sha256,
      generation: existing.generation,
      reused: true,
    };
  }

  const path = artifactObjectPath(contractId, kind, hash);
  try {
    const uploaded = await dependencies.storage.upload(path, bytes, {
      sha256: hash,
      artifactKind: kind,
      ...metadata,
    });
    return {
      path,
      sha256: hash,
      generation: uploaded.generation,
      reused: false,
    };
  } catch (error) {
    // A concurrent completion can win the immutable upload race. Re-read the
    // persisted artifact instead of replacing bytes at the deterministic path.
    const raced = await dependencies.artifacts?.findByHash(
      contractId,
      kind,
      hash
    );
    if (raced) {
      const expectedPath = artifactObjectPath(contractId, kind, hash);
      if (raced.sha256 !== hash || raced.path !== expectedPath) {
        throw new Error('Artifact repository returned non-canonical content');
      }
      return {
        path: raced.path,
        sha256: raced.sha256,
        generation: raced.generation,
        reused: true,
      };
    }
    throw error;
  }
}

export class NativeContractPdfService {
  constructor(private readonly dependencies: PdfGenerationDependencies) {}

  async generateUnsigned(
    snapshot: Parameters<typeof renderUnsignedPdf>[2]
  ): Promise<GeneratedPdfArtifact> {
    const template = await loadRegisteredPdfTemplate(
      this.dependencies.templates,
      this.dependencies.storage,
      snapshot.templateId,
      snapshot.templateVersion
    );
    const bytes = await renderUnsignedPdf(
      template.bytes,
      template.registration,
      snapshot
    );
    return persistArtifact(
      this.dependencies,
      snapshot.contractId,
      'unsigned',
      bytes,
      {
        templateIdentifier: template.registration.identifier,
        templateVersion: String(template.registration.version),
        templateSha256: template.registration.sha256,
      }
    );
  }

  async complete(input: CompletePdfInput): Promise<GeneratedPdfArtifact> {
    verifySha256(
      input.unsignedPdf,
      input.expectedUnsignedSha256,
      'Unsigned contract'
    );
    const template = await loadRegisteredPdfTemplate(
      this.dependencies.templates,
      this.dependencies.storage,
      input.snapshot.templateId,
      input.snapshot.templateVersion
    );
    const serverSignedAt = (this.dependencies.now ?? (() => new Date()))();
    const bytes = await renderCompletedPdf(
      input.unsignedPdf,
      template.registration,
      input.snapshot,
      input.adoptedSignature,
      {
        evidenceId: input.evidenceId,
        correlationId: input.correlationId,
        signerName: input.signerName,
        serverSignedAt,
        unsignedSha256: input.expectedUnsignedSha256,
      }
    );
    return persistArtifact(
      this.dependencies,
      input.snapshot.contractId,
      'completed',
      bytes,
      {
        templateIdentifier: template.registration.identifier,
        templateVersion: String(template.registration.version),
        templateSha256: template.registration.sha256,
        unsignedSha256: input.expectedUnsignedSha256,
        evidenceId: input.evidenceId,
        correlationId: input.correlationId,
        serverSignedAt: serverSignedAt.toISOString(),
      }
    );
  }
}
