/**
 * Proctoring Service
 * 
 * Provides browser lockdown functionality for assessed certificate assessments.
 * Implements fullscreen enforcement, keyboard blocking, and violation tracking.
 */

export interface ProctoringViolation {
  type: "fullscreen_exit" | "tab_switch" | "copy_paste" | "keyboard_shortcut" | "focus_loss";
  timestamp: number;
  details?: string;
}

export interface ProctoringState {
  isActive: boolean;
  isFullscreen: boolean;
  violations: ProctoringViolation[];
  violationCount: number;
  maxViolations: number;
  isPassed: boolean | null;
}

type ViolationCallback = (violation: ProctoringViolation) => void;
type StateChangeCallback = (state: ProctoringState) => void;

class ProctoringService {
  private state: ProctoringState = {
    isActive: false,
    isFullscreen: false,
    violations: [],
    violationCount: 0,
    maxViolations: 3,
    isPassed: null,
  };

  private onViolation: ViolationCallback | null = null;
  private onStateChange: StateChangeCallback | null = null;
  private boundHandlers: Record<string, EventListener> = {};

  /**
   * Initialize proctoring for an assessment session
   */
  async start(options: {
    maxViolations?: number;
    onViolation?: ViolationCallback;
    onStateChange?: StateChangeCallback;
  } = {}): Promise<boolean> {
    this.state.maxViolations = options.maxViolations || 3;
    this.onViolation = options.onViolation || null;
    this.onStateChange = options.onStateChange || null;

    // Request fullscreen
    try {
      await document.documentElement.requestFullscreen();
      this.state.isFullscreen = true;
    } catch (error) {
      console.warn("[Proctoring] Fullscreen request denied:", error);
      // Allow to continue without fullscreen, but track it
    }

    // Bind event handlers
    this.bindEventHandlers();

    this.state.isActive = true;
    this.state.violations = [];
    this.state.violationCount = 0;
    this.state.isPassed = null;

    this.notifyStateChange();
    return true;
  }

  /**
   * Stop proctoring and calculate final status
   */
  stop(): ProctoringState {
    this.unbindEventHandlers();

    // Exit fullscreen if active
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    this.state.isActive = false;
    this.state.isPassed = this.state.violationCount < this.state.maxViolations;
    
    this.notifyStateChange();
    return { ...this.state };
  }

  /**
   * Get current proctoring state
   */
  getState(): ProctoringState {
    return { ...this.state };
  }

  private bindEventHandlers() {
    // Fullscreen change handler
    this.boundHandlers.fullscreen = () => {
      const wasFullscreen = this.state.isFullscreen;
      this.state.isFullscreen = !!document.fullscreenElement;
      
      if (wasFullscreen && !this.state.isFullscreen && this.state.isActive) {
        this.recordViolation({
          type: "fullscreen_exit",
          timestamp: Date.now(),
          details: "User exited fullscreen mode",
        });
      }
      this.notifyStateChange();
    };
    document.addEventListener("fullscreenchange", this.boundHandlers.fullscreen);

    // Visibility change (tab switch)
    this.boundHandlers.visibility = () => {
      if (document.hidden && this.state.isActive) {
        this.recordViolation({
          type: "tab_switch",
          timestamp: Date.now(),
          details: "User switched to another tab or window",
        });
      }
    };
    document.addEventListener("visibilitychange", this.boundHandlers.visibility);

    // Focus loss
    this.boundHandlers.blur = () => {
      if (this.state.isActive) {
        this.recordViolation({
          type: "focus_loss",
          timestamp: Date.now(),
          details: "Browser window lost focus",
        });
      }
    };
    window.addEventListener("blur", this.boundHandlers.blur);

    // Keyboard shortcut blocking
    this.boundHandlers.keydown = ((e: KeyboardEvent) => {
      if (!this.state.isActive) return;

      // Block common shortcuts
      const blockedCombos = [
        { ctrl: true, key: "c" },  // Copy
        { ctrl: true, key: "v" },  // Paste
        { ctrl: true, key: "x" },  // Cut
        { ctrl: true, key: "a" },  // Select all
        { ctrl: true, key: "p" },  // Print
        { ctrl: true, key: "s" },  // Save
        { ctrl: true, key: "f" },  // Find
        { alt: true, key: "Tab" }, // Alt+Tab
        { key: "F12" },            // DevTools
        { ctrl: true, shift: true, key: "i" }, // DevTools
        { ctrl: true, shift: true, key: "j" }, // Console
      ];

      for (const combo of blockedCombos) {
        const ctrlMatch = combo.ctrl ? (e.ctrlKey || e.metaKey) : true;
        const altMatch = combo.alt ? e.altKey : true;
        const shiftMatch = combo.shift ? e.shiftKey : true;
        const keyMatch = e.key.toLowerCase() === combo.key.toLowerCase();

        if (ctrlMatch && altMatch && shiftMatch && keyMatch) {
          e.preventDefault();
          e.stopPropagation();
          
          this.recordViolation({
            type: "keyboard_shortcut",
            timestamp: Date.now(),
            details: `Blocked shortcut: ${e.ctrlKey ? "Ctrl+" : ""}${e.altKey ? "Alt+" : ""}${e.shiftKey ? "Shift+" : ""}${e.key}`,
          });
          return;
        }
      }
    }) as EventListener;
    document.addEventListener("keydown", this.boundHandlers.keydown, true);

    // Block copy/paste events
    this.boundHandlers.copy = ((e: ClipboardEvent) => {
      if (this.state.isActive) {
        e.preventDefault();
        this.recordViolation({
          type: "copy_paste",
          timestamp: Date.now(),
          details: "Attempted to copy content",
        });
      }
    }) as EventListener;
    document.addEventListener("copy", this.boundHandlers.copy);

    this.boundHandlers.paste = ((e: ClipboardEvent) => {
      if (this.state.isActive) {
        e.preventDefault();
        this.recordViolation({
          type: "copy_paste",
          timestamp: Date.now(),
          details: "Attempted to paste content",
        });
      }
    }) as EventListener;
    document.addEventListener("paste", this.boundHandlers.paste);

    // Block right-click
    this.boundHandlers.contextmenu = ((e: MouseEvent) => {
      if (this.state.isActive) {
        e.preventDefault();
      }
    }) as EventListener;
    document.addEventListener("contextmenu", this.boundHandlers.contextmenu);
  }

  private unbindEventHandlers() {
    document.removeEventListener("fullscreenchange", this.boundHandlers.fullscreen);
    document.removeEventListener("visibilitychange", this.boundHandlers.visibility);
    window.removeEventListener("blur", this.boundHandlers.blur);
    document.removeEventListener("keydown", this.boundHandlers.keydown, true);
    document.removeEventListener("copy", this.boundHandlers.copy);
    document.removeEventListener("paste", this.boundHandlers.paste);
    document.removeEventListener("contextmenu", this.boundHandlers.contextmenu);
    this.boundHandlers = {};
  }

  private recordViolation(violation: ProctoringViolation) {
    this.state.violations.push(violation);
    this.state.violationCount++;

    if (this.onViolation) {
      this.onViolation(violation);
    }

    this.notifyStateChange();

    // Check if max violations exceeded
    if (this.state.violationCount >= this.state.maxViolations) {
      console.warn("[Proctoring] Max violations reached - assessment may be flagged");
    }
  }

  private notifyStateChange() {
    if (this.onStateChange) {
      this.onStateChange({ ...this.state });
    }
  }
}

// Export singleton instance
export const proctoringService = new ProctoringService();

// React hook for using proctoring
import { useState, useEffect, useCallback } from "react";

export function useProctoring(options: {
  enabled?: boolean;
  maxViolations?: number;
  onViolation?: ViolationCallback;
} = {}) {
  const [state, setState] = useState<ProctoringState>(proctoringService.getState());

  const start = useCallback(async () => {
    await proctoringService.start({
      maxViolations: options.maxViolations,
      onViolation: options.onViolation,
      onStateChange: setState,
    });
  }, [options.maxViolations, options.onViolation]);

  const stop = useCallback(() => {
    return proctoringService.stop();
  }, []);

  useEffect(() => {
    if (options.enabled) {
      start();
    }
    return () => {
      if (proctoringService.getState().isActive) {
        proctoringService.stop();
      }
    };
  }, [options.enabled, start]);

  return {
    state,
    start,
    stop,
    isActive: state.isActive,
    violationCount: state.violationCount,
    isPassed: state.isPassed,
  };
}
