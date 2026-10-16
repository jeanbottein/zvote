import { useState, type PointerEvent } from 'react';
import { MinusIcon, PlusIcon } from '../ui/icons';
import { formatCount } from '../utils/formatCount';
import { placeOf } from './geography';
import worldMap from './worldMap.json';
import './statistics.css';

/** A count at a time zone's city. */
export interface Dot {
  timeZone: string;
  count: number;
}

interface WorldMapProps {
  dots: Dot[];
  /** What the counts are of, for the map's description: "visitors". */
  what: string;
  selected: string | null;
  onSelect(timeZone: string | null): void;
  /** Bumped to bring the selected dot into view, when it was chosen elsewhere than on the map. */
  focus?: number;
}

interface View {
  x: number;
  y: number;
  width: number;
}

const { width: WIDTH, height: HEIGHT, land } = worldMap;
const WHOLE: View = { x: 0, y: 0, width: WIDTH };
const CLOSEST = WIDTH / 16;
/** How far a press may move and still be a tap, in pixels. */
const TAP = 6;
/** Dots' radii on the whole map, in its units; they keep their size on screen when zoomed. */
const SMALLEST = 5;
const LARGEST = 22;
/** How near a tap must be to a dot to choose it, on the whole map, in its units. */
const REACH = 40;

/** A dot's radius: its area follows its count. */
export function radiusOf(count: number, largest: number): number {
  return SMALLEST + (LARGEST - SMALLEST) * Math.sqrt(Math.max(0, count) / Math.max(1, largest));
}

/**
 * The land and nothing else, no country and no border, in the Equal Earth
 * projection, with a dot at each time zone's city: its area is its count.
 * Tap near a dot to choose it; zoom with the buttons, and drag to look
 * around once zoomed in.
 *
 * The map is a picture for the pointer: the table beside it says the same
 * for every other way of reading.
 */
export default function WorldMap({ dots, what, selected, onSelect, focus = 0 }: WorldMapProps) {
  const [view, setView] = useState(WHOLE);
  /** A press under way: where it started, and whether it has moved far enough to be a drag. */
  const [drag, setDrag] = useState<{ x: number; y: number; from: View; moved: boolean } | null>(null);
  const [focused, setFocused] = useState(focus);
  const height = (view.width * HEIGHT) / WIDTH;
  const zoomed = view.width < WIDTH;
  const scale = view.width / WIDTH;
  const largest = Math.max(1, ...dots.map((dot) => dot.count));
  // Drawn: those with a place on the map, the largest first so that the small stay on top.
  const drawn = dots
    .map((dot) => ({ ...dot, ...placeOf(dot.timeZone) }))
    .filter((dot): dot is Dot & { x: number; y: number; city: string; region: string } =>
      dot.x !== undefined && dot.y !== undefined)
    .sort((a, b) => b.count - a.count);
  const chosen = drawn.find((dot) => dot.timeZone === selected);

  // Brings a dot chosen in the table into view: adjusting state while
  // rendering, when the request is new (React's way, not an effect).
  if (focus !== focused) {
    setFocused(focus);
    if (chosen) {
      const width = Math.min(view.width, WIDTH / 4);
      setView(clampView({ x: chosen.x - width / 2, y: chosen.y - (width * HEIGHT) / WIDTH / 2, width }));
    }
  }

  const zoom = (factor: number) => setView((current) => {
    const width = Math.min(WIDTH, Math.max(CLOSEST, current.width / factor));
    const centreX = current.x + current.width / 2;
    const centreY = current.y + (current.width * HEIGHT) / WIDTH / 2;
    return clampView({ x: centreX - width / 2, y: centreY - (width * HEIGHT) / WIDTH / 2, width });
  });

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrag({ x: event.clientX, y: event.clientY, from: view, moved: false });
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag) {
      return;
    }
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    const moved = drag.moved || Math.hypot(dx, dy) > TAP;
    if (moved !== drag.moved) {
      setDrag({ ...drag, moved });
    }
    const box = event.currentTarget.getBoundingClientRect();
    if (moved && zoomed && box.width > 0) {
      const perPixel = drag.from.width / box.width;
      setView(clampView({ x: drag.from.x - dx * perPixel, y: drag.from.y - dy * perPixel, width: drag.from.width }));
    }
  };

  /** The dot pressed, or else the nearest within reach of the press. */
  const dotAt = (event: PointerEvent<SVGSVGElement>, press: { x: number; y: number }) => {
    const pressed = event.target instanceof Element ? event.target.getAttribute('data-zone') : null;
    const box = event.currentTarget.getBoundingClientRect();
    if (pressed || box.width === 0) {
      return pressed;
    }
    const x = view.x + ((press.x - box.left) / box.width) * view.width;
    const y = view.y + ((press.y - box.top) / box.height) * height;
    let nearest: string | null = null;
    let distance = REACH * scale;
    for (const dot of drawn) {
      const away = Math.hypot(dot.x - x, dot.y - y) - radiusOf(dot.count, largest) * scale;
      if (away < distance) {
        distance = away;
        nearest = dot.timeZone;
      }
    }
    return nearest;
  };

  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (drag && !drag.moved) {
      onSelect(dotAt(event, drag));
    }
    setDrag(null);
  };

  return (
    <div className="world-map">
      <svg
        className="world-map-view"
        viewBox={`${view.x} ${view.y} ${view.width} ${height}`}
        role="img"
        aria-label={`World map of ${what} by time zone. The table below lists the same numbers.`}
        data-zoomed={zoomed || undefined}
        data-dragging={drag?.moved || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
      >
        <path className="world-map-land" d={land} />
        {drawn.map((dot) => (
          <circle key={dot.timeZone} className="world-map-dot" data-zone={dot.timeZone}
            cx={dot.x} cy={dot.y} r={radiusOf(dot.count, largest) * scale} />
        ))}
        {chosen && (
          <circle className="world-map-chosen" cx={chosen.x} cy={chosen.y}
            r={(radiusOf(chosen.count, largest) + 3) * scale} />
        )}
      </svg>
      <div className="world-map-footer">
        <Legend largest={dots.length ? largest : 0} />
        <div className="world-map-zoom">
          <button type="button" className="icon-button" aria-label="Zoom out" disabled={!zoomed}
            onClick={() => zoom(0.5)}>
            <MinusIcon />
          </button>
          <button type="button" className="icon-button" aria-label="Zoom in" disabled={view.width <= CLOSEST}
            onClick={() => zoom(2)}>
            <PlusIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

/** What the dots mean: from fewer to the largest count. */
function Legend({ largest }: { largest: number }) {
  if (largest === 0) {
    return <p className="world-map-legend">No place to show yet.</p>;
  }
  return (
    <p className="world-map-legend">
      <span className="world-map-legend-dot" data-size="small" />
      fewer
      <span className="world-map-legend-dot" data-size="large" />
      up to {formatCount(largest)}
    </p>
  );
}

/** Keeps the view over the map. */
function clampView({ x, y, width }: View): View {
  const height = (width * HEIGHT) / WIDTH;
  return {
    x: Math.min(WIDTH - width, Math.max(0, x)),
    y: Math.min(HEIGHT - height, Math.max(0, y)),
    width,
  };
}
