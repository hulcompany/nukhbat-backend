import { SnapshotsService } from './snapshots.service';

describe('SnapshotsService locks', () => {
  const redis = {
    set: jest.fn(),
    eval: jest.fn(),
  };
  const service = new SnapshotsService(redis as any);

  beforeEach(() => jest.clearAllMocks());

  it('acquires a lock atomically and returns its ownership token', async () => {
    redis.set.mockResolvedValue('OK');

    const token = await service.lockQuestionSnapshot(
      '00000000-0000-4000-8000-000000000001',
    );

    expect(token).toEqual(expect.any(String));
    expect(redis.set).toHaveBeenCalledWith(
      'qsnap-lock:00000000-0000-4000-8000-000000000001',
      token,
      'EX',
      300,
      'NX',
    );
  });

  it('returns null when another request owns the lock', async () => {
    redis.set.mockResolvedValue(null);

    await expect(
      service.lockQuestionSnapshot('00000000-0000-4000-8000-000000000001'),
    ).resolves.toBeNull();
  });

  it('unlocks using compare-and-delete with the ownership token', async () => {
    redis.eval.mockResolvedValue(1);

    await expect(
      service.unlockQuestionSnapshot(
        '00000000-0000-4000-8000-000000000001',
        'owner-token',
      ),
    ).resolves.toBe(true);

    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('get', KEYS[1])"),
      1,
      'qsnap-lock:00000000-0000-4000-8000-000000000001',
      'owner-token',
    );
  });
});
