import { useMemo } from 'react';
import type { PollOption } from '../../../api/types';
import { rankOptions, type JudgmentCounts } from '../../../utils/majorityJudgment';
import MajorityJudgmentResultsGraph from './MajorityJudgmentResultsGraph';
import './majority-judgment.css';

const NO_JUDGMENTS: JudgmentCounts = {
  Bad: 0, Inadequate: 0, Passable: 0, Fair: 0, Good: 0, VeryGood: 0, Excellent: 0,
};

/** Adapts the API's options to the input of rankOptions(). */
export function toRankable(options: PollOption[]) {
  return options.map((option) => {
    const counts = option.judgmentCounts ?? NO_JUDGMENTS;
    return {
      id: option.id,
      label: option.label,
      judgment_counts: counts,
      total_judgments: Object.values(counts).reduce((sum, count) => sum + count, 0),
    };
  });
}

/** The options ranked by majority judgment, best first, one graph each. */
export default function MajorityJudgmentResults({ options }: { options: PollOption[] }) {
  const ranked = useMemo(() => rankOptions(toRankable(options)), [options]);
  const hasBallots = ranked.some((option) => option.total_judgments > 0);

  return (
    <div className="mj-results">
      {ranked.map((option) => (
        <MajorityJudgmentResultsGraph
          key={option.id}
          optionLabel={option.label}
          judgmentCounts={option.judgment_counts}
          totalBallots={option.total_judgments}
          rank={hasBallots ? option.mjAnalysis.rank : undefined}
          isExAequo={hasBallots && option.mjAnalysis.isExAequo}
        />
      ))}
    </div>
  );
}
