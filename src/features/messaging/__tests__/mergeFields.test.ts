import { unknownMergeFields, renderTemplate } from '../domain/mergeFields';
import { addDelay, windowStartIso } from '../domain/delay';

describe('merge fields and delay', () => {
  it('rejects unknown merge fields', () => {
    expect(unknownMergeFields('Hello {{client_first_name}}')).toEqual([]);
    expect(unknownMergeFields('Secret {{ssn}}')).toEqual(['ssn']);
  });

  it('renders allowed fields', () => {
    expect(
      renderTemplate('Hi {{client_first_name}}', { client_first_name: 'Ada' })
    ).toBe('Hi Ada');
  });

  it('adds calendar days and business days', () => {
    const friday = new Date('2026-10-09T12:00:00.000Z');
    expect(addDelay(friday, 3, 'days').toISOString().slice(0, 10)).toBe(
      '2026-10-12'
    );
    expect(addDelay(friday, 1, 'business_days').toISOString().slice(0, 10)).toBe(
      '2026-10-12'
    );
  });

  it('windows repeating steps', () => {
    const first = new Date('2026-10-01T00:00:00.000Z');
    const later = new Date('2026-10-05T00:00:00.000Z');
    expect(windowStartIso(first, later, 2, 'days')).toBe(
      new Date('2026-10-05T00:00:00.000Z').toISOString()
    );
  });
});
