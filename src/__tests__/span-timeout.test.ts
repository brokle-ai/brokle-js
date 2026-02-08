/**
 * Tests for startActiveSpan timeout option.
 *
 * Verifies that the optional timeout parameter correctly abandons
 * stale callbacks and ends spans with ERROR status.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Brokle, resetClient } from '../client';
import { SpanTimeoutError } from '../errors';

describe('startActiveSpan timeout', () => {
  beforeEach(async () => {
    await resetClient();
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await resetClient();
  });

  describe('without timeout (default behavior)', () => {
    it('should resolve normally when callback completes', async () => {
      const client = new Brokle({
        apiKey: 'bk_1234567890123456789012345678901234567890',
        enabled: false,
      });

      const result = await client.startActiveSpan('test', async () => {
        return 'done';
      });

      expect(result).toBe('done');
    });

    it('should propagate errors from callback', async () => {
      const client = new Brokle({
        apiKey: 'bk_1234567890123456789012345678901234567890',
        enabled: false,
      });

      await expect(
        client.startActiveSpan('test', async () => {
          throw new Error('callback error');
        })
      ).rejects.toThrow('callback error');
    });
  });

  describe('with timeout', () => {
    it('should resolve normally when callback completes before timeout', async () => {
      const client = new Brokle({
        apiKey: 'bk_1234567890123456789012345678901234567890',
        enabled: false,
      });

      const promise = client.startActiveSpan(
        'fast-op',
        async () => 'quick result',
        undefined,
        { timeout: 5000 }
      );

      const result = await promise;
      expect(result).toBe('quick result');
    });

    it('should throw SpanTimeoutError when callback exceeds timeout', async () => {
      const client = new Brokle({
        apiKey: 'bk_1234567890123456789012345678901234567890',
        enabled: false,
      });

      const promise = client.startActiveSpan(
        'slow-op',
        async () => {
          // This promise never resolves (simulates a hung callback)
          return new Promise<string>(() => {});
        },
        undefined,
        { timeout: 1000 }
      );

      // Advance time past the timeout
      vi.advanceTimersByTime(1001);

      await expect(promise).rejects.toThrow(SpanTimeoutError);
      await expect(promise).rejects.toThrow('Span "slow-op" timed out after 1000ms');
    });

    it('should include span name and timeout in the error', async () => {
      const client = new Brokle({
        apiKey: 'bk_1234567890123456789012345678901234567890',
        enabled: false,
      });

      const promise = client.startActiveSpan(
        'my-span',
        async () => new Promise<void>(() => {}),
        undefined,
        { timeout: 500 }
      );

      vi.advanceTimersByTime(501);

      try {
        await promise;
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(SpanTimeoutError);
        const timeoutErr = err as SpanTimeoutError;
        expect(timeoutErr.spanName).toBe('my-span');
        expect(timeoutErr.timeoutMs).toBe(500);
      }
    });

    it('should not timeout when callback resolves in time', async () => {
      const client = new Brokle({
        apiKey: 'bk_1234567890123456789012345678901234567890',
        enabled: false,
      });

      let resolveCallback: (value: string) => void;
      const promise = client.startActiveSpan(
        'delayed-op',
        async () => {
          return new Promise<string>((resolve) => {
            resolveCallback = resolve;
          });
        },
        undefined,
        { timeout: 5000 }
      );

      // Resolve before timeout
      resolveCallback!('in time');

      const result = await promise;
      expect(result).toBe('in time');

      // Advancing past timeout should not cause issues (timer should be cleared)
      vi.advanceTimersByTime(6000);
    });

    it('should propagate callback errors even with timeout set', async () => {
      const client = new Brokle({
        apiKey: 'bk_1234567890123456789012345678901234567890',
        enabled: false,
      });

      await expect(
        client.startActiveSpan(
          'error-op',
          async () => {
            throw new Error('callback failed');
          },
          undefined,
          { timeout: 5000 }
        )
      ).rejects.toThrow('callback failed');
    });

    it('should throw SpanTimeoutError immediately when timeout is 0', async () => {
      const client = new Brokle({
        apiKey: 'bk_1234567890123456789012345678901234567890',
        enabled: false,
      });

      const promise = client.startActiveSpan(
        'zero-timeout-op',
        async () => new Promise<string>(() => {}),
        undefined,
        { timeout: 0 }
      );

      // Rejection is synchronous — no timer advance needed
      await expect(promise).rejects.toThrow(SpanTimeoutError);
      await expect(promise).rejects.toThrow('Span "zero-timeout-op" timed out after 0ms');
    });

    it('should throw SpanTimeoutError with timeout=0 even for sync callbacks', async () => {
      const client = new Brokle({
        apiKey: 'bk_1234567890123456789012345678901234567890',
        enabled: false,
      });

      const promise = client.startActiveSpan(
        'zero-timeout-sync-op',
        async () => 'instant result',
        undefined,
        { timeout: 0 }
      );

      await expect(promise).rejects.toThrow(SpanTimeoutError);
      await expect(promise).rejects.toThrow('Span "zero-timeout-sync-op" timed out after 0ms');
    });

    it('should ignore negative timeout and resolve normally', async () => {
      const client = new Brokle({
        apiKey: 'bk_1234567890123456789012345678901234567890',
        enabled: false,
      });

      const result = await client.startActiveSpan(
        'negative-timeout-op',
        async () => 'ok',
        undefined,
        { timeout: -1 }
      );

      expect(result).toBe('ok');
    });

    it('should ignore NaN timeout and resolve normally', async () => {
      const client = new Brokle({
        apiKey: 'bk_1234567890123456789012345678901234567890',
        enabled: false,
      });

      const result = await client.startActiveSpan(
        'nan-timeout-op',
        async () => 'ok',
        undefined,
        { timeout: NaN }
      );

      expect(result).toBe('ok');
    });
  });

  describe('with enabled client (tracing enabled, no server needed)', () => {
    it('should timeout with enabled client', async () => {
      // Use flushSync to avoid batch export needing a server connection
      const client = new Brokle({
        apiKey: 'bk_1234567890123456789012345678901234567890',
        baseUrl: 'http://localhost:59999',
        flushSync: true,
      });

      const promise = client.startActiveSpan(
        'enabled-slow-op',
        async () => new Promise<void>(() => {}),
        undefined,
        { timeout: 2000 }
      );

      vi.advanceTimersByTime(2001);

      await expect(promise).rejects.toThrow(SpanTimeoutError);
    });

    it('should resolve normally with enabled client when callback completes', async () => {
      const client = new Brokle({
        apiKey: 'bk_1234567890123456789012345678901234567890',
        baseUrl: 'http://localhost:59999',
        flushSync: true,
      });

      const result = await client.startActiveSpan(
        'enabled-fast-op',
        async () => 42,
        undefined,
        { timeout: 5000 }
      );

      expect(result).toBe(42);
    });
  });
});
