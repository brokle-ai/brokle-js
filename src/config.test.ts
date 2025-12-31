/**
 * Configuration validation tests
 */

import { describe, it, expect } from 'vitest';
import { validateConfig } from './config';
import type { BrokleConfigInput } from './types/config';

describe('validateConfig', () => {
  describe('API key validation', () => {
    it('should accept valid API key', () => {
      const config: BrokleConfigInput = {
        apiKey: 'bk_1234567890123456789012345678901234567890',
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should reject API key without bk_ prefix', () => {
      const config: BrokleConfigInput = {
        apiKey: 'invalid_1234567890123456789012345678901234567890',
      };

      expect(() => validateConfig(config)).toThrow('must start with "bk_"');
    });

    it('should reject API key with wrong length', () => {
      const config: BrokleConfigInput = {
        apiKey: 'bk_short',
      };

      expect(() => validateConfig(config)).toThrow('expected 43 characters');
    });

    it('should reject API key with non-alphanumeric characters', () => {
      const config: BrokleConfigInput = {
        apiKey: 'bk_1234567890!@#$%^&*()12345678901234567890',
      };

      expect(() => validateConfig(config)).toThrow('must be 40 alphanumeric characters');
    });
  });

  describe('sample rate validation', () => {
    it('should accept valid sample rate 0.0', () => {
      const config: BrokleConfigInput = {
        apiKey: 'bk_1234567890123456789012345678901234567890',
        sampleRate: 0.0,
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should accept valid sample rate 0.5', () => {
      const config: BrokleConfigInput = {
        apiKey: 'bk_1234567890123456789012345678901234567890',
        sampleRate: 0.5,
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should accept valid sample rate 1.0', () => {
      const config: BrokleConfigInput = {
        apiKey: 'bk_1234567890123456789012345678901234567890',
        sampleRate: 1.0,
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should reject NaN sample rate', () => {
      const config: BrokleConfigInput = {
        apiKey: 'bk_1234567890123456789012345678901234567890',
        sampleRate: NaN,
      };

      expect(() => validateConfig(config)).toThrow('must be a valid number, got NaN');
    });

    it('should reject Infinity sample rate', () => {
      const config: BrokleConfigInput = {
        apiKey: 'bk_1234567890123456789012345678901234567890',
        sampleRate: Infinity,
      };

      expect(() => validateConfig(config)).toThrow('must be a finite number');
    });

    it('should reject negative Infinity sample rate', () => {
      const config: BrokleConfigInput = {
        apiKey: 'bk_1234567890123456789012345678901234567890',
        sampleRate: -Infinity,
      };

      expect(() => validateConfig(config)).toThrow('must be a finite number');
    });

    it('should reject sample rate < 0', () => {
      const config: BrokleConfigInput = {
        apiKey: 'bk_1234567890123456789012345678901234567890',
        sampleRate: -0.5,
      };

      expect(() => validateConfig(config)).toThrow('must be between 0.0 and 1.0');
    });

    it('should reject sample rate > 1', () => {
      const config: BrokleConfigInput = {
        apiKey: 'bk_1234567890123456789012345678901234567890',
        sampleRate: 1.5,
      };

      expect(() => validateConfig(config)).toThrow('must be between 0.0 and 1.0');
    });
  });

  describe('base URL validation', () => {
    it('should accept valid HTTP URL', () => {
      const config: BrokleConfigInput = {
        apiKey: 'bk_1234567890123456789012345678901234567890',
        baseUrl: 'http://localhost:8080',
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should accept valid HTTPS URL', () => {
      const config: BrokleConfigInput = {
        apiKey: 'bk_1234567890123456789012345678901234567890',
        baseUrl: 'https://api.brokle.ai',
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should reject invalid URL', () => {
      const config: BrokleConfigInput = {
        apiKey: 'bk_1234567890123456789012345678901234567890',
        baseUrl: 'not-a-url',
      };

      expect(() => validateConfig(config)).toThrow('Invalid base URL');
    });
  });

  describe('flush configuration validation', () => {
    it('should reject flushAt <= 0', () => {
      const config: BrokleConfigInput = {
        apiKey: 'bk_1234567890123456789012345678901234567890',
        flushAt: 0,
      };

      expect(() => validateConfig(config)).toThrow('flushAt must be greater than 0');
    });

    it('should reject negative flushAt', () => {
      const config: BrokleConfigInput = {
        apiKey: 'bk_1234567890123456789012345678901234567890',
        flushAt: -10,
      };

      expect(() => validateConfig(config)).toThrow('flushAt must be greater than 0');
    });

    it('should reject flushInterval <= 0', () => {
      const config: BrokleConfigInput = {
        apiKey: 'bk_1234567890123456789012345678901234567890',
        flushInterval: 0,
      };

      expect(() => validateConfig(config)).toThrow('flushInterval must be greater than 0');
    });

    it('should reject maxQueueSize <= 0', () => {
      const config: BrokleConfigInput = {
        apiKey: 'bk_1234567890123456789012345678901234567890',
        maxQueueSize: 0,
      };

      expect(() => validateConfig(config)).toThrow('maxQueueSize must be greater than 0');
    });

    it('should reject timeout <= 0', () => {
      const config: BrokleConfigInput = {
        apiKey: 'bk_1234567890123456789012345678901234567890',
        timeout: 0,
      };

      expect(() => validateConfig(config)).toThrow('timeout must be greater than 0');
    });

    it('should reject metricsInterval <= 0', () => {
      const config: BrokleConfigInput = {
        apiKey: 'bk_1234567890123456789012345678901234567890',
        metricsInterval: 0,
      };

      expect(() => validateConfig(config)).toThrow('metricsInterval must be greater than 0');
    });

    it('should reject negative metricsInterval', () => {
      const config: BrokleConfigInput = {
        apiKey: 'bk_1234567890123456789012345678901234567890',
        metricsInterval: -5000,
      };

      expect(() => validateConfig(config)).toThrow('metricsInterval must be greater than 0');
    });
  });

  describe('transport validation', () => {
    it('should accept http transport', () => {
      const config: BrokleConfigInput = {
        apiKey: 'bk_1234567890123456789012345678901234567890',
        transport: 'http',
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should accept grpc transport', () => {
      const config: BrokleConfigInput = {
        apiKey: 'bk_1234567890123456789012345678901234567890',
        transport: 'grpc',
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should reject invalid transport', () => {
      const config: BrokleConfigInput = {
        apiKey: 'bk_1234567890123456789012345678901234567890',
        transport: 'websocket' as any,
      };

      expect(() => validateConfig(config)).toThrow("Invalid transport: websocket. Must be 'http' or 'grpc'");
    });

    it('should use default transport for undefined', () => {
      const config: BrokleConfigInput = {
        apiKey: 'bk_1234567890123456789012345678901234567890',
        transport: undefined,
      };

      const validated = validateConfig(config);
      expect(validated.transport).toBe('http');
    });
  });

  describe('default values', () => {
    it('should apply default values for missing config', () => {
      const config: BrokleConfigInput = {
        apiKey: 'bk_1234567890123456789012345678901234567890',
      };

      const validated = validateConfig(config);

      expect(validated.baseUrl).toBe('http://localhost:8080');
      expect(validated.environment).toBe('default');
      expect(validated.sampleRate).toBe(1.0);
      expect(validated.flushAt).toBe(100);
      expect(validated.flushInterval).toBe(10);
      expect(validated.debug).toBe(false);
      expect(validated.transport).toBe('http');
      expect(validated.metricsInterval).toBe(60000);
      expect(validated.tracingEnabled).toBe(true);
      expect(validated.metricsEnabled).toBe(true);
      expect(validated.logsEnabled).toBe(false);
      expect(validated.maxQueueSize).toBe(10000);
      expect(validated.timeout).toBe(30000);
      expect(validated.flushSync).toBe(false);
    });
  });
});