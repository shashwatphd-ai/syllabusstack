/**
 * Circuit Breaker Pattern for Capstone Pipeline
 * Prevents cascading failures when external APIs are experiencing issues
 * Ported from EduThree1 and simplified for SyllabusStack
 */

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  successThreshold: number;
  name: string;
}

export interface CircuitBreakerResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  circuitState: CircuitState;
  wasShortCircuited: boolean;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: number | null = null;
  
  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<CircuitBreakerResult<T>> {
    if (!this.isAllowed()) {
      const timeRemaining = this.lastFailureTime 
        ? Math.max(0, this.config.resetTimeoutMs - (Date.now() - this.lastFailureTime))
        : 0;
      
      return {
        success: false,
        error: `Circuit breaker OPEN for ${this.config.name}. Retry in ${Math.ceil(timeRemaining / 1000)}s`,
        circuitState: this.state,
        wasShortCircuited: true,
      };
    }
    
    try {
      const data = await operation();
      this.recordSuccess();
      return { success: true, data, circuitState: this.state, wasShortCircuited: false };
    } catch (error) {
      this.recordFailure();
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        circuitState: this.state,
        wasShortCircuited: false,
      };
    }
  }

  private isAllowed(): boolean {
    if (this.state === CircuitState.CLOSED) return true;
    if (this.state === CircuitState.OPEN) {
      if (this.lastFailureTime && (Date.now() - this.lastFailureTime) >= this.config.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
        this.successes = 0;
        return true;
      }
      return false;
    }
    return true; // HALF_OPEN
  }

  private recordSuccess(): void {
    this.successes++;
    if (this.state === CircuitState.HALF_OPEN && this.successes >= this.config.successThreshold) {
      this.state = CircuitState.CLOSED;
      this.failures = 0;
    }
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.state === CircuitState.HALF_OPEN || this.failures >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }
}

// Shared instances
const registry = new Map<string, CircuitBreaker>();

function getOrCreate(config: CircuitBreakerConfig): CircuitBreaker {
  const existing = registry.get(config.name);
  if (existing) return existing;
  const breaker = new CircuitBreaker(config);
  registry.set(config.name, breaker);
  return breaker;
}

export async function withApolloCircuit<T>(op: () => Promise<T>): Promise<CircuitBreakerResult<T>> {
  return getOrCreate({ failureThreshold: 5, resetTimeoutMs: 60000, successThreshold: 2, name: 'apollo-api' }).execute(op);
}

export async function withAICircuit<T>(op: () => Promise<T>): Promise<CircuitBreakerResult<T>> {
  return getOrCreate({ failureThreshold: 3, resetTimeoutMs: 30000, successThreshold: 1, name: 'capstone-ai' }).execute(op);
}
