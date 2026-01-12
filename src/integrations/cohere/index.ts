/**
 * Brokle Cohere Integration
 *
 * Automatic tracing for Cohere SDK.
 *
 * @example
 * ```typescript
 * import { CohereClientV2 } from 'cohere-ai';
 * import { wrapCohere } from 'brokle/cohere';
 *
 * const cohere = wrapCohere(new CohereClientV2({ token: '...' }));
 *
 * // All calls automatically traced
 * const response = await cohere.chat({
 *   model: 'command-r-plus',
 *   messages: [{ role: 'user', content: 'Hello' }],
 * });
 * ```
 */

export { wrapCohere } from './wrapper';
export type { CohereWrapperOptions } from './types';
