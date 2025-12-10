/**
 * Basic PII Masking Example for Brokle TypeScript/JavaScript SDK
 *
 * This example demonstrates how to implement custom masking logic to protect
 * sensitive information before it's sent to Brokle.
 *
 * Key concepts:
 * - Client-side masking (before transmission)
 * - Custom masking functions
 * - Recursive masking for nested data
 * - Error-safe design
 */

import { Brokle } from 'brokle';

/**
 * Mask email addresses in any data structure.
 * Supports strings, objects, arrays, and nested combinations.
 */
const maskEmails = (data: unknown): unknown => {
  if (typeof data === 'string') {
    // Replace email addresses with [EMAIL]
    return data.replace(/\b[\w.]+@[\w.]+\b/g, '[EMAIL]');
  } else if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data)) {
      // Recursively mask array items
      return data.map(maskEmails);
    } else {
      // Recursively mask object values
      return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, maskEmails(v)]));
    }
  } else {
    // Return primitives unchanged
    return data;
  }
};

/**
 * Mask multiple PII patterns comprehensively.
 * Masks: emails, phone numbers, SSN
 */
const maskPIIComprehensive = (data: unknown): unknown => {
  if (typeof data === 'string') {
    // Apply multiple regex patterns
    let masked = data;
    masked = masked.replace(/\b[\w.]+@[\w.]+\b/g, '[EMAIL]');
    masked = masked.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');
    masked = masked.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');
    return masked;
  } else if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data)) {
      return data.map(maskPIIComprehensive);
    } else {
      return Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, maskPIIComprehensive(v)])
      );
    }
  } else {
    return data;
  }
};

async function example1EmailMasking() {
  console.log('Example 1: Email Masking');
  console.log('-'.repeat(50));

  const client = new Brokle({
    apiKey: 'bk_your_api_key',
    mask: maskEmails,
  });

  await client.traced('process-user-request', async (span) => {
    // This input contains PII
    const userInput = 'Please contact john@example.com for more information';

    span.setAttribute('input.value', userInput);

    // Simulate processing
    const response = `Email sent to ${userInput.split(' ')[2]}`;
    span.setAttribute('output.value', response);
  });

  console.log('✓ Span created with masked email addresses\n');
  await client.shutdown();
}

async function example2ComprehensivePII() {
  console.log('Example 2: Comprehensive PII Masking');
  console.log('-'.repeat(50));

  const client = new Brokle({
    apiKey: 'bk_your_api_key',
    mask: maskPIIComprehensive,
  });

  await client.traced('process-contact', async (span) => {
    const contactInfo = {
      email: 'admin@company.com',
      phone: '555-123-4567',
      ssn: '123-45-6789',
      name: 'John Doe', // This won't be masked (not a pattern)
    };

    span.setAttribute('metadata', contactInfo);
  });

  console.log('✓ Span created with all PII patterns masked\n');
  await client.shutdown();
}

async function example3NestedStructure() {
  console.log('Example 3: Nested Structure Masking');
  console.log('-'.repeat(50));

  const client = new Brokle({
    apiKey: 'bk_your_api_key',
    mask: maskPIIComprehensive,
  });

  const nestedData = {
    users: [
      { email: 'user1@example.com', role: 'admin' },
      { email: 'user2@example.com', role: 'user' },
    ],
    admin: {
      contact: {
        email: 'admin@example.com',
        phone: '555-987-6543',
      },
    },
  };

  await client.traced('process-users', async (span) => {
    span.setAttribute('input.value', nestedData);
  });

  console.log('✓ Nested structure masked while preserving structure\n');
  await client.shutdown();
}

async function main() {
  console.log('='.repeat(50));
  console.log('Brokle Masking Examples');
  console.log('='.repeat(50));
  console.log();

  await example1EmailMasking();
  await example2ComprehensivePII();
  await example3NestedStructure();

  console.log('='.repeat(50));
  console.log('All examples completed!');
  console.log('='.repeat(50));
}

main().catch(console.error);
