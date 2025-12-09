/**
 * Robust JSON serializer for arbitrary JavaScript/TypeScript objects.
 *
 * Handles common types with sensible fallbacks:
 * - Primitives (string, number, boolean, null, undefined)
 * - Date objects -> ISO format
 * - Arrays and objects (recursive)
 * - Circular references
 * - BigInt -> string
 * - Error objects
 * - Map and Set
 * - Typed arrays (Uint8Array, etc.)
 * - Custom objects with toJSON method
 * - Functions -> "<function>"
 * - Symbols -> "<symbol>"
 */

const MAX_DEPTH = 50;

/**
 * Serialize a value to a JSON-safe representation.
 *
 * @param value - Value to serialize
 * @param depth - Current recursion depth (internal)
 * @param seen - Set of seen object references (internal)
 * @returns JSON-serializable value
 */
export function serializeValue(
  value: unknown,
  depth: number = 0,
  seen: WeakSet<object> = new WeakSet()
): unknown {
  if (depth > MAX_DEPTH) {
    return '<max depth exceeded>';
  }

  if (value === null) {
    return null;
  }
  if (value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'NaN';
    if (!Number.isFinite(value)) return value > 0 ? 'Infinity' : '-Infinity';
    return value;
  }
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'symbol') {
    return `<symbol:${value.description || 'anonymous'}>`;
  }

  if (typeof value === 'function') {
    return `<function:${value.name || 'anonymous'}>`;
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '<circular reference>';
    }
    seen.add(value);

    try {
      if (value instanceof Date) {
        return value.toISOString();
      }

      if (value instanceof Error) {
        return {
          type: value.constructor.name,
          message: value.message,
          stack: value.stack,
        };
      }

      if (value instanceof RegExp) {
        return value.toString();
      }

      if (value instanceof Map) {
        const obj: Record<string, unknown> = {};
        for (const [k, v] of value) {
          obj[String(k)] = serializeValue(v, depth + 1, seen);
        }
        return obj;
      }

      if (value instanceof Set) {
        return Array.from(value).map((v) => serializeValue(v, depth + 1, seen));
      }

      if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
        return Array.from(value as unknown as number[]);
      }

      if (value instanceof ArrayBuffer) {
        return `<ArrayBuffer:${value.byteLength}>`;
      }

      if ('toJSON' in value && typeof (value as { toJSON: () => unknown }).toJSON === 'function') {
        return serializeValue((value as { toJSON: () => unknown }).toJSON(), depth + 1, seen);
      }

      if (Array.isArray(value)) {
        return value.map((item) => serializeValue(item, depth + 1, seen));
      }

      const result: Record<string, unknown> = {};
      for (const key of Object.keys(value)) {
        result[key] = serializeValue((value as Record<string, unknown>)[key], depth + 1, seen);
      }
      return result;
    } finally {
      seen.delete(value);
    }
  }

  return `<unknown:${typeof value}>`;
}

/**
 * Serialize a value to JSON string.
 *
 * @param value - Value to serialize
 * @returns JSON string or null if serialization fails
 */
export function serialize(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    const serialized = serializeValue(value);
    return JSON.stringify(serialized);
  } catch (error) {
    const err = error as Error;
    return `<serialization failed: ${err.message}>`;
  }
}

/**
 * Serialize value with MIME type detection.
 *
 * Handles edge cases: null, objects, arrays, strings, etc.
 *
 * @param value - Value to serialize
 * @returns Tuple of [serialized string, MIME type]
 */
export function serializeWithMime(value: unknown): [string, string] {
  try {
    if (value === null || value === undefined) {
      return ['null', 'application/json'];
    }

    if (typeof value === 'string') {
      return [value, 'text/plain'];
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return [String(value), 'text/plain'];
    }

    if (typeof value === 'bigint') {
      return [value.toString(), 'text/plain'];
    }

    if (typeof value === 'object') {
      const serialized = serializeValue(value);
      return [JSON.stringify(serialized), 'application/json'];
    }

    return [String(value), 'text/plain'];
  } catch (error) {
    const err = error as Error;
    return [`<serialization failed: ${err.message}>`, 'text/plain'];
  }
}

/**
 * Check if data is in ChatML messages format.
 *
 * ChatML format: Array of objects with 'role' property.
 *
 * @param data - Data to check
 * @returns True if data is ChatML format
 */
export function isChatMLFormat(data: unknown): boolean {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    data.every((msg) => typeof msg === 'object' && msg !== null && 'role' in msg)
  );
}

/**
 * Serialize function arguments for tracing.
 *
 * @param args - Positional arguments array
 * @param paramNames - Optional parameter names
 * @returns Serialized arguments object
 */
export function serializeFunctionArgs(
  args: unknown[],
  paramNames?: string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (let i = 0; i < args.length; i++) {
    const paramName = paramNames?.[i];
    const key = paramName ? paramName : `arg_${i}`;
    result[key] = serializeValue(args[i]);
  }

  return result;
}
