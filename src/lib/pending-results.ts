// Utility for storing and retrieving pending scan results for unauthenticated users
// Used to persist syllabus scanner results across the signup flow

const PENDING_RESULTS_KEY = 'syllabusstack_pending_scan_results';

export interface PendingScanResult {
  courseName: string;
  capabilities: string[];
  tools: { name: string; level: string }[];
  artifacts: string[];
  scannedAt: string;
}

export function savePendingResults(result: PendingScanResult): void {
  try {
    localStorage.setItem(PENDING_RESULTS_KEY, JSON.stringify(result));
  } catch (error) {
    console.error('Failed to save pending results:', error);
  }
}

export function getPendingResults(): PendingScanResult | null {
  try {
    const stored = localStorage.getItem(PENDING_RESULTS_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to get pending results:', error);
    return null;
  }
}

export function clearPendingResults(): void {
  try {
    localStorage.removeItem(PENDING_RESULTS_KEY);
  } catch (error) {
    console.error('Failed to clear pending results:', error);
  }
}

export function hasPendingResults(): boolean {
  return localStorage.getItem(PENDING_RESULTS_KEY) !== null;
}
