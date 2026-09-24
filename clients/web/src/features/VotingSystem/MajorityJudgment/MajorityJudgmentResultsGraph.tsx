import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { computeMJAnalysis, formatGMJScore, type JudgmentCounts } from '../../../utils/majorityJudgment';
import { MENTION_NAMES, MENTIONS_BEST_FIRST } from './mentions';

interface MajorityJudgmentResultsGraphProps {
  optionLabel: string;
  judgmentCounts: JudgmentCounts;
  totalBallots: number;
  compact?: boolean;
  rank?: number;
  isExAequo?: boolean;
}

const TICKS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const MEDALS = ['gold', 'silver', 'bronze'];
const percent = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });

/** Each mention given, best first: where its slice starts, its share, and the share of it or better, in %. */
function slicesOf(counts: JudgmentCounts, total: number) {
  const slices = [];
  let before = 0;
  for (const mention of MENTIONS_BEST_FIRST) {
    const count = counts[mention] || 0;
    if (count > 0) {
      slices.push({
        mention,
        start: (before / total) * 100,
        share: (count / total) * 100,
        orBetter: ((before + count) / total) * 100,
      });
    }
    before += count;
  }
  return slices;
}

/**
 * One option's merit profile: how its ballots spread over the seven mentions,
 * best on the left, as one bar over a graduated axis. The mention above the
 * axis's bold 50% mark is the option's majority mention.
 *
 * Pointing at a mention (or tapping it) dims the worse ones and says how many
 * voters gave that mention or better. Nothing moves.
 */
export default function MajorityJudgmentResultsGraph({
  optionLabel,
  judgmentCounts,
  totalBallots,
  compact = false,
  rank,
  isExAequo = false,
}: MajorityJudgmentResultsGraphProps) {
  const [focused, setFocused] = useState<number | null>(null);
  const chart = useRef<HTMLDivElement>(null);
  const analysis = computeMJAnalysis(judgmentCounts);

  // Details shown by a tap go away with a tap anywhere else.
  useEffect(() => {
    if (focused === null) return;
    const dismiss = (event: PointerEvent) => {
      if (!chart.current?.contains(event.target as Node)) setFocused(null);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [focused]);
  const empty = totalBallots === 0;
  const slices = slicesOf(judgmentCounts, totalBallots);
  const focus = focused === null ? undefined : slices[focused];
  const medal = rank && rank <= 3 ? MEDALS[rank - 1] : 'false';
  const description = empty
    ? `${optionLabel}: no ballots yet`
    : `${optionLabel}: ${slices.map((s) => `${MENTION_NAMES[s.mention]} ${percent.format(s.share)}%`).join(', ')}`;

  return (
    <div className="mj-results-card" data-compact={compact} data-winner={!empty && rank === 1}>
      <div className="mj-results-header">
        <div className="mj-results-title-section">
          {!empty && rank && (
            <div className="mj-rank-container">
              <div className="mj-rank-badge" data-medal={medal}>{rank}</div>
              {isExAequo && <span className="mj-ex-aequo">ex aequo</span>}
            </div>
          )}
          <div className="mj-results-title">{optionLabel}</div>
        </div>
      </div>

      <div
        ref={chart}
        className="mj-results-chart"
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') setFocused(null);
        }}
      >
        <div className="mj-results-bars" role="img" aria-label={description}>
          {slices.map((slice, index) => (
            <div
              key={slice.mention}
              className="mj-results-bar"
              data-judgment={slice.mention}
              data-dimmed={focused !== null && index > focused}
              style={{ width: `${slice.share}%` }}
              onPointerEnter={(event) => {
                if (event.pointerType === 'mouse') setFocused(index);
              }}
              onPointerDown={(event) => {
                if (event.pointerType !== 'mouse') setFocused((current) => (current === index ? null : index));
              }}
            />
          ))}
        </div>
        {focus && (
          <div
            className="mj-results-tooltip"
            aria-hidden="true"
            style={{ '--at': `${focus.start + focus.share / 2}%` } as CSSProperties}
          >
            <strong>{MENTION_NAMES[focus.mention]}: {percent.format(focus.share)}%</strong>
            {focused !== 0 && (
              <span>{percent.format(focus.orBetter)}% say {MENTION_NAMES[focus.mention]} or better</span>
            )}
          </div>
        )}
      </div>

      <div className="mj-results-axis" aria-hidden="true">
        {TICKS.map((tick) => (
          <div
            key={tick}
            className="mj-tick"
            data-major={tick === 50}
            style={{ '--left': `${tick}%` } as CSSProperties}
          >
            <span className="mj-tick-label">{tick}%</span>
          </div>
        ))}
      </div>

      {!empty && (
        <div className="mj-results-badges-below">
          <div className="mj-results-badges">
            <span className="mj-results-hint">Majority Mention:</span>
            <div className="mj-results-badge" data-judgment={analysis.majorityMention}>
              {MENTION_NAMES[analysis.majorityMention]}
            </div>
            <span className="mj-results-hint">GMJ Score:</span>
            <div
              className="mj-score-badge"
              title={`GMJ's usual judgment score: ${analysis.gmdScore.toFixed(4)}. It breaks ties between options with the same majority mention.`}
            >
              {formatGMJScore(analysis.gmdScore)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
