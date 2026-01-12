/**
 * Brokle Vercel AI SDK Integration
 *
 * Automatic tracing for Vercel AI SDK (generateText, streamText, generateObject, streamObject)
 * using the SDK's built-in experimental_telemetry support.
 *
 * @example
 * ```typescript
 * import { generateText } from 'ai';
 * import { openai } from '@ai-sdk/openai';
 * import { getBrokleTelemetry, wrapAI } from 'brokle/vercel-ai';
 *
 * // Option 1: Use telemetry config directly
 * const result = await generateText({
 *   model: openai('gpt-4'),
 *   prompt: 'Hello',
 *   experimental_telemetry: getBrokleTelemetry({ functionId: 'my-chat' }),
 * });
 *
 * // Option 2: Use wrapped functions (auto-injects telemetry)
 * const ai = wrapAI({ generateText, streamText });
 * const result = await ai.generateText({
 *   model: openai('gpt-4'),
 *   prompt: 'Hello',
 * });
 * ```
 */

export { getBrokleTelemetry, wrapAI, wrapAIFunction } from './wrapper';
export type { BrokleTelemetryConfig, WrappedAIFunctions, AIFunctions, BrokleAIOptions, ExperimentalTelemetry } from './types';
