import { DoulaController } from '../controllers/doulaController';
import { getPool } from '../db/cloudSqlPool';
import {
  canManageHrDocuments,
  isSensitiveDocument,
} from '../features/doulas/application/backgroundCheck';
import { backgroundCheckSatisfied } from '../features/doulas/domain/documentPolicy';
import { AuthRequest } from '../types';

jest.mock('../db/cloudSqlPool', () => ({ getPool: jest.fn() }));
const query = jest.fn();
const req = (role = 'admin', tenant = 'fictional-tenant') =>
  ({
    user: { id: 'fictional-actor', role },
    tenant: { id: tenant },
    params: { doulaId: 'fictional-doula', documentId: 'fictional-document' },
    body: { status: 'cleared' },
  }) as unknown as AuthRequest;
const response = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn();
  return res;
};
const controller = (repo: any = {}) =>
  new DoulaController(
    repo,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any
  );
beforeEach(() => {
  jest.clearAllMocks();
  (getPool as jest.Mock).mockReturnValue({ query });
});
it.each(['doula', 'client', 'billing'])(
  'denies %s even if a forged HR department is submitted',
  async (role) => {
    const request = req(role);
    request.body.department = 'hr';
    expect(await canManageHrDocuments(request)).toBe(false);
    const res = response();
    await controller().setBackgroundCheck(request, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(query).not.toHaveBeenCalled();
  }
);
it('denies generic admins and tenant-less requests', async () => {
  query.mockResolvedValue({ rowCount: 0, rows: [] });
  expect(await canManageHrDocuments(req())).toBe(false);
  expect(await canManageHrDocuments(req('admin', ''))).toBe(false);
  const res = response();
  await controller().setBackgroundCheck(req(), res);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(query.mock.calls.every(([sql]) => !sql.includes('UPDATE'))).toBe(true);
});
it.each(['hr', 'payroll'])(
  'allows a persisted %s grant and records actor/date with a status event',
  async (department) => {
    query.mockImplementation(async (sql: string, args: string[]) => {
      if (sql.includes('doula_hr_permissions')) {
        expect(sql).toContain("p.department IN ('hr','payroll')");
        expect(args).toEqual(['fictional-tenant', 'fictional-actor']);
        return { rowCount: 1, rows: [{ department }] };
      }
      if (sql.includes('WITH updated')) {
        expect(args).toEqual([
          'fictional-doula',
          'fictional-tenant',
          'cleared',
          'fictional-actor',
        ]);
        expect(sql).toContain('background_check_set_at=now()');
        expect(sql).toContain(
          'INSERT INTO public.doula_background_check_events'
        );
        return {
          rows: [
            {
              status: 'cleared',
              setAt: '2026-10-26T12:00:00Z',
              setBy: 'fictional-actor',
            },
          ],
          rowCount: 1,
        };
      }
      return { rowCount: 1, rows: [{ id: 'fictional-doula' }] };
    });
    const res = response();
    await controller().setBackgroundCheck(req(), res);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      backgroundCheck: expect.objectContaining({
        status: 'cleared',
        setBy: 'fictional-actor',
        setAt: expect.any(String),
      }),
    });
  }
);
it('rejects invalid status and another tenant target without updating', async () => {
  query
    .mockResolvedValueOnce({ rowCount: 1 })
    .mockResolvedValueOnce({ rowCount: 0 });
  const res = response();
  await controller().setBackgroundCheck(req(), res);
  expect(res.status).toHaveBeenCalledWith(404);
  query.mockResolvedValue({ rowCount: 1, rows: [{}] });
  const request = req();
  request.body.status = 'pending';
  const invalid = response();
  await controller().setBackgroundCheck(request, invalid);
  expect(invalid.status).toHaveBeenCalledWith(400);
  expect(query.mock.calls.some(([sql]) => sql.includes('UPDATE'))).toBe(false);
});
it.each(['w9', 'direct_deposit_form', 'background_check'])(
  'blocks signed URLs and review for sensitive %s without HR/payroll',
  async (documentType) => {
    query.mockImplementation(async (sql: string) => ({
      rowCount: sql.includes('doula_hr_permissions') ? 0 : 1,
      rows: [{}],
    }));
    const repo = {
      getDocumentById: jest.fn().mockResolvedValue({ documentType }),
      getSignedUrl: jest.fn(),
      updateDocumentStatus: jest.fn(),
    };
    const res = response();
    await controller(repo).getDocumentUrl(req(), res);
    expect(isSensitiveDocument(documentType)).toBe(true);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(repo.getSignedUrl).not.toHaveBeenCalled();
    const review = req();
    review.body = { status: 'approved' };
    const reviewed = response();
    await controller(repo).reviewDocument(review, reviewed);
    expect(reviewed.status).toHaveBeenCalledWith(403);
    expect(repo.updateDocumentStatus).not.toHaveBeenCalled();
  }
);
it('config controls background clearance for required and optional modes', () => {
  expect(backgroundCheckSatisfied('not_cleared', true)).toBe(false);
  expect(backgroundCheckSatisfied('cleared', true)).toBe(true);
  expect(backgroundCheckSatisfied('not_cleared', false)).toBe(true);
  expect(backgroundCheckSatisfied(undefined, false)).toBe(true);
});

it('filters sensitive rows before signing URLs and omits background data for ordinary admins', async () => {
  query.mockImplementation(async (sql: string) => ({
    rowCount: sql.includes('doula_hr_permissions') ? 0 : 1,
    rows: [{}],
  }));
  const docs = ['w9', 'direct_deposit_form', 'background_check', 'cpr'].map(
    (documentType) => ({
      id: documentType,
      doulaId: 'fictional-doula',
      documentType,
      fileName: 'fictional.pdf',
      filePath: `fictional/${documentType}.pdf`,
      status: 'approved',
      uploadedAt: new Date('2026-10-26T12:00:00Z'),
    })
  );
  const repo = {
    getDocumentsByDoulaId: jest.fn().mockResolvedValue(docs),
    getCurrentDocumentsByDoulaId: jest.fn().mockResolvedValue(docs),
    getSignedUrl: jest
      .fn()
      .mockResolvedValue('https://fictional.example/signed'),
  };
  const res = response();
  await controller(repo).getDoulaDocumentsAdmin(req(), res);
  expect(repo.getSignedUrl).toHaveBeenCalledTimes(1);
  expect(repo.getSignedUrl).toHaveBeenCalledWith('fictional/cpr.pdf', 3600);
  const payload = res.json.mock.calls[0][0];
  expect(payload.documents.map((doc: any) => doc.documentType)).toEqual([
    'cpr',
  ]);
  expect(payload).not.toHaveProperty('backgroundCheck');
  expect(payload).not.toHaveProperty('canManageBackgroundCheck');
  expect(payload.visibleDocumentTypes).not.toContain('w9');
  expect(
    payload.completeness.items.some((item: any) =>
      ['w9', 'direct_deposit_form'].includes(item.documentType)
    )
  ).toBe(false);
});
it.each([
  'background_check_status',
  'background_check_set_at',
  'background_check_set_by',
  'backgroundCheck',
])('rejects owner profile edits to %s', async (field) => {
  const request = req('doula');
  request.body = { [field]: 'cleared' };
  const res = response();
  await controller().updateMyProfile(request, res);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(query).not.toHaveBeenCalled();
});
