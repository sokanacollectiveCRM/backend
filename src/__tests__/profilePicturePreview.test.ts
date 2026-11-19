import { DoulaController } from '../features/doulas/http/doulaController';
import { downloadObject } from '../services/gcs/documentStorage';

jest.mock('../services/gcs/documentStorage', () => ({
  ...jest.requireActual('../services/gcs/documentStorage'),
  downloadObject: jest.fn(),
}));
const id = 'fictional-doula';
const path = `${id}/headshot.png`;
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function setup() {
  const c = Object.create(DoulaController.prototype) as any;
  c.cloudSqlTeamService = {
    getDoulaProfilePicturePath: jest.fn().mockResolvedValue(path),
    getTeamMemberById: jest
      .fn()
      .mockResolvedValue({ id, role: 'doula', profile_picture: null }),
    updateDoulaProfilePicture: jest.fn().mockResolvedValue(true),
  };
  c.doulaAvailabilityService = {
    getCurrentAvailabilityStatus: jest
      .fn()
      .mockResolvedValue({ status: 'available' }),
  };
  c.userUseCase = { uploadProfilePicture: jest.fn().mockResolvedValue(path) };
  c.buildDoulaProfilePayload = jest.fn((_member, opts) => ({
    profile_picture: opts.profilePictureFallback ?? null,
  }));
  const req: any = {
    user: { id },
    protocol: 'http',
    get: () => 'localhost:8080',
    file: { mimetype: 'image/png', size: 8 },
  };
  const res: any = {
    json: jest.fn(),
    send: jest.fn(),
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    type: jest.fn().mockReturnThis(),
  };
  return { c, req, res };
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(downloadObject).mockResolvedValue(png);
});

describe('private profile photo preview', () => {
  it('downloads only the authenticated doula’s stored photo, with private response headers', async () => {
    const { c, req, res } = setup();
    await c.getProfilePicture(req, res);
    expect(
      c.cloudSqlTeamService.getDoulaProfilePicturePath
    ).toHaveBeenCalledWith(id);
    expect(downloadObject).toHaveBeenCalledWith(`profile-pictures/${path}`);
    expect(res.type).toHaveBeenCalledWith('image/png');
    expect(res.setHeader).toHaveBeenCalledWith('Cross-Origin-Resource-Policy', 'same-site');
    expect(res.send).toHaveBeenCalledWith(png);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'private, no-store'
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Content-Type-Options',
      'nosniff'
    );
  });
  it('requires a signed-in user', async () => {
    const { c, req, res } = setup();
    req.user = null;
    await c.getProfilePicture(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(downloadObject).not.toHaveBeenCalled();
  });
  it.each([
    null,
    'another-doula/headshot.png',
    'https://example.com/headshot.png',
  ])(
    'does not fetch missing, other-user or external photo paths: %s',
    async (stored) => {
      const { c, req, res } = setup();
      c.cloudSqlTeamService.getDoulaProfilePicturePath.mockResolvedValue(
        stored
      );
      await c.getProfilePicture(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(downloadObject).not.toHaveBeenCalled();
    }
  );
  it('does not serve executable content as an image', async () => {
    const { c, req, res } = setup();
    jest
      .mocked(downloadObject)
      .mockResolvedValue(Buffer.from('<svg><script>bad</script></svg>'));
    await c.getProfilePicture(req, res);
    expect(res.status).toHaveBeenCalledWith(415);
    expect(res.send).not.toHaveBeenCalled();
  });
  it('returns the authenticated read URL after upload when signing is unavailable', async () => {
    const { c, req, res } = setup();
    await c.uploadProfilePicture(req, res);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      profile: {
        profile_picture: 'http://localhost:8080/api/doulas/profile/picture',
      },
    });
  });
  it('uses the same fallback after reloading an existing profile', async () => {
    const { c, req, res } = setup();
    await c.getMyProfile(req, res);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      profile: {
        profile_picture: 'http://localhost:8080/api/doulas/profile/picture',
      },
    });
  });
});

it('replaces an internal storage path inherited from session data with the private read URL', async () => {
  const { c, req, res } = setup();
  c.buildDoulaProfilePayload.mockReturnValue({ profile_picture: path });
  await c.getMyProfile(req, res);
  expect(res.json).toHaveBeenCalledWith({
    success: true,
    profile: {
      profile_picture: 'http://localhost:8080/api/doulas/profile/picture',
    },
  });
});
