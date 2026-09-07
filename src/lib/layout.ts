/**
 * Lane packing for the time axis — the spec's preferred collision strategy.
 *
 * The prototype cascaded overlapping cards downward using a hardcoded card
 * height, so the moment cards grew a tags row the packing was wrong and cards
 * covered each other. Nothing here knows how tall a card is, and callers must
 * keep it that way:
 *
 *   **Lanes are decided by real time and nothing else.** Two cards go side by
 *   side only when the activities themselves overlap. A stop running 17:45 to
 *   18:00 shares no time with one starting at 18:00 and must never be laned
 *   against it — not because it is short, not because its text is tall, not
 *   for any reason. Passing a rendered height in as `end` breaks that, which
 *   is precisely what this module used to be fed.
 *
 * Sizing a card to its content is the caller's problem, solved after packing
 * (see `TimedColumn`), never by widening what it declares here.
 */

export type LaneInput = {
  id: string;
  /** Axis position in minutes. */
  start: number;
  /** When the activity itself ends: `start + duration`. Never a pixel height. */
  end: number;
};

/**
 * The span of an activity with no duration.
 *
 * Zero would make a card at 12:00 reuse the lane of another card at 12:00 —
 * they genuinely collide and must sit side by side. Any positive value fixes
 * that, and an infinitesimal one is the only value that cannot also reach
 * forward and collide with a *later* start time.
 */
export const INSTANT_MINUTES = 1e-6;

export type LanePlacement = LaneInput & {
  /** 0-based column within the cluster. */
  lane: number;
  /** How many lanes the surrounding collision cluster needs. */
  lanes: number;
};

/**
 * Assigns each entry a lane such that no two entries sharing a lane overlap in
 * time, and reports how wide the local cluster is so callers can size cards.
 *
 * Cards are grouped into clusters of transitively-overlapping entries, and
 * `lanes` is computed per cluster — so one crowded hour doesn't squeeze the
 * rest of the day into narrow columns.
 */
export function packLanes(input: LaneInput[]): LanePlacement[] {
  const sorted = [...input].sort((a, b) => a.start - b.start || b.end - a.end);

  const result: LanePlacement[] = [];
  let cluster: LanePlacement[] = [];
  let clusterEnd = -Infinity;
  let laneEnds: number[] = [];

  const flush = () => {
    const lanes = Math.max(laneEnds.length, 1);
    for (const placement of cluster) result.push({ ...placement, lanes });
    cluster = [];
    laneEnds = [];
  };

  for (const entry of sorted) {
    // A gap with nothing running means the previous cluster is closed, and the
    // next card can go back to full width.
    if (entry.start >= clusterEnd) {
      flush();
      clusterEnd = -Infinity;
    }

    let lane = laneEnds.findIndex((end) => end <= entry.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(entry.end);
    } else {
      laneEnds[lane] = entry.end;
    }

    cluster.push({ ...entry, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, entry.end);
  }
  flush();

  return result;
}
