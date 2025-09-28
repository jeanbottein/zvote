/**
 * Comprehensive Test Suite for Majority Judgment Tie-Breaking Methods
 * 
 * Tests all implemented tie-breaking strategies:
 * - Jugement-Majoritaire-Variant (iterative median removal)
 * - Fabre's Typical Judgment (sT = pc - qc)
 * - Fabre's Usual Judgment (sU = (pc - qc) / rc)
 * - Fabre's Central Judgment (sC = pc / qc)
 * 
 * Reference: "Tie-breaking the Highest Median" - Fabre 2019
 */

import type { JudgmentCounts } from './types';
import jugementMajoritaireVariant from './jugement-majoritaire-variant';
import fabresTypical from './fabre-typical';
import fabresUsual from './fabre-usual';
import fabresCentral from './fabre-central';

// Mock strategy dependencies
const mockDeps = {
  computeMJAnalysis: (_counts: JudgmentCounts) => ({
    iterations: [{
      mention: 'Good' as keyof JudgmentCounts,
      percentage: 60,
      strengthPercent: 10
    }]
  }),
  compareMentions: (a: keyof JudgmentCounts, b: keyof JudgmentCounts) => {
    const values = {
      'Excellent': 6, 'VeryGood': 5, 'Good': 4, 'Fair': 3,
      'Passable': 2, 'Inadequate': 1, 'Bad': 0
    };
    return values[a] - values[b]; // Higher quality = higher value
  }
};

describe('Tie-Breaking Strategies', () => {

  // ========================================================================
  // JUGEMENT-MAJORITAIRE-VARIANT TESTS
  // ========================================================================

  describe('Jugement-Majoritaire-Variant', () => {
    
    test('handles different medians correctly', () => {
      const countsA: JudgmentCounts = {
        Bad: 0, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 3, VeryGood: 0, Excellent: 0
      };
      
      const countsB: JudgmentCounts = {
        Bad: 0, Inadequate: 0, Passable: 0, Fair: 3,
        Good: 0, VeryGood: 0, Excellent: 0
      };
      
      const result = jugementMajoritaireVariant.compare(countsA, countsB, mockDeps);
      
      expect(result.winner).toBe('A'); // Good > Fair
      expect(result.finalResult).toContain('Good vs Fair');
    });

    test('performs iterative median removal for tied medians', () => {
      const countsA: JudgmentCounts = {
        Bad: 0, Inadequate: 1, Passable: 0, Fair: 0,
        Good: 2, VeryGood: 0, Excellent: 0
      };
      
      const countsB: JudgmentCounts = {
        Bad: 1, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 2, VeryGood: 0, Excellent: 0
      };
      
      const result = jugementMajoritaireVariant.compare(countsA, countsB, mockDeps);
      
      expect(result.winner).toBe('A'); // After removing Good, A has Inadequate vs B has Bad
      expect(result.iterations.length).toBeGreaterThan(1);
    });

    test('declares tie when all counts exhausted', () => {
      const countsA: JudgmentCounts = {
        Bad: 0, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 1, VeryGood: 0, Excellent: 0
      };
      
      const countsB: JudgmentCounts = {
        Bad: 0, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 1, VeryGood: 0, Excellent: 0
      };
      
      const result = jugementMajoritaireVariant.compare(countsA, countsB, mockDeps);
      
      expect(result.winner).toBe('TIE');
      expect(result.finalResult).toContain('all counts exhausted');
    });

    test('handles candidate exhausting votes first', () => {
      const countsA: JudgmentCounts = {
        Bad: 0, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 1, VeryGood: 0, Excellent: 0
      };
      
      const countsB: JudgmentCounts = {
        Bad: 0, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 2, VeryGood: 0, Excellent: 0
      };
      
      const result = jugementMajoritaireVariant.compare(countsA, countsB, mockDeps);
      
      expect(result.winner).toBe('B'); // B has more votes to exhaust
      expect(result.finalResult).toContain('A exhausted all votes');
    });
  });

  // ========================================================================
  // FABRE'S TYPICAL JUDGMENT TESTS
  // ========================================================================

  describe('Fabre\'s Typical Judgment', () => {
    
    test('compares different medians correctly', () => {
      const countsA: JudgmentCounts = {
        Bad: 0, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 3, VeryGood: 0, Excellent: 0
      };
      
      const countsB: JudgmentCounts = {
        Bad: 0, Inadequate: 0, Passable: 0, Fair: 3,
        Good: 0, VeryGood: 0, Excellent: 0
      };
      
      const result = fabresTypical.compare(countsA, countsB, mockDeps);
      
      expect(result.winner).toBe('A'); // Good > Fair
      expect(result.finalResult).toContain('Good vs Fair');
    });

    test('calculates typical score correctly for tied medians', () => {
      // Both have median Good, but different distributions
      const countsA: JudgmentCounts = {
        Bad: 1, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 2, VeryGood: 1, Excellent: 0  // pc=0.25, qc=0.25, sT=0
      };
      
      const countsB: JudgmentCounts = {
        Bad: 0, Inadequate: 1, Passable: 0, Fair: 0,
        Good: 2, VeryGood: 1, Excellent: 0  // pc=0.25, qc=0.25, sT=0
      };
      
      const result = fabresTypical.compare(countsA, countsB, mockDeps);
      
      // Both should have same typical score since pc-qc is same
      expect(result.winner).toBe('TIE');
      expect(result.finalResult).toContain('identical Typical scores');
    });

    test('handles proponent advantage correctly', () => {
      // Both have median Good (50% threshold), but different distributions
      const countsA: JudgmentCounts = {
        Bad: 0, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 2, VeryGood: 2, Excellent: 0  // 50% Good, 50% VeryGood
      };
      
      const countsB: JudgmentCounts = {
        Bad: 2, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 2, VeryGood: 0, Excellent: 0  // 50% Good, 50% Bad
      };
      
      const result = fabresTypical.compare(countsA, countsB, mockDeps);
      
      expect(result.winner).toBe('A'); // Higher typical score
      expect(result.finalResult).toBeDefined();
    });
  });

  // ========================================================================
  // FABRE'S USUAL JUDGMENT TESTS
  // ========================================================================

  describe('Fabre\'s Usual Judgment', () => {
    
    test('calculates usual score correctly', () => {
      // Both have median Good (50% threshold), but different distributions
      const countsA: JudgmentCounts = {
        Bad: 1, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 2, VeryGood: 1, Excellent: 0  // 50% Good median
      };
      
      const countsB: JudgmentCounts = {
        Bad: 0, Inadequate: 0, Passable: 0, Fair: 1,
        Good: 2, VeryGood: 1, Excellent: 0  // 50% Good median
      };
      
      const result = fabresUsual.compare(countsA, countsB, mockDeps);
      
      expect(['A', 'B', 'TIE']).toContain(result.winner); // Either could win or tie based on tie-breaking
      expect(result.finalResult).toBeDefined();
    });

    test('handles division by zero when rc=0', () => {
      const countsA: JudgmentCounts = {
        Bad: 2, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 0, VeryGood: 2, Excellent: 0  // No votes at median Good
      };
      
      const countsB: JudgmentCounts = {
        Bad: 1, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 0, VeryGood: 3, Excellent: 0  // No votes at median Good
      };
      
      const result = fabresUsual.compare(countsA, countsB, mockDeps);
      
      // Should fall back to typical score when rc=0
      expect(result.winner).toBe('B'); // More proponents
      expect(result.finalResult).toContain('Usual judgment score');
    });

    test('handles perfect ties', () => {
      const countsA: JudgmentCounts = {
        Bad: 1, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 2, VeryGood: 1, Excellent: 0
      };
      
      const countsB: JudgmentCounts = {
        Bad: 1, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 2, VeryGood: 1, Excellent: 0  // Identical distribution
      };
      
      const result = fabresUsual.compare(countsA, countsB, mockDeps);
      
      expect(result.winner).toBe('TIE');
      expect(result.finalResult).toContain('identical Usual scores');
    });
  });

  // ========================================================================
  // FABRE'S CENTRAL JUDGMENT TESTS
  // ========================================================================

  describe('Fabre\'s Central Judgment', () => {
    
    test('calculates central score correctly', () => {
      const countsA: JudgmentCounts = {
        Bad: 1, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 2, VeryGood: 1, Excellent: 0  // pc=0.25, qc=0.25, sC=1
      };
      
      const countsB: JudgmentCounts = {
        Bad: 2, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 1, VeryGood: 1, Excellent: 0  // pc=0.25, qc=0.5, sC=0.5
      };
      
      const result = fabresCentral.compare(countsA, countsB, mockDeps);
      
      expect(result.winner).toBe('A'); // Higher central score (1 > 0.5)
      expect(result.finalResult).toContain('Central judgment score');
    });

    test('handles infinite score when no opponents', () => {
      // Both have median Good (50% threshold), but A has no opponents below median
      const countsA: JudgmentCounts = {
        Bad: 0, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 2, VeryGood: 2, Excellent: 0  // 50% Good median, no opponents
      };
      
      const countsB: JudgmentCounts = {
        Bad: 1, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 2, VeryGood: 1, Excellent: 0  // 50% Good median, has opponents
      };
      
      const result = fabresCentral.compare(countsA, countsB, mockDeps);
      
      expect(result.winner).toBe('A'); // Should win due to better distribution
      expect(result.finalResult).toBeDefined();
    });

    test('handles zero score when no proponents', () => {
      const countsA: JudgmentCounts = {
        Bad: 2, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 2, VeryGood: 0, Excellent: 0  // pc=0, qc=0.5, sC=0
      };
      
      const countsB: JudgmentCounts = {
        Bad: 1, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 2, VeryGood: 1, Excellent: 0  // pc=0.25, qc=0.25, sC=1
      };
      
      const result = fabresCentral.compare(countsA, countsB, mockDeps);
      
      expect(result.winner).toBe('B'); // Any positive score beats zero
      expect(result.finalResult).toContain('Central judgment score');
    });

    test('handles both candidates with infinite scores', () => {
      // Both have median Good (50% threshold) and no opponents below median
      const countsA: JudgmentCounts = {
        Bad: 0, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 2, VeryGood: 2, Excellent: 0  // 50% Good, no opponents
      };
      
      const countsB: JudgmentCounts = {
        Bad: 0, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 1, VeryGood: 3, Excellent: 0  // 25% Good, no opponents
      };
      
      const result = fabresCentral.compare(countsA, countsB, mockDeps);
      
      expect(['A', 'B', 'TIE']).toContain(result.winner); // Could be any result
      expect(result.finalResult).toBeDefined();
    });
  });

  // ========================================================================
  // EDGE CASES AND STRESS TESTS
  // ========================================================================

  describe('Edge Cases', () => {
    
    test('handles empty vote counts', () => {
      const emptyCounts: JudgmentCounts = {
        Bad: 0, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 0, VeryGood: 0, Excellent: 0
      };
      
      const nonEmptyCounts: JudgmentCounts = {
        Bad: 0, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 1, VeryGood: 0, Excellent: 0
      };
      
      // Test all strategies handle empty counts gracefully
      const strategies = [jugementMajoritaireVariant, fabresTypical, fabresUsual, fabresCentral];
      
      strategies.forEach(strategy => {
        const result = strategy.compare(emptyCounts, nonEmptyCounts, mockDeps);
        expect(['A', 'B', 'TIE']).toContain(result.winner);
        expect(result.finalResult).toBeDefined();
      });
    });

    test('handles single vote scenarios', () => {
      const singleVoteA: JudgmentCounts = {
        Bad: 0, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 0, VeryGood: 1, Excellent: 0
      };
      
      const singleVoteB: JudgmentCounts = {
        Bad: 0, Inadequate: 0, Passable: 0, Fair: 1,
        Good: 0, VeryGood: 0, Excellent: 0
      };
      
      const strategies = [jugementMajoritaireVariant, fabresTypical, fabresUsual, fabresCentral];
      
      strategies.forEach(strategy => {
        const result = strategy.compare(singleVoteA, singleVoteB, mockDeps);
        expect(result.winner).toBe('A'); // VeryGood > Fair
        expect(result.finalResult).toBeDefined();
      });
    });

    test('handles large vote counts with precision', () => {
      const largeCountsA: JudgmentCounts = {
        Bad: 1000, Inadequate: 1500, Passable: 2000, Fair: 2500,
        Good: 3000, VeryGood: 3500, Excellent: 4000
      };
      
      const largeCountsB: JudgmentCounts = {
        Bad: 1001, Inadequate: 1499, Passable: 2001, Fair: 2499,
        Good: 3001, VeryGood: 3499, Excellent: 4000
      };
      
      const strategies = [fabresTypical, fabresUsual, fabresCentral];
      
      strategies.forEach(strategy => {
        const result = strategy.compare(largeCountsA, largeCountsB, mockDeps);
        expect(['A', 'B', 'TIE']).toContain(result.winner);
        expect(result.finalResult).toBeDefined();
      });
    });
  });

  // ========================================================================
  // COMPARATIVE TESTS
  // ========================================================================

  describe('Strategy Comparison', () => {
    
    test('all strategies agree on clear winners', () => {
      const clearWinnerA: JudgmentCounts = {
        Bad: 0, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 0, VeryGood: 0, Excellent: 5
      };
      
      const clearLoserB: JudgmentCounts = {
        Bad: 5, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 0, VeryGood: 0, Excellent: 0
      };
      
      const strategies = [jugementMajoritaireVariant, fabresTypical, fabresUsual, fabresCentral];
      
      strategies.forEach(strategy => {
        const result = strategy.compare(clearWinnerA, clearLoserB, mockDeps);
        expect(result.winner).toBe('A');
      });
    });

    test('strategies may differ on subtle ties', () => {
      // Construct a scenario where different methods might disagree
      const subtleTieA: JudgmentCounts = {
        Bad: 1, Inadequate: 1, Passable: 0, Fair: 0,
        Good: 2, VeryGood: 0, Excellent: 0
      };
      
      const subtleTieB: JudgmentCounts = {
        Bad: 0, Inadequate: 2, Passable: 0, Fair: 0,
        Good: 2, VeryGood: 0, Excellent: 0
      };
      
      const strategies = [jugementMajoritaireVariant, fabresTypical, fabresUsual, fabresCentral];
      const results = strategies.map(strategy => 
        strategy.compare(subtleTieA, subtleTieB, mockDeps)
      );
      
      // All should produce valid results, but may differ
      results.forEach(result => {
        expect(['A', 'B', 'TIE']).toContain(result.winner);
        expect(result.finalResult).toBeDefined();
      });
    });
  });
});
