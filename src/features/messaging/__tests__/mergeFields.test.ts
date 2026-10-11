import { addDelay } from '../domain/delays';
import { renderMergeTemplate, unknownMergeFields } from '../domain/mergeFields';

describe('merge fields and delays', () => {
  it('rejects unknown merge fields', () => {
    expect(unknownMergeFields('Hello {{client_first_name}} {{ssn}}')).toEqual([
      'ssn',
    ]);
  });

  it('renders allowed fields', () => {
    expect(
      renderMergeTemplate('Hi {{client_first_name}}', {
        client_first_name: 'Ada',
      })
    ).toBe('Hi Ada');
  });

  it('adds calendar and business days', () => {
    const friday = new Date('2026-10-09T12:00:00.000Z');
    expect(addDelay(friday, 3, 'days').toISOString().slice(0, 10)).toBe(
      '2026-10-12'
    );
    expect(
      addDelay(friday, 1, 'business_days').toISOString().slice(0, 10)
    ).toBe('2026-10-12');
  });
});
