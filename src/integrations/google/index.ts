/**
 * Brokle Google GenAI Integration
 *
 * Automatic tracing for Google GenAI SDK (@google/genai).
 *
 * @example
 * ```typescript
 * import { GoogleGenAI } from '@google/genai';
 * import { wrapGoogleGenAI } from 'brokle/google';
 *
 * const ai = wrapGoogleGenAI(new GoogleGenAI({ apiKey }));
 *
 * // All calls automatically traced
 * const response = await ai.models.generateContent({
 *   model: 'gemini-2.0-flash',
 *   contents: 'Hello!',
 * });
 * ```
 */

export { wrapGoogleGenAI } from './wrapper';
export type { GoogleGenAIWrapperOptions } from './types';
