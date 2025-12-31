/**
 * Brokle OpenAI Integration
 *
 * Automatic tracing for OpenAI SDK with zero code changes required.
 *
 * @example
 * ```typescript
 * import OpenAI from 'openai';
 * import { wrapOpenAI } from 'brokle/openai';
 *
 * const openai = wrapOpenAI(new OpenAI({ apiKey: '...' }));
 *
 * // All calls automatically traced
 * const response = await openai.chat.completions.create({
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Hello' }],
 * });
 * ```
 */

export { wrapOpenAI } from './wrapper';
export type { ChatCompletionAttributes, CompletionAttributes } from './parser';
