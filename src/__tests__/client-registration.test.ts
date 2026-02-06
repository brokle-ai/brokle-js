/**
 * Tests for global client registration:
 * - Phase 1: Auto-registration in constructor (first-write-wins)
 * - Phase 2: Context scoping via setClient / resolveClient / withBrokleClient
 * - Phase 3: Deferred call-time resolution in wrappers
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Brokle, getClient, setClient, resetClient, resolveClient, withBrokleClient } from '../client';

const VALID_KEY = 'bk_1234567890123456789012345678901234567890';

describe('client registration', () => {
  beforeEach(async () => {
    await resetClient();
    vi.unstubAllEnvs();
  });

  afterEach(async () => {
    await resetClient();
    vi.unstubAllEnvs();
  });

  describe('Phase 1: auto-registration', () => {
    it('should auto-register on construction', () => {
      const client = new Brokle({ apiKey: VALID_KEY });
      expect(getClient()).toBe(client);
    });

    it('should follow first-write-wins (second instance does not overwrite)', () => {
      const first = new Brokle({ apiKey: VALID_KEY });
      const second = new Brokle({ apiKey: VALID_KEY });
      expect(getClient()).toBe(first);
      expect(getClient()).not.toBe(second);
    });

    it('should auto-register disabled client', () => {
      const client = new Brokle({ apiKey: 'invalid', enabled: false });
      expect(getClient()).toBe(client);
      expect(client.getConfig().enabled).toBe(false);
    });

    it('should allow setClient to overwrite auto-registered client', () => {
      const first = new Brokle({ apiKey: VALID_KEY });
      const second = new Brokle({ apiKey: VALID_KEY });
      expect(getClient()).toBe(first);

      setClient(second);
      expect(getClient()).toBe(second);
    });

    it('should auto-register via createAsync', async () => {
      const client = await Brokle.createAsync({ apiKey: VALID_KEY, enabled: false });
      expect(getClient()).toBe(client);
    });
  });

  describe('Phase 2: resolveClient and withBrokleClient', () => {
    it('resolveClient should return explicit client when provided', () => {
      const global = new Brokle({ apiKey: VALID_KEY });
      const explicit = new Brokle({ apiKey: VALID_KEY });

      expect(resolveClient(explicit)).toBe(explicit);
      // Global should still be the first one
      expect(resolveClient()).toBe(global);
    });

    it('resolveClient should fall back to global client', () => {
      const client = new Brokle({ apiKey: VALID_KEY });
      expect(resolveClient()).toBe(client);
    });

    it('withBrokleClient should scope client within async function', async () => {
      const global = new Brokle({ apiKey: VALID_KEY });
      const scoped = new Brokle({ apiKey: VALID_KEY });

      // Outside scope: global
      expect(resolveClient()).toBe(global);

      await withBrokleClient(scoped, async () => {
        // Inside scope: scoped
        expect(resolveClient()).toBe(scoped);
      });

      // After scope: back to global
      expect(resolveClient()).toBe(global);
    });

    it('withBrokleClient should support nested scopes', async () => {
      const global = new Brokle({ apiKey: VALID_KEY });
      const scopeA = new Brokle({ apiKey: VALID_KEY });
      const scopeB = new Brokle({ apiKey: VALID_KEY });

      expect(resolveClient()).toBe(global);

      await withBrokleClient(scopeA, async () => {
        expect(resolveClient()).toBe(scopeA);

        await withBrokleClient(scopeB, async () => {
          expect(resolveClient()).toBe(scopeB);
        });

        // Back to scopeA after inner scope exits
        expect(resolveClient()).toBe(scopeA);
      });

      // Back to global
      expect(resolveClient()).toBe(global);
    });

    it('withBrokleClient should restore on exception', async () => {
      const global = new Brokle({ apiKey: VALID_KEY });
      const scoped = new Brokle({ apiKey: VALID_KEY });

      try {
        await withBrokleClient(scoped, async () => {
          expect(resolveClient()).toBe(scoped);
          throw new Error('test error');
        });
      } catch {
        // Expected
      }

      // Should be restored to global
      expect(resolveClient()).toBe(global);
    });
  });

  describe('shutdown cleanup', () => {
    it('should clear global state on shutdown', async () => {
      const client = new Brokle({ apiKey: VALID_KEY, enabled: false });
      expect(getClient()).toBe(client);
      await client.shutdown();
      // Global state cleared — getClient() should create a new instance
      vi.stubEnv('BROKLE_ENABLED', 'false');
      const fresh = getClient();
      expect(fresh).not.toBe(client);
    });

    it('should only clear own registration on shutdown', async () => {
      const first = new Brokle({ apiKey: VALID_KEY, enabled: false });
      const second = new Brokle({ apiKey: VALID_KEY, enabled: false });
      expect(getClient()).toBe(first);
      await second.shutdown(); // second is NOT registered
      expect(getClient()).toBe(first); // first still registered
    });
  });

  describe('Phase 3: deferred resolution in wrappers', () => {
    it('should support wrap-before-init pattern', () => {
      // This verifies that wrapping before client init doesn't fail
      // The actual client resolution happens at call time, not wrap time
      // This test just verifies the auto-registration mechanism works
      // when client is created after some initial setup

      // Reset to ensure no client exists
      // Create client after wrapper would have been set up
      const client = new Brokle({ apiKey: VALID_KEY, enabled: false });
      expect(getClient()).toBe(client);
      expect(resolveClient()).toBe(client);
    });
  });
});
