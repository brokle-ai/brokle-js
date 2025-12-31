/**
 * Tests for BROKLE_ENABLED master switch functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateConfig, loadFromEnv } from '../config';
import { Brokle, getClient, resetClient } from '../client';
import type { BrokleConfigInput } from '../types/config';

describe('BROKLE_ENABLED master switch', () => {
  beforeEach(async () => {
    await resetClient();
    vi.unstubAllEnvs();
  });

  afterEach(async () => {
    await resetClient();
    vi.unstubAllEnvs();
  });

  describe('config validation', () => {
    it('should default enabled to true', () => {
      const config = validateConfig({
        apiKey: 'bk_1234567890123456789012345678901234567890',
      });
      expect(config.enabled).toBe(true);
    });

    it('should skip API key validation when disabled', () => {
      const config = validateConfig({
        apiKey: 'invalid',
        enabled: false,
      });
      expect(config.enabled).toBe(false);
      expect(config.apiKey).toBe('invalid');
    });

    it('should accept empty API key when disabled', () => {
      const config = validateConfig({
        apiKey: '',
        enabled: false,
      });
      expect(config.enabled).toBe(false);
    });

    it('should accept undefined API key when disabled', () => {
      const config = validateConfig({
        enabled: false,
      } as BrokleConfigInput);
      expect(config.enabled).toBe(false);
      expect(config.apiKey).toBe('bk_disabled_placeholder_0000000000000000');
    });

    it('should require API key when enabled', () => {
      expect(() =>
        validateConfig({
          apiKey: '',
        })
      ).toThrow('API key is required');
    });

    it('should validate API key format when enabled', () => {
      expect(() =>
        validateConfig({
          apiKey: 'invalid',
        })
      ).toThrow('must start with "bk_"');
    });

    it('should skip all other validation when disabled', () => {
      // These would normally throw errors, but disabled skips validation
      const config = validateConfig({
        enabled: false,
        apiKey: 'invalid',
        baseUrl: 'not-a-url', // Would normally fail URL validation
        sampleRate: -999, // Would normally fail range check
      });

      expect(config.enabled).toBe(false);
      expect(config.baseUrl).toBe('not-a-url');
      expect(config.sampleRate).toBe(-999);
    });
  });

  describe('loadFromEnv', () => {
    it('should read BROKLE_ENABLED=false', () => {
      vi.stubEnv('BROKLE_ENABLED', 'false');
      const config = loadFromEnv();
      expect(config.enabled).toBe(false);
    });

    it('should read BROKLE_ENABLED=0', () => {
      vi.stubEnv('BROKLE_ENABLED', '0');
      const config = loadFromEnv();
      expect(config.enabled).toBe(false);
    });

    it('should read BROKLE_ENABLED=no', () => {
      vi.stubEnv('BROKLE_ENABLED', 'no');
      const config = loadFromEnv();
      expect(config.enabled).toBe(false);
    });

    it('should read BROKLE_ENABLED=off', () => {
      vi.stubEnv('BROKLE_ENABLED', 'off');
      const config = loadFromEnv();
      expect(config.enabled).toBe(false);
    });

    it('should not require API key when disabled', () => {
      vi.stubEnv('BROKLE_ENABLED', 'false');
      // Don't set BROKLE_API_KEY
      expect(() => loadFromEnv()).not.toThrow();
    });

    it('should default to enabled when not set', () => {
      vi.stubEnv('BROKLE_API_KEY', 'bk_1234567890123456789012345678901234567890');
      const config = loadFromEnv();
      expect(config.enabled).toBe(true);
    });

    it('should require API key when enabled', () => {
      // Don't set BROKLE_ENABLED (defaults to true)
      // Don't set BROKLE_API_KEY
      expect(() => loadFromEnv()).toThrow('BROKLE_API_KEY environment variable is required');
    });

    it('should read BROKLE_ENABLED=true', () => {
      vi.stubEnv('BROKLE_ENABLED', 'true');
      vi.stubEnv('BROKLE_API_KEY', 'bk_1234567890123456789012345678901234567890');
      const config = loadFromEnv();
      expect(config.enabled).toBe(true);
    });

    it('should read BROKLE_ENABLED=1', () => {
      vi.stubEnv('BROKLE_ENABLED', '1');
      vi.stubEnv('BROKLE_API_KEY', 'bk_1234567890123456789012345678901234567890');
      const config = loadFromEnv();
      expect(config.enabled).toBe(true);
    });

    it('should read BROKLE_ENABLED=yes', () => {
      vi.stubEnv('BROKLE_ENABLED', 'yes');
      vi.stubEnv('BROKLE_API_KEY', 'bk_1234567890123456789012345678901234567890');
      const config = loadFromEnv();
      expect(config.enabled).toBe(true);
    });

    it('should be case-insensitive for enabled values', () => {
      vi.stubEnv('BROKLE_ENABLED', 'FALSE');
      const config = loadFromEnv();
      expect(config.enabled).toBe(false);
    });
  });

  describe('client initialization', () => {
    it('should accept enabled parameter', () => {
      const client = new Brokle({
        apiKey: 'bk_1234567890123456789012345678901234567890',
        enabled: false,
      });
      expect(client.getConfig().enabled).toBe(false);
    });

    it('should default enabled to true', () => {
      const client = new Brokle({
        apiKey: 'bk_1234567890123456789012345678901234567890',
      });
      expect(client.getConfig().enabled).toBe(true);
    });

    it('should not create OTEL providers when disabled', () => {
      const client = new Brokle({
        apiKey: 'bk_1234567890123456789012345678901234567890',
        enabled: false,
      });
      expect(client.getProvider()).toBeNull();
      expect(client.getMeterProvider()).toBeNull();
      expect(client.getLoggerProvider()).toBeNull();
    });

    it('should accept invalid API key when disabled', () => {
      expect(
        () =>
          new Brokle({
            apiKey: 'invalid',
            enabled: false,
          })
      ).not.toThrow();
    });

    it('should create a tracer even when disabled', () => {
      const client = new Brokle({
        apiKey: 'bk_1234567890123456789012345678901234567890',
        enabled: false,
      });
      // Should have a no-op tracer
      expect(client.getTracer()).toBeDefined();
    });
  });

  describe('createAsync() with disabled', () => {
    it('should return no-op client when disabled', async () => {
      const client = await Brokle.createAsync({
        apiKey: 'bk_1234567890123456789012345678901234567890',
        enabled: false,
      });

      expect(client.getConfig().enabled).toBe(false);
      expect(client.getProvider()).toBeNull();
      expect(client.getMeterProvider()).toBeNull();
      expect(client.getLoggerProvider()).toBeNull();
    });

    it('should return no-op client when disabled with gRPC transport', async () => {
      const client = await Brokle.createAsync({
        apiKey: 'bk_1234567890123456789012345678901234567890',
        enabled: false,
        transport: 'grpc',
      });

      expect(client.getConfig().enabled).toBe(false);
      expect(client.getProvider()).toBeNull();
    });

    it('should accept invalid API key when disabled via createAsync', async () => {
      await expect(
        Brokle.createAsync({
          apiKey: 'invalid',
          enabled: false,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('getClient singleton', () => {
    it('should return disabled client from environment', () => {
      vi.stubEnv('BROKLE_ENABLED', 'false');
      const client = getClient();
      expect(client.getConfig().enabled).toBe(false);
      expect(client.getProvider()).toBeNull();
    });

    it('should return same disabled instance on subsequent calls', () => {
      vi.stubEnv('BROKLE_ENABLED', 'false');
      const client1 = getClient();
      const client2 = getClient();
      expect(client1).toBe(client2);
    });
  });

  describe('traced() pass-through', () => {
    it('should pass through when disabled', async () => {
      const client = new Brokle({
        apiKey: 'bk_1234567890123456789012345678901234567890',
        enabled: false,
      });

      const result = await client.traced('test', async () => {
        return 'hello';
      });

      expect(result).toBe('hello');
    });

    it('should preserve return values when disabled', async () => {
      const client = new Brokle({
        apiKey: 'bk_1234567890123456789012345678901234567890',
        enabled: false,
      });

      const result = await client.traced('test', async () => {
        return { key: 'value', count: 42 };
      });

      expect(result).toEqual({ key: 'value', count: 42 });
    });

    it('should propagate errors when disabled', async () => {
      const client = new Brokle({
        apiKey: 'bk_1234567890123456789012345678901234567890',
        enabled: false,
      });

      await expect(
        client.traced('test', async () => {
          throw new Error('test error');
        })
      ).rejects.toThrow('test error');
    });
  });

  describe('generation() pass-through', () => {
    it('should pass through when disabled', async () => {
      const client = new Brokle({
        apiKey: 'bk_1234567890123456789012345678901234567890',
        enabled: false,
      });

      const result = await client.generation('chat', 'gpt-4', 'openai', async () => {
        return 'response';
      });

      expect(result).toBe('response');
    });
  });

  describe('flush() no-op when disabled', () => {
    it('should not throw when disabled', async () => {
      const client = new Brokle({
        apiKey: 'bk_1234567890123456789012345678901234567890',
        enabled: false,
      });

      await expect(client.flush()).resolves.not.toThrow();
    });
  });

  describe('shutdown() no-op when disabled', () => {
    it('should not throw when disabled', async () => {
      const client = new Brokle({
        apiKey: 'bk_1234567890123456789012345678901234567890',
        enabled: false,
      });

      await expect(client.shutdown()).resolves.not.toThrow();
    });
  });
});
