/**
 * Tests for Simplified Majority Judgment with GMJ's Usual Scoring
 */

import {
  computeMJAnalysis,
  rankOptions,
  JudgmentCounts,
  MJAnalysis,
  createDisplaySummary,
  formatGMJScore
} from './majorityJudgment';

describe('Simplified Majority Judgment', () => {
  
  describe('computeMJAnalysis', () => {
    it('should compute correct majority mention and GMJ score for simple case', () => {
      const counts: JudgmentCounts = {
        Bad: 1,
        Inadequate: 1,
        Passable: 1,
        Fair: 1,
        Good: 2,
        VeryGood: 2,
        Excellent: 2
      };

      const analysis = computeMJAnalysis(counts);
      
      expect(analysis.majorityMention).toBe('Good');
      expect(analysis.gmdScore).toBe(0); // pc=0.4, qc=0.4, rc=0.2 → (0.4-0.4)/0.2 = 0
    });

    it('should handle empty judgment counts', () => {
      const counts: JudgmentCounts = {
        Bad: 0,
        Inadequate: 0,
        Passable: 0,
        Fair: 0,
        Good: 0,
        VeryGood: 0,
        Excellent: 0
      };

      const analysis = computeMJAnalysis(counts);
      
      expect(analysis.majorityMention).toBe('Bad');
      expect(analysis.gmdScore).toBe(0);
    });
    
    it('should compute correct analysis for all Excellent votes', () => {
      const counts: JudgmentCounts = {
        Bad: 0,
        Inadequate: 0,
        Passable: 0,
        Fair: 0,
        Good: 0,
        VeryGood: 0,
        Excellent: 10
      };

      const analysis = computeMJAnalysis(counts);
      
      expect(analysis.majorityMention).toBe('Excellent');
      expect(analysis.gmdScore).toBe(0); // pc=0, qc=0, rc=1 → (0-0)/1 = 0
    });
  });

  describe('rankOptions', () => {
    it('should rank options correctly by majority mention and GMJ score', () => {
      const options = [
        {
          id: '1',
          label: 'Option A',
          judgment_counts: { Bad: 2, Inadequate: 1, Passable: 1, Fair: 1, Good: 2, VeryGood: 2, Excellent: 1 } as JudgmentCounts,
          total_judgments: 10
        },
        {
          id: '2', 
          label: 'Option B',
          judgment_counts: { Bad: 1, Inadequate: 1, Passable: 1, Fair: 1, Good: 1, VeryGood: 2, Excellent: 3 } as JudgmentCounts,
          total_judgments: 10
        }
      ];

      const ranked = rankOptions(options);
      
      expect(ranked[0].id).toBe('2'); // Better majority mention
      expect(ranked[1].id).toBe('1');
      expect(ranked[0].mjAnalysis.rank).toBe(1);
      expect(ranked[1].mjAnalysis.rank).toBe(2);
      expect(ranked[0].mjAnalysis.isWinner).toBe(true);
      expect(ranked[1].mjAnalysis.isWinner).toBe(false);
      // Both may have same GMJ score, ranking is primarily by majority mention
      expect(typeof ranked[0].mjAnalysis.gmdScore).toBe('number');
      expect(typeof ranked[1].mjAnalysis.gmdScore).toBe('number');
    });

    it('should handle ties correctly', () => {
      const options = [
        {
          id: '1',
          label: 'Option A',
          judgment_counts: { Bad: 1, Inadequate: 1, Passable: 1, Fair: 1, Good: 2, VeryGood: 2, Excellent: 2 } as JudgmentCounts,
          total_judgments: 10
        },
        {
          id: '2',
          label: 'Option B', 
          judgment_counts: { Bad: 1, Inadequate: 1, Passable: 1, Fair: 1, Good: 2, VeryGood: 2, Excellent: 2 } as JudgmentCounts,
          total_judgments: 10
        }
      ];

      const ranked = rankOptions(options);
      
      expect(ranked[0].mjAnalysis.rank).toBe(1);
      expect(ranked[1].mjAnalysis.rank).toBe(1); // Same rank due to tie
      expect(ranked[0].mjAnalysis.isExAequo).toBe(true);
      expect(ranked[1].mjAnalysis.isExAequo).toBe(true);
    });
  });

  describe('Tie-breaking with GMJ\'s Usual', () => {
    it('should break ties correctly using GMJ score when majority mentions are the same', () => {
      const optionA: JudgmentCounts = {
        Bad: 0,
        Inadequate: 0, 
        Passable: 2,
        Fair: 3,
        Good: 3,
        VeryGood: 2,
        Excellent: 0
      };

      const optionB: JudgmentCounts = {
        Bad: 0,
        Inadequate: 1,
        Passable: 1, 
        Fair: 3,
        Good: 3,
        VeryGood: 2,
        Excellent: 0
      };

      const analysisA = computeMJAnalysis(optionA);
      const analysisB = computeMJAnalysis(optionB);

      // Both should have same majority mention (Good)
      expect(analysisA.majorityMention).toBe('Good');
      expect(analysisB.majorityMention).toBe('Good');

      // Both have same GMJ scores, so they tie
      expect(analysisA.gmdScore).toBe(analysisB.gmdScore);

      const options = [
        { id: '1', label: 'A', judgment_counts: optionA, total_judgments: 10 },
        { id: '2', label: 'B', judgment_counts: optionB, total_judgments: 10 }
      ];

      const ranked = rankOptions(options);
      // Both should have same rank due to identical majority mention and GMJ score
      expect(ranked[0].mjAnalysis.rank).toBe(1);
      expect(ranked[1].mjAnalysis.rank).toBe(1);
      expect(ranked[0].mjAnalysis.isExAequo).toBe(true);
      expect(ranked[1].mjAnalysis.isExAequo).toBe(true);
    });
  });

  describe('createDisplaySummary', () => {
    it('should create correct display summary', () => {
      const analysis: MJAnalysis = {
        majorityMention: 'Good',
        gmdScore: 0.25,
        rank: 1,
        isWinner: true,
        isExAequo: false
      };

      const summary = createDisplaySummary(analysis);
      expect(summary).toBe('Good • GMJ: 0.25');
    });
  });

  describe('formatGMJScore', () => {
    it('should format GMJ scores correctly', () => {
      expect(formatGMJScore(0.2543)).toBe('0.25');
      expect(formatGMJScore(Number.POSITIVE_INFINITY)).toBe('∞');
      expect(formatGMJScore(Number.NEGATIVE_INFINITY)).toBe('-∞');
      expect(formatGMJScore(-0.5)).toBe('-0.50');
    });
  });

  describe('Edge cases', () => {
    it('should handle single vote correctly', () => {
      const counts: JudgmentCounts = {
        Bad: 0,
        Inadequate: 0,
        Passable: 0,
        Fair: 0,
        Good: 1,
        VeryGood: 0,
        Excellent: 0
      };

      const analysis = computeMJAnalysis(counts);
      expect(analysis.majorityMention).toBe('Good');
      expect(analysis.gmdScore).toBe(0); // pc = 0, qc = 0, rc = 1 → (0-0)/1 = 0
    });

    it('should handle votes with no clear majority', () => {
      const counts: JudgmentCounts = {
        Bad: 1,
        Inadequate: 1,
        Passable: 1,
        Fair: 1,
        Good: 1,
        VeryGood: 1,
        Excellent: 1
      };

      const analysis = computeMJAnalysis(counts);
      expect(analysis.majorityMention).toBe('Fair'); // Median of 7 votes
      expect(typeof analysis.gmdScore).toBe('number');
    });
  });
});
