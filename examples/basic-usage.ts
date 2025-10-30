/**
 * Basic Brokle SDK Usage Example
 *
 * Demonstrates:
 * - SDK initialization
 * - Simple tracing with traced()
 * - LLM generation tracing
 * - Decorators
 * - Attribute setting
 */

import { getClient, observe, Attrs, LLMProvider } from 'brokle';

// ========== 1. Initialize SDK ==========

const client = getClient({
  apiKey: process.env.BROKLE_API_KEY || 'bk_test_key_1234567890123456789012345678901234567890',
  baseUrl: process.env.BROKLE_BASE_URL || 'http://localhost:8080',
  environment: 'development',
  debug: true,
});

// ========== 2. Simple Tracing Pattern ==========

async function simpleTracedOperation() {
  console.log('\n=== Simple Traced Operation ===');

  const result = await client.traced('simple-operation', async (span) => {
    // Set custom attributes
    span.setAttribute('operation.type', 'demo');
    span.setAttribute(Attrs.USER_ID, 'user-123');
    span.setAttribute(Attrs.SESSION_ID, 'session-456');

    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 100));

    return { success: true, value: 42 };
  });

  console.log('Result:', result);
}

// ========== 3. Nested Spans ==========

async function nestedSpans() {
  console.log('\n=== Nested Spans ===');

  await client.traced('parent-operation', async (parentSpan) => {
    parentSpan.setAttribute('level', 'parent');

    // First child operation
    await client.traced('child-operation-1', async (childSpan) => {
      childSpan.setAttribute('level', 'child');
      childSpan.setAttribute('child.id', 1);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Second child operation
    await client.traced('child-operation-2', async (childSpan) => {
      childSpan.setAttribute('level', 'child');
      childSpan.setAttribute('child.id', 2);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  });

  console.log('Nested spans completed');
}

// ========== 4. LLM Generation Tracing (Simulated) ==========

async function llmGenerationExample() {
  console.log('\n=== LLM Generation Tracing ===');

  const response = await client.generation('chat', 'gpt-4', 'openai', async (span) => {
    // Simulate LLM API call
    const startTime = Date.now();

    // Set request attributes
    span.setAttribute(Attrs.GEN_AI_REQUEST_MODEL, 'gpt-4');
    span.setAttribute(Attrs.GEN_AI_REQUEST_TEMPERATURE, 0.7);
    span.setAttribute(Attrs.GEN_AI_REQUEST_MAX_TOKENS, 100);

    const inputMessages = [
      { role: 'user', content: 'What is the capital of France?' },
    ];
    span.setAttribute(Attrs.GEN_AI_INPUT_MESSAGES, JSON.stringify(inputMessages));

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Simulate response
    const outputMessages = [
      { role: 'assistant', content: 'The capital of France is Paris.' },
    ];

    // Set response attributes
    span.setAttribute(Attrs.GEN_AI_OUTPUT_MESSAGES, JSON.stringify(outputMessages));
    span.setAttribute(Attrs.GEN_AI_RESPONSE_ID, 'chatcmpl-123');
    span.setAttribute(Attrs.GEN_AI_RESPONSE_MODEL, 'gpt-4-0613');
    span.setAttribute(Attrs.GEN_AI_USAGE_INPUT_TOKENS, 15);
    span.setAttribute(Attrs.GEN_AI_USAGE_OUTPUT_TOKENS, 8);
    span.setAttribute(Attrs.BROKLE_USAGE_TOTAL_TOKENS, 23);

    const latency = Date.now() - startTime;
    span.setAttribute(Attrs.BROKLE_USAGE_LATENCY_MS, latency);

    return {
      content: 'The capital of France is Paris.',
      usage: { input: 15, output: 8, total: 23 },
    };
  });

  console.log('LLM Response:', response);
}

// ========== 5. Using Decorators ==========

class AIService {
  @observe({ name: 'analyze-text', asType: 'span', captureInput: true, captureOutput: true })
  async analyzeText(text: string): Promise<{ sentiment: string; score: number }> {
    console.log('\n=== Decorator Example ===');

    // Simulate text analysis
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      sentiment: 'positive',
      score: 0.85,
    };
  }

  @observe({
    name: 'summarize',
    asType: 'generation',
    tags: ['ai', 'summarization'],
    userId: 'user-123',
  })
  async summarize(text: string): Promise<string> {
    // Simulate summarization
    await new Promise((resolve) => setTimeout(resolve, 150));

    return `Summary of: ${text.substring(0, 50)}...`;
  }
}

async function decoratorExample() {
  const service = new AIService();

  // Analyze text
  const analysis = await service.analyzeText('This is a wonderful product! I love it.');
  console.log('Analysis:', analysis);

  // Summarize text
  const summary = await service.summarize('This is a long text that needs to be summarized...');
  console.log('Summary:', summary);
}

// ========== 6. Error Handling ==========

async function errorHandling() {
  console.log('\n=== Error Handling ===');

  try {
    await client.traced('operation-with-error', async (span) => {
      span.setAttribute('will.fail', true);

      // Simulate error
      throw new Error('Something went wrong!');
    });
  } catch (error) {
    console.log('Caught error (as expected):', (error as Error).message);
    console.log('Error was recorded in span ✓');
  }
}

// ========== 7. Custom Metadata ==========

async function customMetadata() {
  console.log('\n=== Custom Metadata ===');

  await client.traced('custom-metadata-example', async (span) => {
    // Set filterable metadata
    span.setAttribute(Attrs.USER_ID, 'user-789');
    span.setAttribute(Attrs.SESSION_ID, 'session-xyz');

    // Set tags
    span.setAttribute(Attrs.TAGS, JSON.stringify(['production', 'critical', 'ai']));

    // Set custom metadata
    const metadata = {
      tenant: 'acme-corp',
      region: 'us-east-1',
      version: '1.2.3',
    };
    span.setAttribute(Attrs.METADATA, JSON.stringify(metadata));

    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  console.log('Custom metadata added to span');
}

// ========== Main Execution ==========

async function main() {
  console.log('Starting Brokle SDK Basic Usage Examples...\n');

  try {
    // Run all examples
    await simpleTracedOperation();
    await nestedSpans();
    await llmGenerationExample();
    await decoratorExample();
    await errorHandling();
    await customMetadata();

    // Flush all pending spans
    console.log('\n=== Flushing Spans ===');
    await client.flush();
    console.log('All spans flushed to backend ✓');

    console.log('\n✅ All examples completed successfully!');
  } catch (error) {
    console.error('Error running examples:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('\nExiting...');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { main };