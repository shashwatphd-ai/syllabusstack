/**
 * Actionability State Utilities
 * 
 * Determines the actionability state of a recommendation based on:
 * - Status (completed, skipped, in_progress, pending)
 * - Type (course vs non-course)
 * - URL availability
 * - Linked course status
 * 
 * Single source of truth for recommendation actionability logic.
 */

export type ActionabilityState =
  | 'ready_to_start'      // Has URL, can click to learn
  | 'needs_course'        // No URL, no linked course - needs search
  | 'linked_learning'     // Linked to enrolled course with progress
  | 'suggested_link'      // Auto-matched course, pending user confirmation
  | 'generic_action'      // Non-course type (project, skill, etc.)
  | 'in_progress'         // User has started but not completed
  | 'completed'           // Already done
  | 'skipped';            // User skipped

export interface ActionableItem {
  status?: string | null;
  type?: string | null;
  url?: string | null;
  linked_course_id?: string | null;
  linked_course_title?: string | null;
  enrollment_progress?: number | null;
  link_status?: string | null;  // 'active', 'completed', 'abandoned', 'suggested'
}

/**
 * Determines the actionability state of a recommendation
 */
export function getActionabilityState(item: ActionableItem): ActionabilityState {
  // Terminal states first
  if (item.status === 'completed') return 'completed';
  if (item.status === 'skipped') return 'skipped';
  if (item.status === 'in_progress') return 'in_progress';
  
  // Non-course types get generic action state
  if (item.type !== 'course') return 'generic_action';
  
  // Course-specific states
  if (item.linked_course_id) {
    // Check if this is a suggested (unconfirmed) link
    if (item.link_status === 'suggested') return 'suggested_link';
    return 'linked_learning';
  }
  if (item.url) return 'ready_to_start';
  
  return 'needs_course';
}

/**
 * Configuration for each actionability state
 */
export interface ActionabilityConfig {
  label: string;
  badgeVariant: 'default' | 'secondary' | 'outline' | 'destructive';
  badgeClassName: string;
  ctaLabel: string;
  ctaVariant: 'default' | 'secondary' | 'outline' | 'ghost';
  showSearchButton: boolean;
  showLinkButton: boolean;
}

export function getActionabilityConfig(state: ActionabilityState): ActionabilityConfig {
  switch (state) {
    case 'ready_to_start':
      return {
        label: 'Ready to Learn',
        badgeVariant: 'default',
        badgeClassName: 'bg-success/10 text-success border-success/30',
        ctaLabel: 'Start Learning',
        ctaVariant: 'default',
        showSearchButton: false,
        showLinkButton: true,
      };
    
    case 'needs_course':
      return {
        label: 'Find Course',
        badgeVariant: 'outline',
        badgeClassName: 'bg-warning/10 text-warning border-warning/30',
        ctaLabel: 'Search Courses',
        ctaVariant: 'secondary',
        showSearchButton: true,
        showLinkButton: true,
      };
    
    case 'linked_learning':
      return {
        label: 'Enrolled',
        badgeVariant: 'default',
        badgeClassName: 'bg-indigo-100 text-indigo-700 border-indigo-300',
        ctaLabel: 'Continue Learning',
        ctaVariant: 'default',
        showSearchButton: false,
        showLinkButton: false,
      };
    
    case 'suggested_link':
      return {
        label: 'Suggested Match',
        badgeVariant: 'outline',
        badgeClassName: 'bg-amber-50 text-amber-700 border-amber-300',
        ctaLabel: 'Confirm Link',
        ctaVariant: 'default',
        showSearchButton: false,
        showLinkButton: false,
      };
    
    case 'generic_action':
      return {
        label: '',
        badgeVariant: 'outline',
        badgeClassName: '',
        ctaLabel: 'Start',
        ctaVariant: 'default',
        showSearchButton: false,
        showLinkButton: false,
      };
    
    case 'in_progress':
      return {
        label: 'In Progress',
        badgeVariant: 'default',
        badgeClassName: 'bg-blue-100 text-blue-700 border-blue-300',
        ctaLabel: 'Mark Complete',
        ctaVariant: 'default',
        showSearchButton: false,
        showLinkButton: true,
      };
    
    case 'completed':
      return {
        label: 'Completed',
        badgeVariant: 'outline',
        badgeClassName: 'bg-success/10 text-success border-success/30',
        ctaLabel: 'Undo',
        ctaVariant: 'ghost',
        showSearchButton: false,
        showLinkButton: false,
      };
    
    case 'skipped':
      return {
        label: 'Skipped',
        badgeVariant: 'outline',
        badgeClassName: 'bg-muted text-muted-foreground',
        ctaLabel: 'Restore',
        ctaVariant: 'ghost',
        showSearchButton: false,
        showLinkButton: false,
      };
  }
}

/**
 * Check if a recommendation is in a final/terminal state
 */
export function isTerminalState(state: ActionabilityState): boolean {
  return state === 'completed' || state === 'skipped';
}

/**
 * Check if a recommendation can be started
 */
export function canStart(state: ActionabilityState): boolean {
  return state === 'ready_to_start' || state === 'linked_learning' || state === 'generic_action';
}

/**
 * Check if a recommendation needs user action to find a course
 */
export function needsCourseAction(state: ActionabilityState): boolean {
  return state === 'needs_course';
}
