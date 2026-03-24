import { Activity } from '../entities/Activity';
import { ActivityMapper } from '../mappers/ActivityMapper';

describe('Activity serializer creator fields', () => {
  it('includes created_by_name for admin creator', () => {
    const activity = new Activity(
      'a1b2c3',
      'client-123',
      'note',
      'Follow-up complete',
      { category: 'general' },
      new Date('2026-03-23T20:31:00.000Z'),
      '528e4d28-b24a-47f1-a66b-d7ddd507b7b9',
      'Jordan Bony',
      'admin'
    );

    const dto = ActivityMapper.fromCloudActivity(activity);

    expect(dto.created_by).toBe('528e4d28-b24a-47f1-a66b-d7ddd507b7b9');
    expect(dto.created_by_name).toBe('Jordan Bony');
    expect(dto.created_by_role).toBe('admin');
  });

  it('falls back to email when names are missing', () => {
    const activity = new Activity(
      'a1b2c4',
      'client-123',
      'note',
      'No full name available',
      { createdByName: 'info@techluminateacademy.com' },
      new Date('2026-03-23T20:31:00.000Z'),
      '528e4d28-b24a-47f1-a66b-d7ddd507b7b9'
    );

    const dto = ActivityMapper.fromCloudActivity(activity);

    expect(dto.created_by_name).toBe('info@techluminateacademy.com');
  });

  it('falls back to "Staff member" when lookup/snapshot is missing', () => {
    const activity = new Activity(
      'a1b2c5',
      'client-123',
      'note',
      'Creator not resolvable',
      {},
      new Date('2026-03-23T20:31:00.000Z'),
      '528e4d28-b24a-47f1-a66b-d7ddd507b7b9'
    );

    const dto = ActivityMapper.fromCloudActivity(activity);

    expect(dto.created_by_name).toBe('Staff member');
  });
});
