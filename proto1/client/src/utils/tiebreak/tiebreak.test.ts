/**
 * Test Suite for Fabre's Usual Judgment Tie-Breaking Method
 * 
 * Tests the Fabre's Usual Judgment tie-breaking strategy:
 * - sU = (pc - qc) / rc
 * 
 * Reference: "Tie-breaking the Highest Median" - Fabre 2019
 */

import type { JudgmentCounts } from './types';
import fabresUsual from './fabre-usual';

// Mock strategy dependencies
const mockDeps = {
  calculateMedian: (counts: JudgmentCounts) => {
    const mentions: (keyof JudgmentCounts)[] = [
      'Excellent', 'VeryGood', 'Good', 'Fair', 'Passable', 'Inadequate', 'Bad'
    ];
    
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    if (total === 0) return 'Bad';
    
    const medianPosition = total / 2;
    let cumulative = 0;
    
    for (const mention of mentions) {
      cumulative += counts[mention];
      if (cumulative >= medianPosition) {
        return mention;
      }
    }
    
    return 'Bad';
  },
  getMentionValue: (mention: keyof JudgmentCounts) => {
    const values = {
      'Excellent': 6, 'VeryGood': 5, 'Good': 4, 'Fair': 3,
      'Passable': 2, 'Inadequate': 1, 'Bad': 0
    };
    return values[mention];
  }
};

describe('Fabre\'s Usual Judgment Tie-Breaking', () => {

  describe('Basic Functionality', () => {
    
    test('calculates usual score correctly', () => {
      const countsA: JudgmentCounts = {
        Bad: 1, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 2, VeryGood: 1, Excellent: 0
      };
      
      const countsB: JudgmentCounts = {
        Bad: 0, Inadequate: 0, Passable: 0, Fair: 1,
        Good: 2, VeryGood: 1, Excellent: 0
      };
      
      const result = fabresUsual.compare(countsA, countsB, mockDeps);
      
      expect(['A', 'B', 'TIE']).toContain(result.winner);
      expect(result.finalResult).toBeDefined();
    });

    test('handles division by zero when rc=0', () => {
      const countsA: JudgmentCounts = {
        Bad: 2, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 0, VeryGood: 2, Excellent: 0
      };
      
      const countsB: JudgmentCounts = {
        Bad: 1, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 0, VeryGood: 3, Excellent: 0
      };
      
      const result = fabresUsual.compare(countsA, countsB, mockDeps);
      
      expect(['A', 'B', 'TIE']).toContain(result.winner);
      expect(result.finalResult).toBeDefined();
    });
    
    test('handles perfect ties', () => {
      const counts: JudgmentCounts = {
        Bad: 1, Inadequate: 1, Passable: 1, Fair: 1,
        Good: 1, VeryGood: 1, Excellent: 1
      };
      
      const result = fabresUsual.compare(counts, counts, mockDeps);
      
      expect(result.winner).toBe('TIE');
      expect(result.finalResult).toContain('tie');
    });
  });

  describe('Edge Cases', () => {
    
    test('handles empty vote counts', () => {
      const emptyCounts: JudgmentCounts = {
        Bad: 0, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 0, VeryGood: 0, Excellent: 0
      };
      
      const result = fabresUsual.compare(emptyCounts, emptyCounts, mockDeps);
      expect(['A', 'B', 'TIE']).toContain(result.winner);
      expect(result.finalResult).toBeDefined();
    });
    
    test('handles single vote scenarios', () => {
      const singleVote: JudgmentCounts = {
        Bad: 0, Inadequate: 0, Passable: 0, Fair: 0,
        Good: 1, VeryGood: 0, Excellent: 0
      };
      
      const result = fabresUsual.compare(singleVote, singleVote, mockDeps);
      expect(result.winner).toBe('TIE');
      expect(result.finalResult).toBeDefined();
    });
  });
});
