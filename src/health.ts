/**
 * Integration Health Monitor
 *
 * Monitors the health of integrations and provides circuit breaker
 * functionality to prevent cascade failures.
 */

import { getIntegrationRegistry, type BrokleIntegration, type IntegrationStats } from './integration';

/**
 * Health status levels
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/**
 * Health check result for a single integration
 */
export interface IntegrationHealthResult {
  /** Integration name */
  name: string;
  /** Current health status */
  status: HealthStatus;
  /** Error rate (0-1) */
  errorRate: number;
  /** Average latency in ms */
  avgLatencyMs: number;
  /** Last successful operation */
  lastSuccessAt?: Date;
  /** Last error */
  lastErrorAt?: Date;
  /** Whether the circuit breaker is open */
  circuitOpen: boolean;
  /** Integration statistics */
  stats: IntegrationStats;
  /** Additional details */
  details?: string;
}

/**
 * Overall health report
 */
export interface HealthReport {
  /** Overall system health */
  status: HealthStatus;
  /** Timestamp of the report */
  timestamp: Date;
  /** Individual integration health */
  integrations: IntegrationHealthResult[];
  /** Summary statistics */
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    unknown: number;
  };
}

/**
 * Circuit breaker state
 */
interface CircuitState {
  /** Whether the circuit is open */
  isOpen: boolean;
  /** Number of consecutive failures */
  failureCount: number;
  /** Last failure timestamp */
  lastFailureAt?: Date;
  /** When the circuit was opened */
  openedAt?: Date;
  /** Number of half-open attempts */
  halfOpenAttempts: number;
}

/**
 * Health monitor configuration
 */
export interface HealthMonitorConfig {
  /** Error rate threshold for degraded status (default: 0.1 = 10%) */
  degradedThreshold?: number;
  /** Error rate threshold for unhealthy status (default: 0.5 = 50%) */
  unhealthyThreshold?: number;
  /** Latency threshold for degraded status in ms (default: 5000) */
  latencyDegradedMs?: number;
  /** Latency threshold for unhealthy status in ms (default: 30000) */
  latencyUnhealthyMs?: number;
  /** Minimum operations before calculating health (default: 10) */
  minOperations?: number;
  /** Circuit breaker failure threshold (default: 5) */
  circuitBreakerThreshold?: number;
  /** Circuit breaker reset timeout in ms (default: 60000) */
  circuitBreakerResetMs?: number;
  /** Enable automatic circuit breaker (default: true) */
  enableCircuitBreaker?: boolean;
}

/**
 * Default health monitor configuration
 */
const DEFAULT_CONFIG: Required<HealthMonitorConfig> = {
  degradedThreshold: 0.1,
  unhealthyThreshold: 0.5,
  latencyDegradedMs: 5000,
  latencyUnhealthyMs: 30000,
  minOperations: 10,
  circuitBreakerThreshold: 5,
  circuitBreakerResetMs: 60000,
  enableCircuitBreaker: true,
};

/**
 * Integration Health Monitor
 *
 * Monitors integration health and provides circuit breaker functionality
 */
export class HealthMonitor {
  private config: Required<HealthMonitorConfig>;
  private circuitStates: Map<string, CircuitState> = new Map();
  private healthListeners: Set<(report: HealthReport) => void> = new Set();

  constructor(config?: HealthMonitorConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get health status for a single integration
   */
  getIntegrationHealth(integration: BrokleIntegration): IntegrationHealthResult {
    const name = integration.metadata.name;
    const stats = integration.stats;
    const circuitState = this.getCircuitState(name);

    // Calculate error rate
    const errorRate = stats.operationCount > 0
      ? stats.errorCount / stats.operationCount
      : 0;

    // Determine health status
    let status: HealthStatus = 'unknown';
    let details: string | undefined;

    if (stats.operationCount < this.config.minOperations) {
      status = 'unknown';
      details = `Insufficient data (${stats.operationCount}/${this.config.minOperations} operations)`;
    } else if (circuitState.isOpen) {
      status = 'unhealthy';
      details = 'Circuit breaker is open';
    } else if (errorRate >= this.config.unhealthyThreshold) {
      status = 'unhealthy';
      details = `High error rate: ${(errorRate * 100).toFixed(1)}%`;
    } else if (stats.avgLatencyMs >= this.config.latencyUnhealthyMs) {
      status = 'unhealthy';
      details = `High latency: ${stats.avgLatencyMs.toFixed(0)}ms`;
    } else if (errorRate >= this.config.degradedThreshold) {
      status = 'degraded';
      details = `Elevated error rate: ${(errorRate * 100).toFixed(1)}%`;
    } else if (stats.avgLatencyMs >= this.config.latencyDegradedMs) {
      status = 'degraded';
      details = `Elevated latency: ${stats.avgLatencyMs.toFixed(0)}ms`;
    } else {
      status = 'healthy';
    }

    return {
      name,
      status,
      errorRate,
      avgLatencyMs: stats.avgLatencyMs,
      lastSuccessAt: stats.lastOperationAt,
      lastErrorAt: stats.lastErrorAt,
      circuitOpen: circuitState.isOpen,
      stats,
      details,
    };
  }

  /**
   * Get health report for all integrations
   */
  getHealthReport(): HealthReport {
    const registry = getIntegrationRegistry();
    const integrations = registry.getAll();

    const results = integrations.map((integration) =>
      this.getIntegrationHealth(integration)
    );

    // Calculate summary
    const summary = {
      total: results.length,
      healthy: results.filter((r) => r.status === 'healthy').length,
      degraded: results.filter((r) => r.status === 'degraded').length,
      unhealthy: results.filter((r) => r.status === 'unhealthy').length,
      unknown: results.filter((r) => r.status === 'unknown').length,
    };

    // Determine overall status
    let overallStatus: HealthStatus = 'healthy';
    if (summary.unhealthy > 0) {
      overallStatus = 'unhealthy';
    } else if (summary.degraded > 0) {
      overallStatus = 'degraded';
    } else if (summary.unknown === summary.total && summary.total > 0) {
      overallStatus = 'unknown';
    }

    return {
      status: overallStatus,
      timestamp: new Date(),
      integrations: results,
      summary,
    };
  }

  /**
   * Record a successful operation for circuit breaker
   */
  recordSuccess(integrationName: string): void {
    const state = this.getCircuitState(integrationName);

    if (state.isOpen) {
      // If circuit was open and we got a success, close it
      state.isOpen = false;
      state.failureCount = 0;
      state.openedAt = undefined;
      state.halfOpenAttempts = 0;
    } else {
      // Reset failure count on success
      state.failureCount = 0;
    }
  }

  /**
   * Record a failure for circuit breaker
   */
  recordFailure(integrationName: string): void {
    if (!this.config.enableCircuitBreaker) {
      return;
    }

    const state = this.getCircuitState(integrationName);
    state.failureCount++;
    state.lastFailureAt = new Date();

    // Open circuit if threshold exceeded
    if (state.failureCount >= this.config.circuitBreakerThreshold) {
      state.isOpen = true;
      state.openedAt = new Date();

      console.warn(
        `[Brokle] Circuit breaker opened for ${integrationName} ` +
        `after ${state.failureCount} consecutive failures`
      );

      // Notify listeners
      this.notifyListeners();
    }
  }

  /**
   * Check if circuit is open for an integration
   */
  isCircuitOpen(integrationName: string): boolean {
    const state = this.getCircuitState(integrationName);

    if (!state.isOpen) {
      return false;
    }

    // Check if reset timeout has passed
    if (state.openedAt) {
      const elapsed = Date.now() - state.openedAt.getTime();
      if (elapsed >= this.config.circuitBreakerResetMs) {
        // Allow half-open attempt
        state.halfOpenAttempts++;
        return false;
      }
    }

    return true;
  }

  /**
   * Manually reset circuit breaker for an integration
   */
  resetCircuit(integrationName: string): void {
    const state = this.getCircuitState(integrationName);
    state.isOpen = false;
    state.failureCount = 0;
    state.openedAt = undefined;
    state.halfOpenAttempts = 0;
    state.lastFailureAt = undefined;
  }

  /**
   * Reset all circuit breakers
   */
  resetAllCircuits(): void {
    this.circuitStates.clear();
  }

  /**
   * Add a health change listener
   */
  addListener(listener: (report: HealthReport) => void): void {
    this.healthListeners.add(listener);
  }

  /**
   * Remove a health change listener
   */
  removeListener(listener: (report: HealthReport) => void): void {
    this.healthListeners.delete(listener);
  }

  /**
   * Get circuit state for an integration
   */
  private getCircuitState(integrationName: string): CircuitState {
    if (!this.circuitStates.has(integrationName)) {
      this.circuitStates.set(integrationName, {
        isOpen: false,
        failureCount: 0,
        halfOpenAttempts: 0,
      });
    }
    return this.circuitStates.get(integrationName)!;
  }

  /**
   * Notify listeners of health changes
   */
  private notifyListeners(): void {
    const report = this.getHealthReport();
    for (const listener of this.healthListeners) {
      try {
        listener(report);
      } catch (error) {
        console.error('[Brokle] Health listener error:', error);
      }
    }
  }
}

// Global health monitor instance
let globalHealthMonitor: HealthMonitor | null = null;

/**
 * Get the global health monitor
 */
export function getHealthMonitor(config?: HealthMonitorConfig): HealthMonitor {
  if (!globalHealthMonitor) {
    globalHealthMonitor = new HealthMonitor(config);
  }
  return globalHealthMonitor;
}

/**
 * Reset the global health monitor (mainly for testing)
 */
export function resetHealthMonitor(): void {
  globalHealthMonitor = null;
}

/**
 * Simple health check function
 */
export function checkHealth(): HealthReport {
  return getHealthMonitor().getHealthReport();
}
