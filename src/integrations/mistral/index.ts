/**
 * Brokle Mistral AI Integration
 *
 * Automatic tracing for Mistral AI SDK.
 *
 * @example
 * ```typescript
 * import Mistral from '@mistralai/mistralai';
 * import { wrapMistral } from 'brokle/mistral';
 *
 * const mistral = wrapMistral(new Mistral({ apiKey: '...' }));
 *
 * // All calls automatically traced
 * const response = await mistral.chat.complete({
 *   model: 'mistral-large-latest',
 *   messages: [{ role: 'user', content: 'Hello' }],
 * });
 * ```
 */

export { wrapMistral } from './wrapper';
export type { MistralWrapperOptions } from './types';
