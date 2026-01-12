/**
 * Brokle Azure OpenAI Integration
 *
 * Automatic tracing for Azure OpenAI SDK. Extends the OpenAI wrapper with
 * Azure-specific metadata (deployment, resource, API version).
 *
 * @example
 * ```typescript
 * import { AzureOpenAI } from 'openai';
 * import { wrapAzureOpenAI } from 'brokle/azure';
 *
 * const azure = wrapAzureOpenAI(new AzureOpenAI({
 *   endpoint: 'https://your-resource.openai.azure.com',
 *   apiVersion: '2024-02-15-preview',
 * }));
 *
 * // All calls automatically traced with Azure metadata
 * const response = await azure.chat.completions.create({
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Hello' }],
 * });
 * ```
 */

export { wrapAzureOpenAI } from './wrapper';
export type { AzureOpenAIWrapperOptions, AzureMetadata } from './types';
