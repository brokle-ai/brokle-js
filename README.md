# Brokle SDK for TypeScript/JavaScript

OpenTelemetry-native observability SDK for AI applications. Track, monitor, and optimize your LLM applications with industry-standard OTLP traces.

## ⚡ Quick Start: Evaluation

Run evaluations with a single function call (similar to Braintrust/LangSmith):

```typescript
import { evaluate, ExactMatch, Contains } from 'brokle';

// Define your task
async function myLLMTask(item: { input: string }) {
  // Your LLM call here
  return { output: `Response to: ${item.input}` };
}

// Run evaluation
const results = await evaluate({
  task: myLLMTask,
  data: [
    { input: 'Hello', expected: 'Response to: Hello' },
    { input: 'World', expected: 'Response to: World' },
  ],
  evaluators: [new ExactMatch(), new Contains({ substring: 'Response' })],
  experimentName: 'my-first-eval',
});

console.log(`Experiment: ${results.experimentName}`);
console.log(`View at: ${results.url}`);
```

## Features

- ✅ **OTEL-Native**: Built on OpenTelemetry SDK (industry standard)
- ✅ **GenAI 1.28+ Compliant**: Full support for OTEL GenAI semantic conventions
- ✅ **Trace-Level Sampling**: Deterministic sampling (no partial traces)
- ✅ **Type-Safe**: Complete TypeScript type definitions
- ✅ **Zero Config**: Works out of the box with environment variables
- ✅ **Gzip Compression**: Automatic bandwidth optimization
- ✅ **Dual Build**: ESM + CJS support
- ✅ **Enhanced Errors**: Actionable error messages with fix hints
- ✅ **Graceful Degradation**: Tracer errors never break your app

## Installation

```bash
npm install brokle @opentelemetry/api
# or
pnpm add brokle @opentelemetry/api
# or
yarn add brokle @opentelemetry/api
```

## Quick Start

### 1. Initialize the SDK

```typescript
import { getClient } from 'brokle';

// Option 1: From environment variables
// Set BROKLE_API_KEY=bk_... in your environment
const client = getClient();

// Option 2: Direct configuration
const client = getClient({
  apiKey: 'bk_...',
  baseUrl: 'https://api.brokle.ai',
  environment: 'production',
});
```

### 2. Trace Your Code

#### Using Decorators (Recommended)

```typescript
import { observe } from 'brokle';

class AIService {
  @observe({ name: 'chat-completion', asType: 'generation' })
  async chat(prompt: string): Promise<string> {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    });
    return response.choices[0].message.content;
  }
}
```

#### Using Traced Function

```typescript
import { getClient, Attrs } from 'brokle';

const client = getClient();

await client.traced('my-operation', async (span) => {
  span.setAttribute(Attrs.USER_ID, 'user-123');
  span.setAttribute('custom-attr', 'value');

  const result = await doWork();

  return result;
});
```

#### Using Generation Helper

```typescript
import { getClient, Attrs } from 'brokle';

const client = getClient();

const response = await client.generation('chat', 'gpt-4', 'openai', async (span) => {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello' }],
  });

  // Capture GenAI attributes
  span.setAttribute(Attrs.GEN_AI_INPUT_MESSAGES, JSON.stringify([...]));
  span.setAttribute(Attrs.GEN_AI_OUTPUT_MESSAGES, JSON.stringify([...]));
  span.setAttribute(Attrs.GEN_AI_USAGE_INPUT_TOKENS, completion.usage.prompt_tokens);
  span.setAttribute(Attrs.GEN_AI_USAGE_OUTPUT_TOKENS, completion.usage.completion_tokens);

  return completion;
});
```

## Configuration

### Environment Variables

```bash
# Required
BROKLE_API_KEY=bk_your_api_key_here

# Optional
BROKLE_BASE_URL=https://api.brokle.ai  # Default: http://localhost:8080
BROKLE_ENVIRONMENT=production           # Default: default
BROKLE_DEBUG=true                       # Default: false
BROKLE_SAMPLE_RATE=0.5                  # Default: 1.0 (0.0-1.0)
BROKLE_FLUSH_SYNC=true                  # Default: false (use for serverless)
BROKLE_FLUSH_AT=100                     # Default: 100 (batch size)
BROKLE_FLUSH_INTERVAL=10                # Default: 10 seconds
```

### Programmatic Configuration

```typescript
import { getClient } from 'brokle';

const client = getClient({
  apiKey: 'bk_...',
  baseUrl: 'https://api.brokle.ai',
  environment: 'production',
  debug: false,
  sampleRate: 1.0,           // Trace-level sampling
  flushSync: false,          // Set true for serverless
  flushAt: 100,             // Batch size
  flushInterval: 10,        // Flush interval (seconds)
  maxQueueSize: 10000,      // Max queue size
  timeout: 30000,           // Request timeout (ms)
});
```

## Prompt Management

Brokle provides centralized prompt storage with versioning, labels, and caching.

```typescript
import { getClient } from 'brokle';

const client = getClient();

// Fetch a prompt
const prompt = await client.prompts.get("greeting", {
  label: "production"
});

// Compile with variables
const compiled = prompt.compile({ name: "Alice" });

// Convert to OpenAI format
const messages = prompt.toOpenAIMessages({ name: "Alice" });

// Convert to Anthropic format
const anthropicRequest = prompt.toAnthropicRequest({ name: "Alice" });

// List all prompts
const { data, pagination } = await client.prompts.list({
  type: "chat",
  limit: 10
});

data.forEach(p => {
  console.log(`${p.name} v${p.version} (${p.type})`);
});

// Cache management
client.prompts.invalidate("greeting");  // Invalidate specific prompt
client.prompts.clearCache();            // Clear all cached prompts
const stats = client.prompts.getCacheStats();  // Get cache stats
```

## Advanced Usage

### Manual Span Control

```typescript
import { getClient } from 'brokle';

const client = getClient();
const tracer = client.getTracer();

// Start a manual span
const span = tracer.startSpan('my-span', {
  attributes: {
    'custom.attribute': 'value',
  },
});

try {
  // Do work
  await doWork();

  // Set success status
  span.setStatus({ code: SpanStatusCode.OK });
} catch (error) {
  // Record exception
  span.recordException(error);
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error.message,
  });
  throw error;
} finally {
  // Always end the span
  span.end();
}
```

### Trace Function Wrapper

```typescript
import { traceFunction, Attrs } from 'brokle';

const tracedProcess = traceFunction(
  'process-data',
  async (data: any) => {
    return processData(data);
  },
  {
    captureInput: true,
    captureOutput: true,
    tags: ['critical', 'production'],
    userId: 'user-123',
  }
);

// Use it
const result = await tracedProcess(myData);
```

### Serverless/Lambda Setup

```typescript
import { getClient } from 'brokle';

// Initialize once (outside handler)
const client = getClient({
  flushSync: true,  // Use SimpleSpanProcessor for immediate export
});

export const handler = async (event: any) => {
  await client.traced('lambda-handler', async (span) => {
    span.setAttribute('event.type', event.type);

    const result = await processEvent(event);

    return result;
  });

  // Force flush before exit
  await client.flush();

  return { statusCode: 200 };
};
```

### Long-Running Application Shutdown

```typescript
import { getClient } from 'brokle';

const client = getClient();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await client.shutdown();
  process.exit(0);
});
```

## Type-Safe Attributes

Use the `Attrs` constant for type-safe attribute keys:

```typescript
import { Attrs, LLMProvider } from 'brokle';

span.setAttribute(Attrs.GEN_AI_PROVIDER_NAME, LLMProvider.OPENAI);
span.setAttribute(Attrs.GEN_AI_REQUEST_MODEL, 'gpt-4');
span.setAttribute(Attrs.GEN_AI_OPERATION_NAME, 'chat');
span.setAttribute(Attrs.USER_ID, 'user-123');
span.setAttribute(Attrs.SESSION_ID, 'session-456');
span.setAttribute(Attrs.TAGS, JSON.stringify(['production', 'critical']));
```

## Integration Packages

For automatic tracing of popular SDKs:

- `brokle-openai` - OpenAI SDK wrapper (Proxy-based, zero code changes)
- `brokle-anthropic` - Anthropic SDK wrapper
- `brokle-langchain` - LangChain.js callbacks

## Examples

See the [examples](../../examples) directory for complete working examples:

- `basic-usage.ts` - Simple tracing patterns
- `wrapper-usage.ts` - SDK wrappers (OpenAI, Anthropic)
- `langchain-integration.ts` - LangChain.js integration
- `nextjs-app/` - Next.js application example

## Architecture

### OTEL-Native Design

```
TypeScript SDK → OpenTelemetry SDK → OTLP/HTTP → Brokle Backend
                 (Industry Standard)  (Protobuf+Gzip)
```

### Key Components

- **BrokleClient**: Main SDK class with TracerProvider
- **BrokleSpanProcessor**: Wrapper around BatchSpanProcessor/SimpleSpanProcessor
- **BrokleExporter**: OTLP exporter with Gzip compression and API key auth
- **Symbol Singleton**: Global state management

### Trace-Level Sampling

Uses `TraceIdRatioBasedSampler` for deterministic sampling:
- Entire traces sampled together (no partial traces)
- Sampling decision based on trace ID
- Consistent across distributed systems

## Requirements

- Node.js >= 20.0.0
- TypeScript >= 5.0 (for decorators)

## License

MIT

## 🔧 Enhanced Error Messages

Errors include actionable guidance:

```typescript
import { AuthenticationError, ConnectionError, ValidationError } from 'brokle';

try {
  const client = getClient();
} catch (e) {
  if (e instanceof AuthenticationError) {
    console.log(e.hint);  // Shows how to fix authentication issues
  } else if (e instanceof ConnectionError) {
    console.log(e.hint);  // Shows how to fix connection issues
  } else if (e instanceof ValidationError) {
    console.log(e.hint);  // Shows how to fix validation issues
  }
}
```

Available error classes (following Langfuse naming pattern):
- `BrokleError` - Base error class
- `AuthenticationError` - API key invalid/missing
- `ConnectionError` - Server unreachable
- `ValidationError` - Invalid request data
- `RateLimitError` - Too many requests
- `NotFoundError` - Resource not found
- `ServerError` - Server-side error

## 📦 Migration from Other SDKs

### From Braintrust

```typescript
// Braintrust
import { Eval } from 'braintrust';
Eval('my-project', { data: dataset, task: fn, scores: [score] });

// Brokle
import { evaluate } from 'brokle';
await evaluate({ task: fn, data: dataset, evaluators: [scorer], experimentName: 'my-project' });
```

### From LangSmith

```typescript
// LangSmith
import { traceable } from 'langsmith';
const myFunction = traceable(async () => { /* ... */ });

// Brokle
import { observe } from 'brokle';
class MyService {
  @observe()
  async myFunction() { /* ... */ }
}
```

### From Langfuse

```typescript
// Langfuse
import { observeOpenAI } from 'langfuse';
const client = observeOpenAI(new OpenAI());

// Brokle
import { wrapOpenAI } from 'brokle/openai';
const client = wrapOpenAI(new OpenAI());
```

## Support

- Documentation: https://docs.brokle.ai
- GitHub: https://github.com/brokle-ai/brokle-js
- Issues: https://github.com/brokle-ai/brokle-js/issues