import { Test } from '@nestjs/testing';
import { DATABASE } from '../../database/database.module';
import { TokenCleanupService } from './token-cleanup.service';

describe('TokenCleanupService', () => {
  let service: TokenCleanupService;
  const executeTakeFirst = jest
    .fn()
    .mockResolvedValue({ numDeletedRows: BigInt(0) });
  const deleteFrom = jest.fn(() => ({
    where: jest.fn(() => ({ executeTakeFirst })),
  }));

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TokenCleanupService,
        { provide: DATABASE, useValue: { deleteFrom } },
      ],
    }).compile();

    service = module.get(TokenCleanupService);
  });

  it('purges both token tables', async () => {
    await service.purgeStaleTokens();

    expect(deleteFrom).toHaveBeenCalledWith('refresh_tokens');
    expect(deleteFrom).toHaveBeenCalledWith('password_reset_tokens');
  });

  it('is registered as a daily cron', () => {
    // SchedulerRegistry picks the job up via this metadata — if someone
    // strips the decorator, cleanup silently never runs.
    const metadataKeys = Reflect.getMetadataKeys(
      service.purgeStaleTokens,
    ).filter((key) => String(key).toLowerCase().includes('cron'));
    expect(metadataKeys.length).toBeGreaterThan(0);
  });
});
