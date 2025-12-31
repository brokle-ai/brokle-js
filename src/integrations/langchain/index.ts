/**
 * Brokle LangChain.js Integration
 *
 * Automatic tracing for LangChain.js with callback handlers.
 *
 * @example
 * ```typescript
 * import { BrokleLangChainCallback } from 'brokle/langchain';
 *
 * const callback = new BrokleLangChainCallback({
 *   userId: 'user-123',
 *   sessionId: 'session-456',
 *   tags: ['production'],
 * });
 *
 * const result = await chain.invoke(
 *   { input: 'What is AI?' },
 *   { callbacks: [callback] }
 * );
 *
 * await callback.flush();
 * ```
 */

export { BrokleLangChainCallback } from './callback';
export type { BrokleLangChainCallbackConfig } from './callback';
