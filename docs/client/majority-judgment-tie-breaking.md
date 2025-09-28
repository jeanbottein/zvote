# Majority Judgment Tie-Break Strategies in zvote client

This document describes the tie-break strategies available in zvote client, how each works, and where they are implemented in the codebase. It also clarifies how our default implementation ("jeanbottein") differs from canonical Majority Judgment procedures.

## Overview

- **Strategy registry:** `proto1/client/src/utils/tiebreak/index.ts`
- **Strategy types:** `proto1/client/src/utils/tiebreak/types.ts`
- **UI selector:** `proto1/client/src/components/TieBreakSelector.tsx`
- **Ranking entrypoint:** `proto1/client/src/utils/majorityJudgment.ts` (`rankOptions()` and `compareMJ()` use the active strategy)

The selector persists the chosen strategy in localStorage and both view and vote pages recompute rankings on change:
- `proto1/client/src/pages/JudgmentViewPage.tsx`
- `proto1/client/src/pages/JudgmentVotePage.tsx`

---

## 1) MJ: Iterative truncation (Jeanbottein) — Default

- **Status:** Implemented (Default)
- **Files:**
  - Core analysis (iterations): `proto1/client/src/utils/majorityJudgment.ts` (`computeMJAnalysis()`)
  - Pairwise comparison strategy: `proto1/client/src/utils/tiebreak/mj-tiebreak-jeanbottein.ts`

### How it works
1. Compute a sequence of "majority iterations" for each option:
   - Find the highest mention with ≥ 50% “at least X” on the current tally.
   - Record overshoot strength: `max(0, percentage - 50)`.
   - Remove all ballots at or above that majority mention (global truncation across all mentions ≥ that grade).
   - Repeat until no majority exists.
2. Compare two options lexicographically over iterations:
   - At iteration i, compare mention quality (Excellent > … > Bad).
   - If equal, compare overshoot strength (higher wins).
   - If still equal, continue to the next iteration; if all equal, tie.

### Notes
- This is a deterministic, efficient variant that yields a clear multi-iteration signature for display.
- It is not the canonical MJ tie-breaker from Balinski & Laraki; the key deviation is the global truncation of all ballots at-or-above the current majority grade per iteration.

---

## 2) MJ: Majority gauge (supporters/opponents)

- **Status:** Implemented
- **File:** `proto1/client/src/utils/tiebreak/mj-majority-gauge.ts`

### How it works (canonical MJ step)
1. Compare majority mentions (medians). Higher median wins.
2. If tied, compare the share strictly above the majority grade (supporters). Higher is better.
3. If still tied, compare the share strictly below the majority grade (opponents). Lower is better.
4. If still tied, options remain tied under this gauge.

### Notes
- No ballots are removed; comparisons use the original distributions.
- This corresponds to the canonical “majority gauge” step described in Majority Judgment.

---

## 3) MJ: Canonical ballot-removal (single-ballot, per-tied-option)

- **Status:** Implemented (not exposed by default in the selector)
- **File:** `proto1/client/src/utils/tiebreak/mj-ballot-removal.ts`

### How it works (canonical MJ resolution when gauge can’t decide)
1. If options are tied at the same majority grade after the gauge, remove one ballot at the majority grade from each tied option.
2. Recompute their majority grades.
3. Repeat until the tie is broken or ballots are exhausted.

### Notes
- Only the tied options are modified, and one ballot per step is removed.
- This is closer to the exact procedure described in the literature, but can be verbose for UI and heavier computationally for large counts.
- To expose it in the selector, register it in `proto1/client/src/utils/tiebreak/index.ts` alongside the others.

---

## 4) Highest Median Values (HMV)

- **Status:** Not implemented (planned)
- **Proposed file:** `proto1/client/src/utils/tiebreak/highest-median.ts`

### Typical approach
- Pick the highest median grade.
- If tied, apply a defined secondary comparison (e.g., supporters-above then opponents-below, or an HMV-specific scoring) without ballot-removal.

### Notes
- This rule is conceptually similar to majority gauge but may use a different canonical secondary scoring depending on source.
- We can implement it on request and register it in the selector.

---

## Key differences at a glance

- **Truncation scope:**
  - Jeanbottein: Global truncation — remove all ballots at-or-above the majority grade each iteration for the analysis timeline.
  - Majority gauge: No truncation — compare supporters-above and opponents-below on the original distribution.
  - Ballot-removal: Local unit truncation — remove one ballot at the majority grade for each tied option, step-by-step.

- **Denominator effects:**
  - Jeanbottein: Iteration percentages and overshoot use a shrinking denominator (`votesRemaining`).
  - Majority gauge: Percentages are computed against the full denominator.
  - Ballot-removal: Denominator shrinks by one per step for each tied option.

- **Who gets modified:**
  - Jeanbottein: Everyone (global truncation in the analysis phase).
  - Majority gauge: No one.
  - Ballot-removal: Only the tied options, one ballot per step.

---

## Integration points

- **Selector:** `proto1/client/src/components/TieBreakSelector.tsx`
- **Strategy registry:** `proto1/client/src/utils/tiebreak/index.ts`
- **Strategy types:** `proto1/client/src/utils/tiebreak/types.ts`
- **Ranking/Comparison entrypoints:** `proto1/client/src/utils/majorityJudgment.ts`

---

## References
- Balinski & Laraki, “Majority Judgment: Measuring, Ranking, and Electing,” MIT Press, 2011.
- Balinski & Laraki, “A theory of measuring, ranking, and electing,” PNAS 104(21):8720–8725 (2007).
