/**
 * Brokle AWS Bedrock Integration
 *
 * Automatic tracing for AWS Bedrock Runtime SDK.
 *
 * @example
 * ```typescript
 * import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
 * import { wrapBedrock } from 'brokle/bedrock';
 *
 * const bedrock = wrapBedrock(new BedrockRuntimeClient({ region: 'us-east-1' }));
 *
 * // All calls automatically traced
 * const response = await bedrock.send(new ConverseCommand({
 *   modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
 *   messages: [{ role: 'user', content: [{ text: 'Hello' }] }],
 * }));
 * ```
 */

export { wrapBedrock } from './wrapper';
export type { BedrockWrapperOptions } from './types';
