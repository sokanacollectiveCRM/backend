import {
  formatClientCsvCell,
  rowsToClientCsv,
} from '../repositories/cloudSqlClientRepository';

describe('client CSV full-field export helpers', () => {
  it('formats null, scalars, dates, arrays, and objects', () => {
    expect(formatClientCsvCell(null)).toBe('');
    expect(formatClientCsvCell(undefined)).toBe('');
    expect(formatClientCsvCell('Ada')).toBe('"Ada"');
    expect(formatClientCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(formatClientCsvCell(true)).toBe('"true"');
    expect(formatClientCsvCell(['Pitocin', 'Epidural'])).toBe(
      '"Pitocin;Epidural"'
    );
    expect(formatClientCsvCell({ a: 1 })).toBe('"{""a"":1}"');
    expect(formatClientCsvCell(new Date('2026-01-15T00:00:00.000Z'))).toBe(
      '"2026-01-15T00:00:00.000Z"'
    );
  });

  it('exports all columns present on each row', () => {
    const csv = rowsToClientCsv([
      {
        id: 'c1',
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'ada@example.test',
        annual_income: '45000',
        address_line1: '1 Analytical Eng',
        health_history: 'n/a',
        services_interested: ['Labor Support', 'Postpartum'],
        birth_outcomes_medications_used: ['Pitocin'],
      },
    ]);
    const header = csv.split('\n')[0];
    expect(header).toContain('id');
    expect(header).toContain('email');
    expect(header).toContain('health_history');
    expect(header).toContain('services_interested');
    expect(header).toContain('birth_outcomes_medications_used');
    expect(csv).toContain('Labor Support;Postpartum');
    expect(csv).toContain('Pitocin');
  });
});
