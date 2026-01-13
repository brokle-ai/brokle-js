/**
 * Shared helper functions for LLM SDK wrappers.
 *
 * These utilities are used by brokle-openai, brokle-anthropic, and other
 * wrapper packages to extract brokle options and add prompt attributes.
 */

import type { Prompt } from '../prompt';
import { Attrs } from '../types/attributes';

/**
 * Brokle-specific options that can be passed with any LLM API call
 */
export interface BrokleOptions {
  /** Prompt to link to this span (fallback prompts are not linked) */
  prompt?: Prompt;
}

/**
 * Helper to extract brokle_options from params and return clean params
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractBrokleOptions(params: any): { cleanParams: any; brokleOpts: BrokleOptions } {
  if (!params || typeof params !== 'object') {
    return { cleanParams: params, brokleOpts: {} };
  }

  const { brokle_options, ...cleanParams } = params;
  return { cleanParams, brokleOpts: brokle_options || {} };
}

/**
 * Helper to set an attribute on either a span or plain object
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setAttr(target: any, key: string, value: any): void {
  if (typeof target.setAttribute === 'function') {
    // It's a span - use setAttribute
    target.setAttribute(key, value);
  } else {
    // It's a plain object - use property assignment
    target[key] = value;
  }
}

/**
 * Helper to add prompt attributes to span or attributes object if prompt is provided and not a fallback
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function addPromptAttributes(target: Record<string, any>, brokleOpts: BrokleOptions): void {
  if (brokleOpts.prompt && !brokleOpts.prompt.isFallback) {
    setAttr(target, Attrs.BROKLE_PROMPT_NAME, brokleOpts.prompt.name);
    setAttr(target, Attrs.BROKLE_PROMPT_VERSION, brokleOpts.prompt.version);
    if (brokleOpts.prompt.id && brokleOpts.prompt.id !== 'fallback') {
      setAttr(target, Attrs.BROKLE_PROMPT_ID, brokleOpts.prompt.id);
    }
  }
}
