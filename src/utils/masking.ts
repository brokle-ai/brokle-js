/**
 * Built-in masking utilities for common PII patterns.
 *
 * Provides pre-built masking functions and helpers for common privacy use cases:
 * - Email addresses
 * - Phone numbers
 * - SSN (Social Security Numbers)
 * - Credit card numbers
 * - API keys
 * - Custom field-based masking
 *
 * All masking functions support recursive application to nested data structures
 * (objects, arrays) while preserving the original structure.
 *
 * @example
 * ```typescript
 * import { Brokle } from '@brokle/sdk';
 * import { MaskingHelper } from '@brokle/sdk/utils/masking';
 *
 * // Use pre-built PII masker
 * const client = new Brokle({
 *   apiKey: 'bk_secret',
 *   mask: MaskingHelper.maskPII
 * });
 *
 * // Use specific masker
 * const client2 = new Brokle({
 *   apiKey: 'bk_secret',
 *   mask: MaskingHelper.maskEmails
 * });
 *
 * // Field-based masking
 * const client3 = new Brokle({
 *   apiKey: 'bk_secret',
 *   mask: MaskingHelper.fieldMask(['password', 'ssn', 'api_key'])
 * });
 * ```
 */

/**
 * Pre-built masking functions for common PII patterns.
 *
 * All methods are static and can be used directly or composed together
 * for custom masking strategies.
 */
export class MaskingHelper {
  // ========== Regex Patterns ==========

  /** Matches email addresses (RFC 5322 simplified) */
  private static readonly EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

  /** Matches US phone numbers (xxx-xxx-xxxx, xxx.xxx.xxxx, xxxxxxxxxx) */
  private static readonly PHONE_PATTERN = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;

  /** Matches US Social Security Numbers (xxx-xx-xxxx) */
  private static readonly SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;

  /** Matches credit card numbers (16 digits with optional separators) */
  private static readonly CREDIT_CARD_PATTERN = /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g;

  /** Matches common API key formats (sk_, pk_, bk_, api_ prefix + 20+ chars) */
  private static readonly API_KEY_PATTERN = /(sk|pk|bk|api)_[a-zA-Z0-9_]{20,}/g;

  // ========== Replacement Strings ==========

  private static readonly EMAIL_REPLACEMENT = '[EMAIL]';
  private static readonly PHONE_REPLACEMENT = '[PHONE]';
  private static readonly SSN_REPLACEMENT = '[SSN]';
  private static readonly CREDIT_CARD_REPLACEMENT = '[CREDIT_CARD]';
  private static readonly API_KEY_REPLACEMENT = '[API_KEY]';

  // ========== Primary Masking Functions ==========

  /**
   * Mask all common PII patterns (email, phone, SSN, credit cards, API keys).
   *
   * This is the recommended all-in-one masking function for general use.
   *
   * @param data - The data to mask (supports strings, objects, arrays, primitives)
   * @returns Masked data with same structure as input
   *
   * @example
   * ```typescript
   * MaskingHelper.maskPII("Contact john@example.com or call 555-123-4567")
   * // Returns: "Contact [EMAIL] or call [PHONE]"
   *
   * MaskingHelper.maskPII({email: "admin@company.com", count: 42})
   * // Returns: {email: "[EMAIL]", count: 42}
   * ```
   */
  static maskPII(data: unknown): unknown {
    return MaskingHelper.recursiveMask(data, (s) => MaskingHelper.applyAllPatterns(s));
  }

  /**
   * Mask email addresses only.
   *
   * @param data - The data to mask
   * @returns Data with emails replaced by [EMAIL]
   *
   * @example
   * ```typescript
   * MaskingHelper.maskEmails("Send to john@example.com and admin@company.org")
   * // Returns: "Send to [EMAIL] and [EMAIL]"
   * ```
   */
  static maskEmails(data: unknown): unknown {
    return MaskingHelper.recursiveMask(data, (s) =>
      s.replace(MaskingHelper.EMAIL_PATTERN, MaskingHelper.EMAIL_REPLACEMENT)
    );
  }

  /**
   * Mask phone numbers only.
   *
   * @param data - The data to mask
   * @returns Data with phone numbers replaced by [PHONE]
   *
   * @example
   * ```typescript
   * MaskingHelper.maskPhones("Call 555-123-4567 or 555.987.6543")
   * // Returns: "Call [PHONE] or [PHONE]"
   * ```
   */
  static maskPhones(data: unknown): unknown {
    return MaskingHelper.recursiveMask(data, (s) =>
      s.replace(MaskingHelper.PHONE_PATTERN, MaskingHelper.PHONE_REPLACEMENT)
    );
  }

  /**
   * Mask Social Security Numbers only.
   *
   * @param data - The data to mask
   * @returns Data with SSNs replaced by [SSN]
   *
   * @example
   * ```typescript
   * MaskingHelper.maskSSN("SSN: 123-45-6789")
   * // Returns: "SSN: [SSN]"
   * ```
   */
  static maskSSN(data: unknown): unknown {
    return MaskingHelper.recursiveMask(data, (s) =>
      s.replace(MaskingHelper.SSN_PATTERN, MaskingHelper.SSN_REPLACEMENT)
    );
  }

  /**
   * Mask credit card numbers only.
   *
   * @param data - The data to mask
   * @returns Data with credit card numbers replaced by [CREDIT_CARD]
   *
   * @example
   * ```typescript
   * MaskingHelper.maskCreditCards("Card: 1234-5678-9012-3456")
   * // Returns: "Card: [CREDIT_CARD]"
   * ```
   */
  static maskCreditCards(data: unknown): unknown {
    return MaskingHelper.recursiveMask(data, (s) =>
      s.replace(MaskingHelper.CREDIT_CARD_PATTERN, MaskingHelper.CREDIT_CARD_REPLACEMENT)
    );
  }

  /**
   * Mask API keys only.
   *
   * Matches common patterns: sk_, pk_, bk_, api_ followed by 20+ characters.
   *
   * @param data - The data to mask
   * @returns Data with API keys replaced by [API_KEY]
   *
   * @example
   * ```typescript
   * MaskingHelper.maskAPIKeys("Key: sk_test_1234567890abcdefghij")
   * // Returns: "Key: [API_KEY]"
   * ```
   */
  static maskAPIKeys(data: unknown): unknown {
    return MaskingHelper.recursiveMask(data, (s) =>
      s.replace(MaskingHelper.API_KEY_PATTERN, MaskingHelper.API_KEY_REPLACEMENT)
    );
  }

  // ========== Field-Based Masking ==========

  /**
   * Create a masking function that masks specific field names in objects.
   *
   * Useful for masking known sensitive fields by name (e.g., 'password', 'ssn').
   *
   * @param fieldNames - Array of field names to mask
   * @param replacement - Replacement value for masked fields (default: '***MASKED***')
   * @param caseSensitive - Whether field name matching is case-sensitive (default: false)
   * @returns A masking function ready to use with Brokle client
   *
   * @example
   * ```typescript
   * const masker = MaskingHelper.fieldMask(['password', 'ssn', 'api_key']);
   * masker({user: 'john', password: 'secret123'})
   * // Returns: {user: 'john', password: '***MASKED***'}
   *
   * // Use with Brokle
   * const client = new Brokle({
   *   apiKey: 'bk_secret',
   *   mask: MaskingHelper.fieldMask(['password'])
   * });
   * ```
   */
  static fieldMask(
    fieldNames: string[],
    replacement: string = '***MASKED***',
    caseSensitive: boolean = false
  ): (data: unknown) => unknown {
    const fieldSet = new Set(caseSensitive ? fieldNames : fieldNames.map((f) => f.toLowerCase()));

    const maskFields = (data: unknown): unknown => {
      if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data)) {
          const checkKey = caseSensitive ? key : key.toLowerCase();
          if (fieldSet.has(checkKey)) {
            result[key] = replacement;
          } else if (typeof value === 'object' && value !== null) {
            result[key] = maskFields(value);
          } else {
            result[key] = value;
          }
        }
        return result;
      } else if (Array.isArray(data)) {
        return data.map(maskFields);
      } else {
        return data;
      }
    };

    return maskFields;
  }

  // ========== Advanced Combinators ==========

  /**
   * Combine multiple masking functions into a single function.
   *
   * The functions are applied in order (left to right).
   *
   * @param maskFunctions - Variable number of masking functions to combine
   * @returns A single masking function that applies all provided functions
   *
   * @example
   * ```typescript
   * const combined = MaskingHelper.combineMasks(
   *   MaskingHelper.maskEmails,
   *   MaskingHelper.maskPhones,
   *   MaskingHelper.fieldMask(['password'])
   * );
   * const client = new Brokle({apiKey: 'bk_secret', mask: combined});
   * ```
   */
  static combineMasks(
    ...maskFunctions: Array<(data: unknown) => unknown>
  ): (data: unknown) => unknown {
    return (data: unknown): unknown => {
      let result = data;
      for (const maskFn of maskFunctions) {
        result = maskFn(result);
      }
      return result;
    };
  }

  /**
   * Create a custom regex-based masking function.
   *
   * @param pattern - Regular expression pattern to match
   * @param replacement - Replacement string for matches
   * @param flags - Optional regex flags (e.g., 'gi' for global case-insensitive)
   * @returns A masking function for the custom pattern
   *
   * @example
   * ```typescript
   * // Mask IPv4 addresses
   * const maskIP = MaskingHelper.customPatternMask(
   *   /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
   *   '[IP_ADDRESS]'
   * );
   * maskIP("Server: 192.168.1.1")
   * // Returns: "Server: [IP_ADDRESS]"
   * ```
   */
  static customPatternMask(
    pattern: RegExp,
    replacement: string
  ): (data: unknown) => unknown {
    return (data: unknown): unknown => {
      return MaskingHelper.recursiveMask(data, (s) => s.replace(pattern, replacement));
    };
  }

  // ========== Internal Helpers ==========

  /**
   * Apply all PII patterns to a string.
   * @internal
   */
  private static applyAllPatterns(text: string): string {
    // Apply patterns in order of specificity (most to least specific)
    let masked = text;
    masked = masked.replace(MaskingHelper.SSN_PATTERN, MaskingHelper.SSN_REPLACEMENT);
    masked = masked.replace(
      MaskingHelper.CREDIT_CARD_PATTERN,
      MaskingHelper.CREDIT_CARD_REPLACEMENT
    );
    masked = masked.replace(MaskingHelper.API_KEY_PATTERN, MaskingHelper.API_KEY_REPLACEMENT);
    masked = masked.replace(MaskingHelper.EMAIL_PATTERN, MaskingHelper.EMAIL_REPLACEMENT);
    masked = masked.replace(MaskingHelper.PHONE_PATTERN, MaskingHelper.PHONE_REPLACEMENT);
    return masked;
  }

  /**
   * Recursively apply a string masking function to nested data structures.
   *
   * Preserves structure and handles objects, arrays, strings, and primitives.
   *
   * @param data - The data to mask
   * @param maskFn - Function that masks strings
   * @returns Masked data with same structure as input
   */
  static recursiveMask(data: unknown, maskFn: (s: string) => string): unknown {
    if (typeof data === 'string') {
      return maskFn(data);
    } else if (typeof data === 'object' && data !== null) {
      if (Array.isArray(data)) {
        return data.map((item) => MaskingHelper.recursiveMask(item, maskFn));
      } else {
        return Object.fromEntries(
          Object.entries(data).map(([key, value]) => [
            key,
            MaskingHelper.recursiveMask(value, maskFn),
          ])
        );
      }
    } else {
      // Return primitives (number, boolean, null, undefined) unchanged
      return data;
    }
  }
}
