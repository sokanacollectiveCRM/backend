import {
  getSignedReadUrl,
  uploadObject,
} from '../services/gcs/documentStorage';
import {
  isHttpUrl,
  resolveProfilePictureUrl,
  uploadProfilePictureObject,
} from '../services/gcs/profilePictureStorage';

jest.mock('../services/gcs/documentStorage', () => ({
  GCS_PREFIX: { profilePictures: 'profile-pictures' },
  objectPath: (prefix: string, relative: string) => `${prefix}/${relative}`,
  uploadObject: jest.fn().mockResolvedValue(undefined),
  deleteObject: jest.fn().mockResolvedValue(undefined),
  getSignedReadUrl: jest
    .fn()
    .mockResolvedValue('https://signed.example/profile.jpg'),
}));

describe('profilePictureStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uploads under profile-pictures/ and returns a relative path', async () => {
    const result = await uploadProfilePictureObject('user-1', {
      originalname: 'headshot.png',
      mimetype: 'image/png',
      size: 100,
      buffer: Buffer.from('png'),
    } as any);

    expect(result.relativePath).toMatch(/^user-1\/\d+_headshot\.png$/);
    expect(uploadObject).toHaveBeenCalledWith(
      expect.stringMatching(/^profile-pictures\/user-1\/\d+_headshot\.png$/),
      expect.any(Buffer),
      'image/png',
      true
    );
  });

  it('passes through legacy http profile URLs', async () => {
    await expect(
      resolveProfilePictureUrl('https://cdn.example/a.jpg')
    ).resolves.toBe('https://cdn.example/a.jpg');
    expect(getSignedReadUrl).not.toHaveBeenCalled();
  });

  it('signs relative GCS paths', async () => {
    await expect(
      resolveProfilePictureUrl('user-1/123_headshot.png')
    ).resolves.toBe('https://signed.example/profile.jpg');
    expect(getSignedReadUrl).toHaveBeenCalledWith(
      'profile-pictures/user-1/123_headshot.png',
      60 * 60
    );
  });

  it('detects http urls', () => {
    expect(isHttpUrl('https://x')).toBe(true);
    expect(isHttpUrl('user-1/file.png')).toBe(false);
  });
});
