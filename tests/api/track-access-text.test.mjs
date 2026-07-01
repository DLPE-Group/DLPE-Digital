import { describe, it, expect } from 'vitest';
import { allowedFromTracksText } from '../../server/src/domain/cards.service.ts';

// Resolving a role's track-label text to the tenant's track keys must be a
// whole-word match — a key must never be granted because it is a SUBSTRING of
// another track's key/label (the over-grant regression for custom tracks).
describe('allowedFromTracksText (role labels → track keys)', () => {
  const tenant = ['sales', 'operations', 'workshop', 'finance', 'legal', 'paralegal'];

  it('"All tracks" grants every tenant track (incl. custom)', () => {
    expect(allowedFromTracksText(['All tracks'], tenant).sort()).toEqual([...tenant].sort());
  });

  it('a specific track grants only that track', () => {
    expect(allowedFromTracksText(['Sales'], tenant)).toEqual(['sales']);
    expect(allowedFromTracksText(['Workshop (read)'], tenant)).toEqual(['workshop']);
  });

  it('does NOT over-grant via substring (Paralegal must not grant legal)', () => {
    expect(allowedFromTracksText(['Paralegal'], tenant)).toEqual(['paralegal']);
    expect(allowedFromTracksText(['Legal'], tenant)).toEqual(['legal']);
  });
});
