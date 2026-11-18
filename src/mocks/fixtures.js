// Shared seat-map fixtures (VEN-004), synced from the venues repository by
// scripts/sync-map-fixtures.sh. Never edit the JSON files by hand.
import manifest from './fixtures/maps/manifest.json' with { type: 'json' }
import duplicateLabel from './fixtures/maps/duplicate-label.json' with { type: 'json' }
import emptyZone from './fixtures/maps/empty-zone.json' with { type: 'json' }
import multiError from './fixtures/maps/multi-error.json' with { type: 'json' }
import noStage from './fixtures/maps/no-stage.json' with { type: 'json' }
import overlapSeats from './fixtures/maps/overlap-seats.json' with { type: 'json' }
import overlapZones from './fixtures/maps/overlap-zones.json' with { type: 'json' }
import seatWithoutZone from './fixtures/maps/seat-without-zone.json' with { type: 'json' }
import unnamedZone from './fixtures/maps/unnamed-zone.json' with { type: 'json' }
import validV1 from './fixtures/maps/valid-v1.json' with { type: 'json' }

export const MAP_FIXTURES = Object.freeze({
  'valid-v1.json': validV1,
  'seat-without-zone.json': seatWithoutZone,
  'empty-zone.json': emptyZone,
  'overlap-seats.json': overlapSeats,
  'overlap-zones.json': overlapZones,
  'unnamed-zone.json': unnamedZone,
  'duplicate-label.json': duplicateLabel,
  'no-stage.json': noStage,
  'multi-error.json': multiError,
})

/** `{ "<file>": { description, expectedErrors } }` */
export const MAP_FIXTURE_MANIFEST = manifest.fixtures
