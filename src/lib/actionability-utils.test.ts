import { describe, it, expect } from 'vitest';
import {
  getActionabilityState,
  getActionabilityConfig,
  isTerminalState,
  canStart,
  needsCourseAction,
  type ActionableItem,
} from './actionability-utils';

describe('getActionabilityState', () => {
  it('returns completed for completed status', () => {
    const item: ActionableItem = { status: 'completed', type: 'course', url: 'https://test.com' };
    expect(getActionabilityState(item)).toBe('completed');
  });

  it('returns skipped for skipped status', () => {
    const item: ActionableItem = { status: 'skipped', type: 'course' };
    expect(getActionabilityState(item)).toBe('skipped');
  });

  it('returns in_progress for in_progress status', () => {
    const item: ActionableItem = { status: 'in_progress', type: 'course', url: 'https://test.com' };
    expect(getActionabilityState(item)).toBe('in_progress');
  });

  it('returns generic_action for non-course types', () => {
    const item: ActionableItem = { status: 'pending', type: 'project', url: 'https://test.com' };
    expect(getActionabilityState(item)).toBe('generic_action');
  });

  it('returns linked_learning when course has linked_course_id', () => {
    const item: ActionableItem = {
      status: 'pending',
      type: 'course',
      linked_course_id: 'course-123',
      linked_course_title: 'Test Course',
    };
    expect(getActionabilityState(item)).toBe('linked_learning');
  });

  it('returns ready_to_start for course with URL but no linked course', () => {
    const item: ActionableItem = {
      status: 'pending',
      type: 'course',
      url: 'https://coursera.com/test',
    };
    expect(getActionabilityState(item)).toBe('ready_to_start');
  });

  it('returns needs_course for course without URL or linked course', () => {
    const item: ActionableItem = {
      status: 'pending',
      type: 'course',
      url: null,
      linked_course_id: null,
    };
    expect(getActionabilityState(item)).toBe('needs_course');
  });

  it('prioritizes linked_course_id over url for courses', () => {
    const item: ActionableItem = {
      status: 'pending',
      type: 'course',
      url: 'https://test.com',
      linked_course_id: 'course-123',
    };
    expect(getActionabilityState(item)).toBe('linked_learning');
  });
});

describe('getActionabilityConfig', () => {
  it('returns correct config for ready_to_start', () => {
    const config = getActionabilityConfig('ready_to_start');
    expect(config.label).toBe('Ready to Learn');
    expect(config.ctaLabel).toBe('Start Learning');
    expect(config.showSearchButton).toBe(false);
  });

  it('returns correct config for needs_course', () => {
    const config = getActionabilityConfig('needs_course');
    expect(config.label).toBe('Find Course');
    expect(config.ctaLabel).toBe('Search Courses');
    expect(config.showSearchButton).toBe(true);
  });

  it('returns correct config for linked_learning', () => {
    const config = getActionabilityConfig('linked_learning');
    expect(config.label).toBe('Enrolled');
    expect(config.ctaLabel).toBe('Continue Learning');
    expect(config.showLinkButton).toBe(false);
  });

  it('returns correct config for generic_action', () => {
    const config = getActionabilityConfig('generic_action');
    expect(config.label).toBe('');
    expect(config.ctaLabel).toBe('Start');
  });
});

describe('helper functions', () => {
  it('isTerminalState returns true for completed and skipped', () => {
    expect(isTerminalState('completed')).toBe(true);
    expect(isTerminalState('skipped')).toBe(true);
    expect(isTerminalState('in_progress')).toBe(false);
    expect(isTerminalState('ready_to_start')).toBe(false);
  });

  it('canStart returns true for actionable states', () => {
    expect(canStart('ready_to_start')).toBe(true);
    expect(canStart('linked_learning')).toBe(true);
    expect(canStart('generic_action')).toBe(true);
    expect(canStart('needs_course')).toBe(false);
    expect(canStart('completed')).toBe(false);
  });

  it('needsCourseAction returns true only for needs_course', () => {
    expect(needsCourseAction('needs_course')).toBe(true);
    expect(needsCourseAction('ready_to_start')).toBe(false);
    expect(needsCourseAction('linked_learning')).toBe(false);
  });
});
