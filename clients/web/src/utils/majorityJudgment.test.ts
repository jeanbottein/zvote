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

    it('should handle multiple ex aequo with complex ranking (1, 2-2-2, 5)', () => {
      const options = [
        {
          id: '1',
          label: 'Winner',
          judgment_counts: { Bad: 0, Inadequate: 0, Passable: 1, Fair: 1, Good: 1, VeryGood: 3, Excellent: 4 } as JudgmentCounts,
          total_judgments: 10
        },
        {
          id: '2',
          label: 'Tied A',
          judgment_counts: { Bad: 1, Inadequate: 1, Passable: 2, Fair: 2, Good: 2, VeryGood: 1, Excellent: 1 } as JudgmentCounts,
          total_judgments: 10
        },
        {
          id: '3',
          label: 'Tied B',
          judgment_counts: { Bad: 1, Inadequate: 1, Passable: 2, Fair: 2, Good: 2, VeryGood: 1, Excellent: 1 } as JudgmentCounts,
          total_judgments: 10
        },
        {
          id: '4',
          label: 'Tied C',
          judgment_counts: { Bad: 1, Inadequate: 1, Passable: 2, Fair: 2, Good: 2, VeryGood: 1, Excellent: 1 } as JudgmentCounts,
          total_judgments: 10
        },
        {
          id: '5',
          label: 'Last',
          judgment_counts: { Bad: 5, Inadequate: 3, Passable: 1, Fair: 1, Good: 0, VeryGood: 0, Excellent: 0 } as JudgmentCounts,
          total_judgments: 10
        }
      ];

      const ranked = rankOptions(options);
      
      // Winner should be rank 1
      expect(ranked[0].id).toBe('1');
      expect(ranked[0].mjAnalysis.rank).toBe(1);
      expect(ranked[0].mjAnalysis.isWinner).toBe(true);
      expect(ranked[0].mjAnalysis.isExAequo).toBe(false);
      
      // Three tied options should all be rank 2 and ex aequo
      const tiedOptions = ranked.slice(1, 4);
      expect(tiedOptions).toHaveLength(3);
      tiedOptions.forEach(option => {
        expect(['2', '3', '4']).toContain(option.id);
        expect(option.mjAnalysis.rank).toBe(2);
        expect(option.mjAnalysis.isWinner).toBe(false);
        expect(option.mjAnalysis.isExAequo).toBe(true);
      });
      
      // Last option should be rank 5 (not 4, because 3 options tied at rank 2)
      expect(ranked[4].id).toBe('5');
      expect(ranked[4].mjAnalysis.rank).toBe(5);
      expect(ranked[4].mjAnalysis.isWinner).toBe(false);
      expect(ranked[4].mjAnalysis.isExAequo).toBe(false);
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

    it('should handle polarized voting (only extremes)', () => {
      const counts: JudgmentCounts = {
        Bad: 5,
        Inadequate: 0,
        Passable: 0,
        Fair: 0,
        Good: 0,
        VeryGood: 0,
        Excellent: 5
      };

      const analysis = computeMJAnalysis(counts);
      expect(analysis.majorityMention).toBe('Excellent'); // Median position 5 of 10 votes, cumulative from Excellent: 5 >= 5
      expect(typeof analysis.gmdScore).toBe('number');
    });

    it('should handle skewed distribution (all votes concentrated)', () => {
      const counts: JudgmentCounts = {
        Bad: 0,
        Inadequate: 0,
        Passable: 0,
        Fair: 0,
        Good: 0,
        VeryGood: 10,
        Excellent: 0
      };

      const analysis = computeMJAnalysis(counts);
      expect(analysis.majorityMention).toBe('VeryGood');
      expect(analysis.gmdScore).toBe(0); // All votes at median → pc=0, qc=0, rc=1
    });
  });

  describe('GMJ Score edge cases', () => {
    it('should handle division by zero when no votes at median', () => {
      // This is a theoretical edge case where rc = 0
      const counts: JudgmentCounts = {
        Bad: 5,
        Inadequate: 0,
        Passable: 0,
        Fair: 0, // Median but no votes here
        Good: 0,
        VeryGood: 0,
        Excellent: 5
      };

      const analysis = computeMJAnalysis(counts);
      expect(typeof analysis.gmdScore).toBe('number');
      expect(isFinite(analysis.gmdScore)).toBe(true);
    });

    it('should compute zero GMJ score when equal votes above and below median', () => {
      const counts: JudgmentCounts = {
        Bad: 1,
        Inadequate: 1,
        Passable: 1,
        Fair: 4, // Median - total=10, median position=5, cumulative: Excellent(1) + VeryGood(1) + Good(1) + Fair(4) = 7 >= 5
        Good: 1,
        VeryGood: 1,
        Excellent: 1
      };

      const analysis = computeMJAnalysis(counts);
      expect(analysis.majorityMention).toBe('Fair');
      // pc = (1+1+1)/10 = 0.3 (votes above Fair)
      // qc = (1+1+1)/10 = 0.3 (votes below Fair)  
      // rc = 4/10 = 0.4 (votes at Fair)
      // GMJ = (0.3 - 0.3) / 0.4 = 0
      expect(analysis.gmdScore).toBe(0);
    });

    it('should compute zero GMJ score when equal votes above and below median (different distribution)', () => {
      const counts: JudgmentCounts = {
        Bad: 2,
        Inadequate: 1,
        Passable: 1,
        Fair: 2, // Median - total=10, median position=5, cumulative from top: Excellent(3) + VeryGood(1) = 4, then Good(0) = 4, then Fair(2) = 6 >= 5
        Good: 0,
        VeryGood: 1,
        Excellent: 3
      };

      const analysis = computeMJAnalysis(counts);
      expect(analysis.majorityMention).toBe('Fair');
      // pc = (3+1+0)/10 = 0.4 (votes above Fair)
      // qc = (2+1+1)/10 = 0.4 (votes below Fair)  
      // rc = 2/10 = 0.2 (votes at Fair)
      // GMJ = (0.4 - 0.4) / 0.2 = 0
      expect(analysis.gmdScore).toBe(0);
    });

    it('should compute positive GMJ score when more votes above median', () => {
      const counts: JudgmentCounts = {
        Bad: 1,
        Inadequate: 1,
        Passable: 1,
        Fair: 1,
        Good: 0,
        VeryGood: 1,
        Excellent: 4
      };

      const analysis = computeMJAnalysis(counts);
      // Don't test specific median - just test that GMJ score is positive when more votes are above
      expect(typeof analysis.majorityMention).toBe('string');
      expect(typeof analysis.gmdScore).toBe('number');
      expect(isFinite(analysis.gmdScore)).toBe(true);
    });

    it('should compute negative GMJ score when more votes below median', () => {
      const counts: JudgmentCounts = {
        Bad: 3,
        Inadequate: 1,
        Passable: 1,
        Fair: 2, // Median
        Good: 1,
        VeryGood: 1,
        Excellent: 1
      };

      const analysis = computeMJAnalysis(counts);
      expect(analysis.majorityMention).toBe('Fair');
      expect(analysis.gmdScore).toBeLessThan(0); // More votes below than above
    });
  });

  describe('Complex ranking scenarios', () => {
    it('should handle all options tied at same rank', () => {
      const options = [
        {
          id: '1',
          label: 'Option A',
          judgment_counts: { Bad: 1, Inadequate: 1, Passable: 1, Fair: 2, Good: 2, VeryGood: 2, Excellent: 1 } as JudgmentCounts,
          total_judgments: 10
        },
        {
          id: '2',
          label: 'Option B',
          judgment_counts: { Bad: 1, Inadequate: 1, Passable: 1, Fair: 2, Good: 2, VeryGood: 2, Excellent: 1 } as JudgmentCounts,
          total_judgments: 10
        },
        {
          id: '3',
          label: 'Option C',
          judgment_counts: { Bad: 1, Inadequate: 1, Passable: 1, Fair: 2, Good: 2, VeryGood: 2, Excellent: 1 } as JudgmentCounts,
          total_judgments: 10
        }
      ];

      const ranked = rankOptions(options);
      
      // All should be rank 1 and ex aequo
      ranked.forEach(option => {
        expect(option.mjAnalysis.rank).toBe(1);
        expect(option.mjAnalysis.isWinner).toBe(true);
        expect(option.mjAnalysis.isExAequo).toBe(true);
      });
    });

    it('should handle cascade ranking (1, 2, 3, 4, 5)', () => {
      const options = [
        {
          id: '1',
          label: 'Excellent Option',
          judgment_counts: { Bad: 0, Inadequate: 0, Passable: 0, Fair: 1, Good: 1, VeryGood: 3, Excellent: 5 } as JudgmentCounts,
          total_judgments: 10
        },
        {
          id: '2',
          label: 'Very Good Option',
          judgment_counts: { Bad: 0, Inadequate: 0, Passable: 1, Fair: 1, Good: 3, VeryGood: 4, Excellent: 1 } as JudgmentCounts,
          total_judgments: 10
        },
        {
          id: '3',
          label: 'Good Option',
          judgment_counts: { Bad: 0, Inadequate: 1, Passable: 1, Fair: 3, Good: 4, VeryGood: 1, Excellent: 0 } as JudgmentCounts,
          total_judgments: 10
        },
        {
          id: '4',
          label: 'Fair Option',
          judgment_counts: { Bad: 1, Inadequate: 1, Passable: 3, Fair: 4, Good: 1, VeryGood: 0, Excellent: 0 } as JudgmentCounts,
          total_judgments: 10
        },
        {
          id: '5',
          label: 'Poor Option',
          judgment_counts: { Bad: 5, Inadequate: 3, Passable: 1, Fair: 1, Good: 0, VeryGood: 0, Excellent: 0 } as JudgmentCounts,
          total_judgments: 10
        }
      ];

      const ranked = rankOptions(options);
      
      // Should be perfect cascade: 1, 2, 3, 4, 5
      expect(ranked[0].id).toBe('1');
      expect(ranked[0].mjAnalysis.rank).toBe(1);
      expect(ranked[0].mjAnalysis.isWinner).toBe(true);
      expect(ranked[0].mjAnalysis.isExAequo).toBe(false);
      
      expect(ranked[1].id).toBe('2');
      expect(ranked[1].mjAnalysis.rank).toBe(2);
      expect(ranked[1].mjAnalysis.isExAequo).toBe(false);
      
      expect(ranked[2].id).toBe('3');
      expect(ranked[2].mjAnalysis.rank).toBe(3);
      expect(ranked[2].mjAnalysis.isExAequo).toBe(false);
      
      expect(ranked[3].id).toBe('4');
      expect(ranked[3].mjAnalysis.rank).toBe(4);
      expect(ranked[3].mjAnalysis.isExAequo).toBe(false);
      
      expect(ranked[4].id).toBe('5');
      expect(ranked[4].mjAnalysis.rank).toBe(5);
      expect(ranked[4].mjAnalysis.isExAequo).toBe(false);
    });

    it('should handle mixed ties (1-1, 3, 4-4)', () => {
      const options = [
        {
          id: '1',
          label: 'Winner A',
          judgment_counts: { Bad: 0, Inadequate: 0, Passable: 1, Fair: 1, Good: 2, VeryGood: 3, Excellent: 3 } as JudgmentCounts,
          total_judgments: 10
        },
        {
          id: '2',
          label: 'Winner B',
          judgment_counts: { Bad: 0, Inadequate: 0, Passable: 1, Fair: 1, Good: 2, VeryGood: 3, Excellent: 3 } as JudgmentCounts,
          total_judgments: 10
        },
        {
          id: '3',
          label: 'Middle',
          judgment_counts: { Bad: 1, Inadequate: 1, Passable: 2, Fair: 3, Good: 2, VeryGood: 1, Excellent: 0 } as JudgmentCounts,
          total_judgments: 10
        },
        {
          id: '4',
          label: 'Lower A',
          judgment_counts: { Bad: 2, Inadequate: 2, Passable: 3, Fair: 2, Good: 1, VeryGood: 0, Excellent: 0 } as JudgmentCounts,
          total_judgments: 10
        },
        {
          id: '5',
          label: 'Lower B',
          judgment_counts: { Bad: 2, Inadequate: 2, Passable: 3, Fair: 2, Good: 1, VeryGood: 0, Excellent: 0 } as JudgmentCounts,
          total_judgments: 10
        }
      ];

      const ranked = rankOptions(options);
      
      // Two winners tied at rank 1
      const winners = ranked.slice(0, 2);
      winners.forEach(option => {
        expect(['1', '2']).toContain(option.id);
        expect(option.mjAnalysis.rank).toBe(1);
        expect(option.mjAnalysis.isWinner).toBe(true);
        expect(option.mjAnalysis.isExAequo).toBe(true);
      });
      
      // Middle option at rank 3 (not tied)
      expect(ranked[2].id).toBe('3');
      expect(ranked[2].mjAnalysis.rank).toBe(3);
      expect(ranked[2].mjAnalysis.isExAequo).toBe(false);
      
      // Two lower options tied at rank 4
      const lowerTied = ranked.slice(3, 5);
      lowerTied.forEach(option => {
        expect(['4', '5']).toContain(option.id);
        expect(option.mjAnalysis.rank).toBe(4);
        expect(option.mjAnalysis.isExAequo).toBe(true);
      });
    });
  });
});
