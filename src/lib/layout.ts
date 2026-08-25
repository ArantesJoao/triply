/**
 * Lane packing for the time axis — the spec's preferred collision strategy.
 *
 * The prototype cascaded overlapping cards downward using a hardcoded card
 * height, so the moment cards grew a tags row the packing was wrong and cards
 * covered each other. Nothing here knows how tall a card is: callers pass the
 * span each card actually occupies (already widened to its *measured* rendered
 * height, see `useMeasuredSpans`), and this module only decides which lane it
 * sits in.
 */

export type LaneInput = {
  id: string;
  /** Axis position in minutes. */
  start: number;
  /** start + whichever is larger: the item's duration or its measured height. */
  end: number;
};

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
