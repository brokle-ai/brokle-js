/**
 * Brokle Anthropic Integration
 *
 * Automatic tracing for Anthropic SDK with zero code changes required.
 *
 * @example
 * ```typescript
 * import Anthropic from '@anthropic-ai/sdk';
 * import { wrapAnthropic } from 'brokle/anthropic';
 *
 * const anthropic = wrapAnthropic(new Anthropic({ apiKey: '...' }));
 *
 * // All calls automatically traced
 * const response = await anthropic.messages.create({
 *   model: 'claude-3-opus-20240229',
 *   max_tokens: 1024,
 *   messages: [{ role: 'user', content: 'Hello' }],
 * });
 * ```
 */

export { wrapAnthropic } from './wrapper';
export type { MessageAttributes } from './parser';
