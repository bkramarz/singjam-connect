import { describe, it, expect } from 'vitest';
import {
  jamTicketState,
  summarizeTicketTiers,
  type JamTicketSummary,
  type JamTicketTier,
} from './jamTicketState';

const NOW = new Date('2026-09-08T12:00:00Z');

function summary(over: Partial<JamTicketSummary> = {}): JamTicketSummary {
  return {
    jam_id: 'j1',
    tier_count: 2,
    on_sale_count: 2,
    min_price_cents: 1500,
    currency: 'usd',
    sold_out: false,
    next_sales_start_at: null,
    ...over,
  };
}

describe('jamTicketState', () => {
  it('prefers an external link over on-site tiers', () => {
    expect(jamTicketState('https://tickets.example.com', summary(), { now: NOW })).toEqual({
      label: 'Tickets',
      url: 'https://tickets.example.com',
      muted: false,
    });
  });

  it('shows nothing for an event with no tiers and no link', () => {
    expect(jamTicketState(null, null, { now: NOW })).toBeNull();
    expect(jamTicketState(null, summary({ tier_count: 0, on_sale_count: 0 }), { now: NOW })).toBeNull();
  });

  it('names the cheapest on-sale price', () => {
    expect(jamTicketState(null, summary(), { now: NOW })?.label).toBe('From $15');
  });

  it('drops the "From" when there is only one tier', () => {
    expect(jamTicketState(null, summary({ tier_count: 1, on_sale_count: 1 }), { now: NOW })?.label).toBe('$15');
  });

  it('keeps cents when the price is not whole dollars', () => {
    expect(jamTicketState(null, summary({ min_price_cents: 1250 }), { now: NOW })?.label).toBe('From $12.50');
  });

  it('labels a zero-price tier Free', () => {
    expect(jamTicketState(null, summary({ min_price_cents: 0 }), { now: NOW })?.label).toBe('Free');
  });

  it('reports sold out ahead of price', () => {
    expect(jamTicketState(null, summary({ sold_out: true, on_sale_count: 0 }), { now: NOW })).toEqual({
      label: 'Sold out',
      url: null,
      muted: true,
    });
  });

  it('names the weekday when sales open within a week', () => {
    const state = jamTicketState(
      null,
      summary({ on_sale_count: 0, min_price_cents: null, next_sales_start_at: '2026-09-11T17:00:00Z' }),
      { timezone: 'America/Los_Angeles', now: NOW }
    );
    expect(state).toEqual({ label: 'Tickets open Fri', url: null, muted: true });
  });

  it('names a date when sales open further out', () => {
    const state = jamTicketState(
      null,
      summary({ on_sale_count: 0, min_price_cents: null, next_sales_start_at: '2026-10-02T17:00:00Z' }),
      { timezone: 'America/Los_Angeles', now: NOW }
    );
    expect(state?.label).toBe('Tickets open Oct 2');
  });

  // An evening opening in the Americas is already the next day in UTC, the bug
  // shape that put share previews a day out.
  it('formats the opening in the event timezone, not the runtime one', () => {
    const args = summary({ on_sale_count: 0, min_price_cents: null, next_sales_start_at: '2026-09-12T02:30:00Z' });
    expect(jamTicketState(null, args, { timezone: 'America/Los_Angeles', now: NOW })?.label).toBe('Tickets open Fri');
    expect(jamTicketState(null, args, { timezone: 'UTC', now: NOW })?.label).toBe('Tickets open Sat');
  });

  it('falls back to sales closed when nothing is on sale and nothing reopens', () => {
    const state = jamTicketState(null, summary({ on_sale_count: 0, min_price_cents: null }), { now: NOW });
    expect(state).toEqual({ label: 'Sales closed', url: null, muted: true });
  });
});

function tier(over: Partial<JamTicketTier> = {}): JamTicketTier {
  return {
    jam_id: 'j1',
    ticket_type_id: 't1',
    price_cents: 1500,
    currency: 'usd',
    remaining: null,
    not_yet_open: false,
    closed: false,
    sales_start_at: null,
    ...over,
  };
}

describe('summarizeTicketTiers', () => {
  it('tolerates no rows', () => {
    expect(summarizeTicketTiers(null).size).toBe(0);
    expect(summarizeTicketTiers([]).size).toBe(0);
  });

  it('groups tiers by jam', () => {
    const byJam = summarizeTicketTiers([
      tier({ jam_id: 'a' }),
      tier({ jam_id: 'a', ticket_type_id: 't2' }),
      tier({ jam_id: 'b' }),
    ]);
    expect(byJam.get('a')?.tier_count).toBe(2);
    expect(byJam.get('b')?.tier_count).toBe(1);
  });

  it('takes the cheapest on-sale price and its currency', () => {
    const byJam = summarizeTicketTiers([
      tier({ ticket_type_id: 't1', price_cents: 3600 }),
      tier({ ticket_type_id: 't2', price_cents: 1500 }),
    ]);
    expect(byJam.get('j1')).toMatchObject({ min_price_cents: 1500, currency: 'usd', on_sale_count: 2 });
  });

  // The cheap tier being unavailable is exactly when a listing must not quote
  // its price: "From $15" has to name something a buyer can actually take.
  it('ignores tiers that are not purchasable when pricing', () => {
    const byJam = summarizeTicketTiers([
      tier({ ticket_type_id: 't1', price_cents: 1000, remaining: 0 }),
      tier({ ticket_type_id: 't2', price_cents: 1200, closed: true }),
      tier({ ticket_type_id: 't3', price_cents: 1400, not_yet_open: true, sales_start_at: '2026-10-01T00:00:00Z' }),
      tier({ ticket_type_id: 't4', price_cents: 3600 }),
    ]);
    expect(byJam.get('j1')).toMatchObject({ min_price_cents: 3600, on_sale_count: 1, tier_count: 4 });
  });

  it('is sold out only when every open tier is empty', () => {
    expect(summarizeTicketTiers([tier({ remaining: 0 })]).get('j1')?.sold_out).toBe(true);
    expect(
      summarizeTicketTiers([
        tier({ ticket_type_id: 't1', remaining: 0 }),
        tier({ ticket_type_id: 't2', remaining: 3 }),
      ]).get('j1')?.sold_out
    ).toBe(false);
  });

  it('never calls an uncapped tier sold out', () => {
    expect(summarizeTicketTiers([tier({ remaining: null })]).get('j1')?.sold_out).toBe(false);
  });

  // A closed tier ran out of time, not stock. Counting it would report a
  // sellout no buyer caused.
  it('does not treat closed tiers as sold out', () => {
    const byJam = summarizeTicketTiers([
      tier({ ticket_type_id: 't1', closed: true, remaining: 4 }),
      tier({ ticket_type_id: 't2', closed: true, remaining: 0 }),
    ]);
    expect(byJam.get('j1')).toMatchObject({ sold_out: false, on_sale_count: 0, min_price_cents: null });
  });

  it('excludes closed tiers from the sold-out verdict', () => {
    const byJam = summarizeTicketTiers([
      tier({ ticket_type_id: 't1', closed: true, remaining: 9 }),
      tier({ ticket_type_id: 't2', remaining: 0 }),
    ]);
    expect(byJam.get('j1')?.sold_out).toBe(true);
  });

  it('reports the earliest future opening, and reads as pending not sold out', () => {
    const byJam = summarizeTicketTiers([
      tier({ ticket_type_id: 't1', remaining: 20, not_yet_open: true, sales_start_at: '2026-11-01T00:00:00Z' }),
      tier({ ticket_type_id: 't2', remaining: 10, not_yet_open: true, sales_start_at: '2026-10-01T00:00:00Z' }),
    ]);
    expect(byJam.get('j1')).toMatchObject({
      next_sales_start_at: '2026-10-01T00:00:00Z',
      on_sale_count: 0,
      sold_out: false,
    });
    expect(jamTicketState(null, byJam.get('j1'), { timezone: 'UTC', now: NOW })?.label).toBe('Tickets open Oct 1');
  });

  // The whole point of the fold: what the card ends up saying.
  it('feeds jamTicketState end to end', () => {
    const byJam = summarizeTicketTiers([
      tier({ ticket_type_id: 't1', price_cents: 1500 }),
      tier({ ticket_type_id: 't2', price_cents: 3600 }),
    ]);
    expect(jamTicketState(null, byJam.get('j1'), { now: NOW })?.label).toBe('From $15');
  });
});
