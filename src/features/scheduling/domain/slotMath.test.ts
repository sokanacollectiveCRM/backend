import { ValidationError } from '../../../domains/errors';
import {
  assertSlotQueryRange,
  computeOpenSlots,
  intervalsOverlap,
  isFullyInsideAnyWindow,
  parseDurationMinutes,
} from './slotMath';

const durationMinutes = 60;

describe('slot math', () => {
  it('cuts fixed 60-minute slots aligned to the available window start', () => {
    const slots = computeOpenSlots({
      windows: [
        {
          startAt: new Date('2026-10-13T15:00:00.000Z'),
          endAt: new Date('2026-10-13T19:00:00.000Z'),
        },
      ],
      blackouts: [],
      bookings: [],
      from: new Date('2026-10-13T00:00:00.000Z'),
      to: new Date('2026-10-20T00:00:00.000Z'),
      durationMinutes,
      now: new Date('2026-10-12T00:00:00.000Z'),
    });

    expect(slots).toEqual([
      {
        startAt: '2026-10-13T15:00:00.000Z',
        endAt: '2026-10-13T16:00:00.000Z',
      },
      {
        startAt: '2026-10-13T16:00:00.000Z',
        endAt: '2026-10-13T17:00:00.000Z',
      },
      {
        startAt: '2026-10-13T17:00:00.000Z',
        endAt: '2026-10-13T18:00:00.000Z',
      },
      {
        startAt: '2026-10-13T18:00:00.000Z',
        endAt: '2026-10-13T19:00:00.000Z',
      },
    ]);
  });

  it('subtracts blackouts and pending/approved bookings', () => {
    const slots = computeOpenSlots({
      windows: [
        {
          startAt: new Date('2026-10-13T15:00:00.000Z'),
          endAt: new Date('2026-10-13T19:00:00.000Z'),
        },
      ],
      blackouts: [
        {
          startAt: new Date('2026-10-13T16:00:00.000Z'),
          endAt: new Date('2026-10-13T17:00:00.000Z'),
        },
      ],
      bookings: [
        {
          startAt: new Date('2026-10-13T17:00:00.000Z'),
          endAt: new Date('2026-10-13T18:00:00.000Z'),
        },
      ],
      from: new Date('2026-10-13T00:00:00.000Z'),
      to: new Date('2026-10-20T00:00:00.000Z'),
      durationMinutes,
      now: new Date('2026-10-12T00:00:00.000Z'),
    });

    expect(slots.map((slot) => slot.startAt)).toEqual([
      '2026-10-13T15:00:00.000Z',
      '2026-10-13T18:00:00.000Z',
    ]);
  });

  it('drops past slots and keeps only future ones', () => {
    const slots = computeOpenSlots({
      windows: [
        {
          startAt: new Date('2026-10-13T15:00:00.000Z'),
          endAt: new Date('2026-10-13T18:00:00.000Z'),
        },
      ],
      blackouts: [],
      bookings: [],
      from: new Date('2026-10-13T00:00:00.000Z'),
      to: new Date('2026-10-20T00:00:00.000Z'),
      durationMinutes,
      now: new Date('2026-10-13T16:00:00.000Z'),
    });

    expect(slots.map((slot) => slot.startAt)).toEqual([
      '2026-10-13T16:00:00.000Z',
      '2026-10-13T17:00:00.000Z',
    ]);
  });

  it('keeps 60-minute UTC slots across the America/Chicago DST fallback on 2026-11-01', () => {
    // 01:00 CDT (06:00Z) through 03:00 CST (09:00Z). Local clocks repeat 1 AM;
    // UTC still advances in exact 60-minute steps.
    const slots = computeOpenSlots({
      windows: [
        {
          startAt: new Date('2026-11-01T06:00:00.000Z'),
          endAt: new Date('2026-11-01T09:00:00.000Z'),
        },
      ],
      blackouts: [],
      bookings: [],
      from: new Date('2026-11-01T00:00:00.000Z'),
      to: new Date('2026-11-08T00:00:00.000Z'),
      durationMinutes,
      now: new Date('2026-10-31T00:00:00.000Z'),
    });

    expect(slots).toEqual([
      {
        startAt: '2026-11-01T06:00:00.000Z',
        endAt: '2026-11-01T07:00:00.000Z',
      },
      {
        startAt: '2026-11-01T07:00:00.000Z',
        endAt: '2026-11-01T08:00:00.000Z',
      },
      {
        startAt: '2026-11-01T08:00:00.000Z',
        endAt: '2026-11-01T09:00:00.000Z',
      },
    ]);
    for (const slot of slots) {
      expect(
        new Date(slot.endAt).getTime() - new Date(slot.startAt).getTime()
      ).toBe(60 * 60 * 1000);
    }
  });

  it('rejects a query range longer than 14 days', () => {
    expect(() =>
      assertSlotQueryRange(
        new Date('2026-10-01T00:00:00.000Z'),
        new Date('2026-10-16T00:00:00.001Z')
      )
    ).toThrow(ValidationError);

    expect(() =>
      computeOpenSlots({
        windows: [],
        blackouts: [],
        bookings: [],
        from: new Date('2026-10-01T00:00:00.000Z'),
        to: new Date('2026-10-15T00:00:00.001Z'),
        durationMinutes,
        now: new Date('2026-10-01T00:00:00.000Z'),
      })
    ).toThrow(/14 days/);
  });

  it('allows an exact 14-day range', () => {
    expect(() =>
      assertSlotQueryRange(
        new Date('2026-10-01T00:00:00.000Z'),
        new Date('2026-10-15T00:00:00.000Z')
      )
    ).not.toThrow();
  });

  it('rejects non-60 durationMinutes', () => {
    expect(() => parseDurationMinutes(30)).toThrow(ValidationError);
    expect(parseDurationMinutes(undefined)).toBe(60);
  });

  it('detects overlap and window containment', () => {
    const window = {
      startAt: new Date('2026-10-13T15:00:00.000Z'),
      endAt: new Date('2026-10-13T19:00:00.000Z'),
    };
    const inside = {
      startAt: new Date('2026-10-13T16:00:00.000Z'),
      endAt: new Date('2026-10-13T17:00:00.000Z'),
    };
    const outside = {
      startAt: new Date('2026-10-13T18:30:00.000Z'),
      endAt: new Date('2026-10-13T19:30:00.000Z'),
    };
    expect(isFullyInsideAnyWindow(inside, [window])).toBe(true);
    expect(isFullyInsideAnyWindow(outside, [window])).toBe(false);
    expect(intervalsOverlap(inside, window)).toBe(true);
  });
});
