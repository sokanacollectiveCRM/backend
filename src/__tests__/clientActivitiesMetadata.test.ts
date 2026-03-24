import { Activity } from '../entities/Activity';
import { ActivityMapper } from '../mappers/ActivityMapper';
import { ClientUseCase } from '../usecase/clientUseCase';

describe('Client activities metadata behavior', () => {
  it('create activity forwards metadata payload (category/field) unchanged to persistence', async () => {
    const metadata = { category: 'birth-outcomes', field: 'birth_outcomes' };
    const activityRepository: any = {
      createActivity: jest.fn().mockResolvedValue(
        new Activity(
          'a1',
          'client-123',
          'note',
          'nice birth',
          metadata,
          new Date('2026-03-24T10:00:00.000Z'),
          'admin-uuid',
          'Jordan Bony',
          'admin'
        )
      ),
    };
    const useCase = new ClientUseCase({} as any, activityRepository);

    await useCase.createActivity('client-123', 'note', 'nice birth', metadata, 'admin-uuid');

    expect(activityRepository.createActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'client-123',
        type: 'note',
        description: 'nice birth',
        metadata: { category: 'birth-outcomes', field: 'birth_outcomes' },
        createdBy: 'admin-uuid',
      })
    );
  });

  it('fetch/serialize activity includes metadata keys for history filtering', () => {
    const activity = new Activity(
      'a2',
      'client-123',
      'note',
      'nice birth',
      { category: 'birth-outcomes', field: 'birth_outcomes' },
      new Date('2026-03-24T10:01:00.000Z'),
      'admin-uuid',
      'Jordan Bony',
      'admin'
    );

    const dto = ActivityMapper.fromCloudActivity(activity);

    expect(dto.metadata).toEqual(
      expect.objectContaining({
        category: 'birth-outcomes',
        field: 'birth_outcomes',
      })
    );
  });

  it('regression: note creation without metadata still works', async () => {
    const activityRepository: any = {
      createActivity: jest.fn().mockResolvedValue(
        new Activity(
          'a3',
          'client-123',
          'note',
          'plain note',
          {},
          new Date('2026-03-24T10:02:00.000Z'),
          'admin-uuid',
          'Jordan Bony',
          'admin'
        )
      ),
    };
    const useCase = new ClientUseCase({} as any, activityRepository);

    await expect(
      useCase.createActivity('client-123', 'note', 'plain note', {}, 'admin-uuid')
    ).resolves.toBeInstanceOf(Activity);
    expect(activityRepository.createActivity).toHaveBeenCalled();
  });
});
