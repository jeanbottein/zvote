import type { JudgmentCounts, PollOption } from '../../../api/types';
import { ranked } from '../ranked';
import MajorityJudgmentResultsGraph from './MajorityJudgmentResultsGraph';
import './mentions.css';
import './majority-judgment.css';

const NO_JUDGMENTS: JudgmentCounts = {
  Bad: 0, Inadequate: 0, Passable: 0, Fair: 0, Good: 0, VeryGood: 0, Excellent: 0,
};

const ballotsOf = (counts: JudgmentCounts) => Object.values(counts).reduce((sum, count) => sum + count, 0);

/** The options as the server ranked them, best first, one merit profile each. */
export default function MajorityJudgmentResults({ options }: { options: PollOption[] }) {
  const places = ranked(options);
  const hasBallots = places.some((place) => ballotsOf(place.option.judgmentCounts ?? NO_JUDGMENTS) > 0);

  return (
    <div className="mj-results">
      {places.map(({ option, rank, exAequo }) => {
        const counts = option.judgmentCounts ?? NO_JUDGMENTS;
        return (
          <MajorityJudgmentResultsGraph
            key={option.id}
            optionLabel={option.label}
            judgmentCounts={counts}
            totalBallots={ballotsOf(counts)}
            majorityMention={option.majorityMention}
            score={option.score}
            rank={hasBallots ? rank : undefined}
            isExAequo={hasBallots && exAequo}
          />
        );
      })}
    </div>
  );
}
