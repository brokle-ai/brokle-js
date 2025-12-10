/**
 * MaskingHelper Utilities Example for Brokle TypeScript/JavaScript SDK
 *
 * This example demonstrates how to use the built-in MaskingHelper utilities
 * for common PII patterns without writing custom regex logic.
 *
 * Key concepts:
 * - Pre-built PII maskers
 * - Field-based masking
 * - Combining multiple maskers
 * - Custom pattern creation
 */

import { Brokle } from 'brokle';
import { MaskingHelper } from 'brokle/utils/masking';

async function example1AllPII() {
  console.log('Example 1: All-in-One PII Masker');
  console.log('-'.repeat(50));

  const client = new Brokle({
    apiKey: 'bk_your_api_key',
    mask: MaskingHelper.maskPII, // Masks emails, phones, SSN, cards, API keys
  });

  await client.traced('process-sensitive-data', async (span) => {
    // All these PII types will be automatically masked
    const sensitiveData = `
      Contact: john@example.com
      Phone: 555-123-4567
      SSN: 123-45-6789
      Card: 1234-5678-9012-3456
      API Key: sk_test_1234567890abcdefghij1234567890
    `;

    span.setAttribute('input.value', sensitiveData);
  });

  console.log('✓ All PII patterns automatically masked\n');
  await client.shutdown();
}

async function example2SpecificPII() {
  console.log('Example 2: Specific PII Maskers');
  console.log('-'.repeat(50));

  // Email masking only
  const clientEmails = new Brokle({
    apiKey: 'bk_your_api_key',
    mask: MaskingHelper.maskEmails,
  });

  await clientEmails.traced('email-only', async (span) => {
    span.setAttribute('input.value', 'Contact john@example.com or call 555-123-4567');
    // Result: "Contact [EMAIL] or call 555-123-4567"
  });

  console.log('✓ Email-only masking applied');

  // Phone masking only
  const clientPhones = new Brokle({
    apiKey: 'bk_your_api_key',
    mask: MaskingHelper.maskPhones,
  });

  await clientPhones.traced('phone-only', async (span) => {
    span.setAttribute('input.value', 'Email: admin@company.com, Phone: 555-987-6543');
    // Result: "Email: admin@company.com, Phone: [PHONE]"
  });

  console.log('✓ Phone-only masking applied\n');

  await clientEmails.shutdown();
  await clientPhones.shutdown();
}

async function example3FieldBased() {
  console.log('Example 3: Field-Based Masking');
  console.log('-'.repeat(50));

  // Mask by field name
  const client = new Brokle({
    apiKey: 'bk_your_api_key',
    mask: MaskingHelper.fieldMask(['password', 'ssn', 'api_key', 'secret_token']),
  });

  await client.traced('process-credentials', async (span) => {
    const credentials = {
      username: 'john_doe', // Not masked
      password: 'super_secret_123', // Masked
      email: 'john@example.com', // Not masked (use maskEmails for this)
      api_key: 'sk_1234567890', // Masked
      created_at: '2024-01-01', // Not masked
    };

    span.setAttribute('metadata', credentials);
  });

  console.log('✓ Field-based masking applied to specific keys\n');
  await client.shutdown();
}

async function example4Combined() {
  console.log('Example 4: Combined Masking Strategies');
  console.log('-'.repeat(50));

  // Combine pattern-based + field-based masking
  const combinedMask = MaskingHelper.combineMasks(
    MaskingHelper.maskEmails, // Mask all emails
    MaskingHelper.maskPhones, // Mask all phones
    MaskingHelper.fieldMask(['password', 'secret']) // Mask specific fields
  );

  const client = new Brokle({
    apiKey: 'bk_your_api_key',
    mask: combinedMask,
  });

  await client.traced('multi-strategy', async (span) => {
    const data = {
      contact: 'john@example.com or 555-123-4567', // Email & phone masked
      password: 'my_secret', // Field masked
      public_info: 'Not sensitive', // Not masked
    };

    span.setAttribute('metadata', data);
  });

  console.log('✓ Multiple masking strategies combined successfully\n');
  await client.shutdown();
}

async function example5CustomPattern() {
  console.log('Example 5: Custom Pattern Masking');
  console.log('-'.repeat(50));

  // Mask IPv4 addresses
  const maskIP = MaskingHelper.customPatternMask(
    /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    '[IP_ADDRESS]'
  );

  const client = new Brokle({
    apiKey: 'bk_your_api_key',
    mask: maskIP,
  });

  await client.traced('server-logs', async (span) => {
    const logMessage = 'Request from 192.168.1.1 to server 10.0.0.5';
    span.setAttribute('input.value', logMessage);
    // Result: "Request from [IP_ADDRESS] to server [IP_ADDRESS]"
  });

  console.log('✓ Custom IPv4 masking pattern applied\n');
  await client.shutdown();
}

async function example6RealWorld() {
  console.log('Example 6: Real-World LLM Example');
  console.log('-'.repeat(50));

  // Combine all necessary PII protection
  const mask = MaskingHelper.combineMasks(
    MaskingHelper.maskPII, // All common PII
    MaskingHelper.fieldMask(['api_key', 'secret', 'token']) // Sensitive fields
  );

  const client = new Brokle({
    apiKey: 'bk_your_api_key',
    mask: mask,
  });

  // Simulate LLM generation with sensitive user data
  await client.generation(
    'customer-support-response',
    'gpt-4',
    'openai',
    async (span) => {
      span.setAttribute(
        'gen_ai.input.messages',
        'User email: support@customer.com wants help with account 123-45-6789'
      );

      // Simulated LLM response
      const output = "I'll help you with that. Please verify at support@customer.com";
      span.setAttribute('gen_ai.output.messages', output);

      span.setAttribute('gen_ai.usage.input_tokens', 25);
      span.setAttribute('gen_ai.usage.output_tokens', 15);
    }
  );

  console.log('✓ LLM generation with full PII protection\n');
  await client.shutdown();
}

async function main() {
  console.log('='.repeat(50));
  console.log('Brokle Masking Examples');
  console.log('='.repeat(50));
  console.log();

  await example1AllPII();
  await example2SpecificPII();
  await example3FieldBased();
  await example4Combined();
  await example5CustomPattern();
  await example6RealWorld();

  console.log('='.repeat(50));
  console.log('All examples completed!');
  console.log('='.repeat(50));
}

main().catch(console.error);
