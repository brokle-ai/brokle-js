/**
 * Base Integration Class and Interface
 *
 * Provides a standardized contract for all Brokle integrations
 * following the patterns defined in the integration ecosystem design.
 */

import type { BrokleClient } from './client';

/**
 * Integration type classification
 */
export type IntegrationType = 'wrapper' | 'adapter' | 'instrumentation' | 'callback';

/**
 * Integration status
 */
export type IntegrationStatus = 'registered' | 'active' | 'disabled' | 'error';

/**
 * Integration metadata
 */
export interface IntegrationMetadata {
  /** Integration name (e.g., "brokle-openai") */
  name: string;
  /** Semantic version */
  version: string;
  /** Integration pattern type */
  type: IntegrationType;
  /** Provider name (e.g., "openai", "anthropic") */
  provider: string;
  /** Description of the integration */
  description?: string;
  /** Supported features */
  features?: string[];
  /** Documentation URL */
  docsUrl?: string;
}

/**
 * Integration configuration
 */
export interface IntegrationConfig {
  /** Enable/disable the integration */
  enabled?: boolean;
  /** Capture input content */
  captureInput?: boolean;
  /** Capture output content */
  captureOutput?: boolean;
  /** Additional integration-specific config */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Integration statistics
 */
export interface IntegrationStats {
  /** Total number of operations traced */
  operationCount: number;
  /** Number of successful operations */
  successCount: number;
  /** Number of failed operations */
  errorCount: number;
  /** Total tokens processed (if applicable) */
  totalTokens: number;
  /** Last operation timestamp */
  lastOperationAt?: Date;
  /** Last error timestamp */
  lastErrorAt?: Date;
  /** Average latency in ms */
  avgLatencyMs: number;
}

/**
 * Base Integration Interface
 *
 * Every integration implements this contract for consistent behavior
 * across the Brokle ecosystem.
 */
export interface BrokleIntegration {
  /** Integration metadata */
  readonly metadata: IntegrationMetadata;

  /** Current status */
  readonly status: IntegrationStatus;

  /** Integration statistics */
  readonly stats: IntegrationStats;

  /**
   * Register the integration with a Brokle client
   */
  register(client: BrokleClient): void;

  /**
   * Unregister the integration
   */
  unregister(): void;

  /**
   * Check if the integration is enabled
   */
  isEnabled(): boolean;

  /**
   * Enable the integration
   */
  enable(): void;

  /**
   * Disable the integration
   */
  disable(): void;

  /**
   * Reset statistics
   */
  resetStats(): void;
}

/**
 * Abstract base class for integrations
 *
 * Provides common functionality for all integrations
 */
export abstract class BaseIntegration implements BrokleIntegration {
  abstract readonly metadata: IntegrationMetadata;

  protected _status: IntegrationStatus = 'disabled';
  protected _client: BrokleClient | null = null;
  protected _config: IntegrationConfig;
  protected _stats: IntegrationStats;

  constructor(config?: IntegrationConfig) {
    this._config = {
      enabled: true,
      captureInput: true,
      captureOutput: true,
      ...config,
    };

    this._stats = {
      operationCount: 0,
      successCount: 0,
      errorCount: 0,
      totalTokens: 0,
      avgLatencyMs: 0,
    };
  }

  get status(): IntegrationStatus {
    return this._status;
  }

  get stats(): IntegrationStats {
    return { ...this._stats };
  }

  register(client: BrokleClient): void {
    if (this._status !== 'disabled' && this._status !== 'error') {
      console.warn(`[Brokle] Integration ${this.metadata.name} is already registered`);
      return;
    }

    this._client = client;
    this._status = 'registered';

    if (this._config.enabled) {
      this.enable();
    }

    this.onRegister();

    if (this._client.getConfig().debug) {
      console.log(`[Brokle] Integration ${this.metadata.name} v${this.metadata.version} registered`);
    }
  }

  unregister(): void {
    if (this._status === 'disabled') {
      return;
    }

    this.disable();
    this.onUnregister();

    if (this._client?.getConfig().debug) {
      console.log(`[Brokle] Integration ${this.metadata.name} unregistered`);
    }

    this._client = null;
    this._status = 'disabled';
  }

  isEnabled(): boolean {
    return this._status === 'active';
  }

  enable(): void {
    if (!this._client) {
      throw new Error(`Integration ${this.metadata.name} must be registered before enabling`);
    }

    if (this._status === 'active') {
      return;
    }

    try {
      this.onEnable();
      this._status = 'active';

      if (this._client.getConfig().debug) {
        console.log(`[Brokle] Integration ${this.metadata.name} enabled`);
      }
    } catch (error) {
      this._status = 'error';
      console.error(`[Brokle] Failed to enable integration ${this.metadata.name}:`, error);
      throw error;
    }
  }

  disable(): void {
    if (this._status !== 'active') {
      return;
    }

    try {
      this.onDisable();
      this._status = 'registered';

      if (this._client?.getConfig().debug) {
        console.log(`[Brokle] Integration ${this.metadata.name} disabled`);
      }
    } catch (error) {
      console.error(`[Brokle] Error disabling integration ${this.metadata.name}:`, error);
    }
  }

  resetStats(): void {
    this._stats = {
      operationCount: 0,
      successCount: 0,
      errorCount: 0,
      totalTokens: 0,
      avgLatencyMs: 0,
    };
  }

  /**
   * Record a successful operation
   */
  protected recordSuccess(latencyMs: number, tokens?: number): void {
    this._stats.operationCount++;
    this._stats.successCount++;
    this._stats.lastOperationAt = new Date();

    if (tokens) {
      this._stats.totalTokens += tokens;
    }

    // Update rolling average latency
    const totalLatency = this._stats.avgLatencyMs * (this._stats.successCount - 1) + latencyMs;
    this._stats.avgLatencyMs = totalLatency / this._stats.successCount;
  }

  /**
   * Record a failed operation
   */
  protected recordError(): void {
    this._stats.operationCount++;
    this._stats.errorCount++;
    this._stats.lastErrorAt = new Date();
  }

  /**
   * Get the Brokle client
   */
  protected getClient(): BrokleClient {
    if (!this._client) {
      throw new Error(`Integration ${this.metadata.name} is not registered`);
    }
    return this._client;
  }

  /**
   * Check if the client is properly configured
   */
  protected isClientEnabled(): boolean {
    return this._client?.getConfig().enabled ?? false;
  }

  /**
   * Hook called when the integration is registered
   */
  protected onRegister(): void {
    // Override in subclass if needed
  }

  /**
   * Hook called when the integration is unregistered
   */
  protected onUnregister(): void {
    // Override in subclass if needed
  }

  /**
   * Hook called when the integration is enabled
   */
  protected abstract onEnable(): void;

  /**
   * Hook called when the integration is disabled
   */
  protected abstract onDisable(): void;
}

/**
 * Integration Registry
 *
 * Manages registered integrations
 */
export class IntegrationRegistry {
  private integrations: Map<string, BrokleIntegration> = new Map();

  /**
   * Register an integration
   */
  register(integration: BrokleIntegration, client: BrokleClient): void {
    const name = integration.metadata.name;

    if (this.integrations.has(name)) {
      console.warn(`[Brokle] Integration ${name} is already registered, replacing...`);
      this.unregister(name);
    }

    integration.register(client);
    this.integrations.set(name, integration);
  }

  /**
   * Unregister an integration by name
   */
  unregister(name: string): boolean {
    const integration = this.integrations.get(name);
    if (integration) {
      integration.unregister();
      this.integrations.delete(name);
      return true;
    }
    return false;
  }

  /**
   * Get an integration by name
   */
  get(name: string): BrokleIntegration | undefined {
    return this.integrations.get(name);
  }

  /**
   * Get all registered integrations
   */
  getAll(): BrokleIntegration[] {
    return Array.from(this.integrations.values());
  }

  /**
   * Get all integration names
   */
  getNames(): string[] {
    return Array.from(this.integrations.keys());
  }

  /**
   * Check if an integration is registered
   */
  has(name: string): boolean {
    return this.integrations.has(name);
  }

  /**
   * Get count of registered integrations
   */
  get count(): number {
    return this.integrations.size;
  }

  /**
   * Enable all integrations
   */
  enableAll(): void {
    for (const integration of this.integrations.values()) {
      integration.enable();
    }
  }

  /**
   * Disable all integrations
   */
  disableAll(): void {
    for (const integration of this.integrations.values()) {
      integration.disable();
    }
  }

  /**
   * Unregister all integrations
   */
  clear(): void {
    for (const integration of this.integrations.values()) {
      integration.unregister();
    }
    this.integrations.clear();
  }

  /**
   * Get summary statistics across all integrations
   */
  getStats(): Record<string, IntegrationStats> {
    const stats: Record<string, IntegrationStats> = {};
    for (const [name, integration] of this.integrations.entries()) {
      stats[name] = integration.stats;
    }
    return stats;
  }
}

// Global integration registry
let globalIntegrationRegistry: IntegrationRegistry | null = null;

/**
 * Get the global integration registry
 */
export function getIntegrationRegistry(): IntegrationRegistry {
  if (!globalIntegrationRegistry) {
    globalIntegrationRegistry = new IntegrationRegistry();
  }
  return globalIntegrationRegistry;
}

/**
 * Reset the global integration registry (mainly for testing)
 */
export function resetIntegrationRegistry(): void {
  if (globalIntegrationRegistry) {
    globalIntegrationRegistry.clear();
  }
  globalIntegrationRegistry = null;
}
