import { describe, it, expect } from 'vitest';
import { 
  extractGapText, 
  normalizeGap, 
  normalizeGaps, 
  combineAndNormalizeGaps,
  gapsToSearchFormat,
  validateGapsForSearch,
  extractSearchKeywords,
} from './gap-utils';

describe('gap-utils', () => {
  describe('extractGapText', () => {
    it('should extract text from string input', () => {
      expect(extractGapText('Python programming skills')).toBe('Python programming skills');
    });

    it('should extract text from priority_gaps format', () => {
      const gap = { gap: 'Machine learning experience', priority: 1, reason: 'Important skill' };
      expect(extractGapText(gap)).toBe('Machine learning experience');
    });

    it('should extract text from critical_gaps format', () => {
      const gap = { 
        job_requirement: '8-10 years of experience in CPG innovation',
        student_status: 'No experience',
        impact: 'Critical gap'
      };
      expect(extractGapText(gap)).toBe('8-10 years of experience in CPG innovation');
    });

    it('should handle skill property', () => {
      const gap = { skill: 'Data analysis', category: 'technical' };
      expect(extractGapText(gap)).toBe('Data analysis');
    });

    it('should return empty string for null/undefined', () => {
      expect(extractGapText(null as any)).toBe('');
      expect(extractGapText(undefined as any)).toBe('');
    });

    it('should return empty string for empty objects', () => {
      expect(extractGapText({})).toBe('');
    });

    it('should trim whitespace', () => {
      expect(extractGapText('  SQL skills  ')).toBe('SQL skills');
    });
  });

  describe('normalizeGap', () => {
    it('should normalize string gap', () => {
      const result = normalizeGap('Python skills');
      expect(result).toEqual({ text: 'Python skills' });
    });

    it('should normalize priority_gaps format', () => {
      const gap = { gap: 'Machine learning', priority: 2, reason: 'Important for role' };
      const result = normalizeGap(gap);
      expect(result).toMatchObject({
        text: 'Machine learning',
        priority: 2,
        reason: 'Important for role',
      });
    });

    it('should normalize critical_gaps format', () => {
      const gap = {
        job_requirement: 'Leadership skills',
        student_status: 'Limited experience',
        impact: 'Critical for role',
        severity: 'critical',
      };
      const result = normalizeGap(gap);
      expect(result).toMatchObject({
        text: 'Leadership skills',
        severity: 'critical',
        studentStatus: 'Limited experience',
        impact: 'Critical for role',
      });
    });

    it('should return null for invalid gaps', () => {
      expect(normalizeGap({})).toBeNull();
      expect(normalizeGap({ foo: 'bar' })).toBeNull();
    });
  });

  describe('normalizeGaps', () => {
    it('should normalize array of mixed gap formats', () => {
      const gaps = [
        'Python skills',
        { gap: 'Machine learning', priority: 1 },
        { job_requirement: 'SQL proficiency' },
      ];
      const result = normalizeGaps(gaps);
      expect(result).toHaveLength(3);
      expect(result[0].text).toBe('Python skills');
      expect(result[1].text).toBe('Machine learning');
      expect(result[2].text).toBe('SQL proficiency');
    });

    it('should filter out invalid gaps', () => {
      const gaps = [
        'Valid gap',
        {},
        null,
        { gap: 'Another valid' },
        undefined,
      ];
      const result = normalizeGaps(gaps as any);
      expect(result).toHaveLength(2);
    });

    it('should handle non-array input gracefully', () => {
      expect(normalizeGaps(null as any)).toEqual([]);
      expect(normalizeGaps('string' as any)).toEqual([]);
    });
  });

  describe('combineAndNormalizeGaps', () => {
    it('should combine critical and priority gaps', () => {
      const critical = [{ job_requirement: 'Leadership' }];
      const priority = [{ gap: 'Python', priority: 1 }];
      
      const result = combineAndNormalizeGaps(critical, priority);
      
      expect(result).toHaveLength(2);
      expect(result[0].severity).toBe('critical');
      expect(result[0].text).toBe('Leadership');
    });

    it('should deduplicate similar gaps', () => {
      const critical = [{ job_requirement: 'Python programming skills' }];
      const priority = [{ gap: 'Python programming skills', priority: 1 }];
      
      const result = combineAndNormalizeGaps(critical, priority);
      
      // Should only have one entry due to similarity check
      expect(result).toHaveLength(1);
    });

    it('should sort critical gaps first', () => {
      const critical = [{ job_requirement: 'Leadership' }];
      const priority = [{ gap: 'Python', priority: 1 }, { gap: 'SQL', priority: 2 }];
      
      const result = combineAndNormalizeGaps(critical, priority);
      
      expect(result[0].severity).toBe('critical');
      expect(result[1].priority).toBe(1);
      expect(result[2].priority).toBe(2);
    });
  });

  describe('gapsToSearchFormat', () => {
    it('should convert normalized gaps to search format', () => {
      const normalized = [
        { text: 'Python', priority: 1 },
        { text: 'SQL', priority: 2 },
      ];
      
      const result = gapsToSearchFormat(normalized);
      
      expect(result).toEqual([
        { gap: 'Python', priority: 1 },
        { gap: 'SQL', priority: 2 },
      ]);
    });
  });

  describe('validateGapsForSearch', () => {
    it('should validate valid gaps', () => {
      const gaps = [{ gap: 'Python' }, 'SQL skills'];
      const result = validateGapsForSearch(gaps);
      
      expect(result.valid).toBe(true);
      expect(result.normalized).toHaveLength(2);
    });

    it('should reject empty array', () => {
      const result = validateGapsForSearch([]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('No skill gaps');
    });

    it('should reject array with no valid gaps', () => {
      const result = validateGapsForSearch([{}, null as any, undefined as any]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('No valid skill gap');
    });
  });

  describe('extractSearchKeywords', () => {
    it('should extract meaningful keywords', () => {
      const text = 'Demonstrated strong experience with Python programming and data analysis';
      const keywords = extractSearchKeywords(text);
      
      expect(keywords).toContain('python');
      expect(keywords).toContain('programming');
      expect(keywords).not.toContain('with');
      expect(keywords).not.toContain('and');
    });

    it('should limit to max keywords', () => {
      const text = 'Python JavaScript TypeScript React Vue Angular Node Express MongoDB PostgreSQL';
      const keywords = extractSearchKeywords(text, 3);
      
      const wordCount = keywords.split(' ').length;
      expect(wordCount).toBeLessThanOrEqual(3);
    });

    it('should handle empty input', () => {
      expect(extractSearchKeywords('')).toBe('');
    });
  });
});
