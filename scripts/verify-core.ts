/**
 * Sanity checks for the two things the prototype got wrong: cross-midnight
 * time handling, and axis collision.
 *
 *   npx tsx scripts/verify-core.ts
 */
import { packLanes, type LaneInput } from '../src/lib/layout';
import {
  axisRangeFor,
  fromAxisMinutes,
  normaliseTime,
  toAxisMinutes,
} from '../src/lib/time';

let failures = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

console.log('\nTime — cross-midnight is explicit, never inferred');

check('19:33 on the day itself', toAxisMinutes('19:33', 0) === 19 * 60 + 33);
check('00:47 after midnight sorts later', toAxisMinutes('00:47', 1) === 1487);
check(
  'the Anfield return lands after its departure',
  toAxisMinutes('00:47', 1)! > toAxisMinutes('19:33', 0)!,
);
check(
  'a 04:00 start is NOT silently treated as tomorrow',
  toAxisMinutes('04:00', 0) === 240,
);
check('unscheduled stays null', toAxisMinutes(null, 0) === null);

const roundTrip = fromAxisMinutes(1487);
check('round trip preserves both halves', roundTrip.time === '00:47' && roundTrip.dayOffset === 1, roundTrip);
check('negative input clamps', fromAxisMinutes(-90).time === '00:00');

check('"9:5" is rejected', normaliseTime('9:5') === null);
check('"9:05" normalises', normaliseTime('9:05') === '09:05');
check('"0905" normalises', normaliseTime('0905') === '09:05');
check('"25:00" is rejected', normaliseTime('25:00') === null);
check('empty is null', normaliseTime('') === null);

console.log('\nAxis window — one window, shared by every timed column');

const defaultWindow = axisRangeFor([]);
check(
  'defaults to 06:00–02:00',
  defaultWindow.start === 360 && defaultWindow.end === 1560,
  defaultWindow,
);

const earlyWindow = axisRangeFor([
  { time: '06:00', dayOffset: 0, durationMin: 300 },
  { time: '00:47', dayOffset: 1, durationMin: null },
]);
check('grows to contain a post-midnight item', earlyWindow.end >= 1487, earlyWindow);

const veryEarly = axisRangeFor([
  { time: '04:30', dayOffset: 0, durationMin: null },
]);
check('grows upward for an early departure', veryEarly.start <= 270, veryEarly);

console.log('\nLane packing — cards must never cover each other');

/** Two cards collide if they share a lane and their spans overlap. */
function overlaps(input: LaneInput[]) {
  const placed = packLanes(input);
  for (let i = 0; i < placed.length; i += 1) {
    for (let j = i + 1; j < placed.length; j += 1) {
      const a = placed[i];
      const b = placed[j];
      if (a.lane !== b.lane) continue;
      if (a.start < b.end && b.start < a.end) return { a, b };
    }
  }
  return null;
}

check(
  '12:00 and 12:15 with tall cards do not collide',
  overlaps([
    { id: 'a', start: 720, end: 720 + 55 },
    { id: 'b', start: 735, end: 735 + 55 },
  ]) === null,
);

const packedPair = packLanes([
  { id: 'a', start: 720, end: 775 },
  { id: 'b', start: 735, end: 790 },
]);
check('overlapping pair uses two lanes', packedPair.every((p) => p.lanes === 2), packedPair);

check(
  'a card after a gap goes back to full width',
  packLanes([
    { id: 'a', start: 600, end: 660 },
    { id: 'b', start: 900, end: 960 },
  ]).every((p) => p.lanes === 1),
);

// The real Saturday: eleven stops, several 45 minutes apart, with cards whose
// measured height needs ~55 minutes of axis. This is the case the prototype's
// fixed card-height constant got wrong once tags were added.
const saturday = ['09:00', '09:45', '10:30', '11:15', '12:00', '12:45', '14:00', '15:00', '16:15', '17:00', '19:00'];
const measuredSpan = 55;
check(
  'the real Sat 10 itinerary packs with no overlap',
  overlaps(
    saturday.map((time, index) => {
      const start = toAxisMinutes(time, 0)!;
      return { id: `s${index}`, start, end: start + measuredSpan };
    }),
  ) === null,
);

// Randomised: whatever the input, no two cards may share a lane and a moment.
let randomFailures = 0;
for (let trial = 0; trial < 2000; trial += 1) {
  const count = 1 + Math.floor(Math.random() * 12);
  const input: LaneInput[] = Array.from({ length: count }, (_, index) => {
    const start = 360 + Math.floor(Math.random() * 1100);
    return { id: `r${index}`, start, end: start + 10 + Math.floor(Math.random() * 180) };
  });
  if (overlaps(input)) randomFailures += 1;
}
check(`2000 random layouts stay collision-free`, randomFailures === 0, { randomFailures });

console.log(
  failures === 0
    ? '\nAll core checks passed.\n'
    : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
