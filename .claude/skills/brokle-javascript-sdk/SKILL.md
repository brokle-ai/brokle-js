---
name: brokle-javascript-sdk
description: Use this skill when developing, debugging, or implementing features for the Brokle JavaScript/TypeScript SDK. This includes OTEL-native tracing, traced() callback helpers, @observe decorator, BrokleClient usage, Symbol.for() singleton, flushSync configuration, OpenAI/Anthropic wrappers (Proxy pattern), LangChain integration, or working with the TypeScript SDK monorepo. Triggers: JavaScript SDK, TypeScript SDK, brokle-js, OTLP, GenAI attributes, traced(), Symbol.for(), monorepo.
---

# Brokle JavaScript/TypeScript SDK Development Skill

Comprehensive guidance for developing the Brokle JavaScript/TypeScript SDK - an OTEL-native observability SDK for AI applications.

## Overview

The Brokle JavaScript SDK is built on **@opentelemetry/sdk-node** with full GenAI 1.28+ semantic conventions compliance. It's a **single package with sub-path exports** providing multiple integration patterns.

**Architecture**: OTEL-native with TracerProvider → BrokleSpanProcessor → OTLP/HTTP Exporter (Protobuf+Gzip)

## Single Package Structure with Sub-Path Exports

```
sdk/javascript/
├── src/
│   ├── index.ts               # Main exports (brokle)
│   ├── client.ts              # Brokle client
│   ├── config.ts              # Configuration
│   ├── integrations/
│   │   ├── openai/            # brokle/openai
│   │   ├── anthropic/         # brokle/anthropic
│   │   └── langchain/         # brokle/langchain
│   └── scorers/               # brokle/scorers
├── dist/                      # Build output
├── examples/
│   ├── basic-usage.ts
│   ├── wrapper-usage.ts
│   └── langchain-integration.ts
└── tests/
```

**Usage**: Tree-shakeable sub-path imports - users only import what they need.

## Public API Surface

### Core Package (`brokle`)
```typescript
// Core client
export { Brokle, getClient, resetClient } from './client';

// Configuration
export type { BrokleConfig, BrokleConfigInput } from './types/config';
export { loadFromEnv, validateConfig } from './config';

// Decorators
export { observe, traceFunction } from './decorators';
export type { ObserveOptions } from './decorators';

// Type-safe attributes
export {
  Attrs,
  BrokleOtelSpanAttributes,
  SpanType,
  LLMProvider,
  OperationType,
} from './types/attributes';

// Advanced use cases
export { createBrokleExporter } from './exporter';
export { BrokleSpanProcessor } from './processor';
```

### OpenAI Wrapper (`brokle/openai`)
```typescript
import { wrapOpenAI } from 'brokle/openai';
```

### Anthropic Wrapper (`brokle/anthropic`)
```typescript
import { wrapAnthropic } from 'brokle/anthropic';
```

### LangChain Integration (`brokle/langchain`)
```typescript
import { BrokleLangChainCallback } from 'brokle/langchain';
```

## OTEL-Native Architecture

### Architecture Flow
```
User Code
  ↓
traced() / @observe / wrappers
  ↓
NodeTracerProvider (TraceIdRatioBasedSampler)
  ↓
BrokleSpanProcessor (wrapper pattern)
  ├→ BatchSpanProcessor (long-running apps)
  └→ SimpleSpanProcessor (serverless/Lambda)
  ↓
OTLPTraceExporter (Protobuf + Gzip)
  ↓
HTTP POST /v1/traces (OTLP standard)
  ↓
Brokle Backend
```

### Key Components

**TracerProvider Setup**:
- Resource with service name (respects `OTEL_SERVICE_NAME`)
- TraceIdRatioBasedSampler (trace-level sampling)
- Registered globally for OTEL ecosystem compatibility

**BrokleSpanProcessor (Wrapper Pattern)**:
- Wraps `BatchSpanProcessor` OR `SimpleSpanProcessor`
- Choice based on `flushSync` configuration
- Automatic environment/release attribute injection
- Future: PII masking, attribute transformation

**OTLP/HTTP Exporter**:
- Endpoint: `{base_url}/v1/traces` (OpenTelemetry standard)
- Headers: `X-API-Key`, `X-Brokle-Environment`, `X-Brokle-Release`
- Compression: Gzip (automatic, 65% bandwidth reduction)
- Format: Protobuf

**Symbol.for() Singleton**:
- Uses `Symbol.for('brokle')` for global state
- Cross-realm safe (ESM, CJS, VM contexts)
- No automatic process exit handlers (explicit lifecycle)

## Five Integration Patterns

### Pattern 1: @observe Decorator (TypeScript 5.0+)

**Basic Usage**:
```typescript
import { observe } from 'brokle';

class AIService {
  @observe()
  async processRequest(input: string): Promise<string> {
    return `Processed: ${input}`;
  }
}
```

**Full Options**:
```typescript
class AIService {
  @observe({
    name: 'ask-llm',
    asType: 'generation',           // span, generation, event, tool
    userId: 'user-123',
    sessionId: 'session-456',
    tags: ['production', 'critical'],
    metadata: { feature: 'chat' },
    version: '1.0',                 // A/B testing support
    captureInput: true,
    captureOutput: true,
  })
  async askLLM(prompt: string): Promise<string> {
    const response = await openai.chat.completions.create({...});
    return response.choices[0].message.content;
  }
}
```

**TypeScript Requirements**:
```json
// tsconfig.json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "target": "ES2020",
    "module": "ESNext"
  }
}
```

### Pattern 2: traced() Callback Helper

**Basic Usage**:
```typescript
import { getClient } from 'brokle';

const client = getClient();

const result = await client.traced(
  'my-operation',
  async (span) => {
    span.setAttribute('custom', 'value');
    return await doWork();
  }
);
```

**With Version (A/B Testing)**:
```typescript
const result = await client.traced(
  'my-operation',
  async (span) => {
    span.setAttribute(Attrs.USER_ID, 'user-123');
    return await doWork();
  },
  undefined,  // attributes
  { version: '1.0' }  // A/B testing
);
```

### Pattern 3: generation() Helper

**LLM Generation Tracking**:
```typescript
import { getClient, Attrs } from 'brokle';

const client = getClient();

const response = await client.generation(
  'chat',
  'gpt-4',
  'openai',
  async (span) => {
    const res = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    // Add GenAI 1.28+ attributes
    span.setAttribute(Attrs.GEN_AI_OUTPUT_MESSAGES, JSON.stringify([...]));
    span.setAttribute(Attrs.GEN_AI_USAGE_INPUT_TOKENS, res.usage.prompt_tokens);
    span.setAttribute(Attrs.GEN_AI_USAGE_OUTPUT_TOKENS, res.usage.completion_tokens);

    return res;
  },
  { version: '1.0' }  // A/B testing
);
```

### Pattern 4: OpenAI Wrapper (Proxy Pattern)

**Zero-Code Integration**:
```typescript
import { wrapOpenAI } from 'brokle/openai';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const tracedOpenAI = wrapOpenAI(openai);

// All calls automatically tracked with GenAI 1.28+ attributes
const response = await tracedOpenAI.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello' }],
  temperature: 0.7,
});
```

**Wrapped Methods**:
- `openai.chat.completions.create` → Chat completions
- `openai.completions.create` → Text completions
- `openai.embeddings.create` → Embeddings

**Automatic Attribute Extraction**:
- Provider: `openai`
- Model: From request/response
- Messages: Input and output messages
- Tokens: Prompt, completion, total
- Parameters: Temperature, max_tokens, top_p, etc.

### Pattern 5: LangChain Integration

**Callback Handler**:
```typescript
import { BrokleLangChainCallback } from 'brokle/langchain';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { LLMChain } from 'langchain/chains';

const callback = new BrokleLangChainCallback();

const llm = new ChatOpenAI({ temperature: 0.7 });
const prompt = PromptTemplate.fromTemplate('Tell me about {topic}');
const chain = new LLMChain({ llm, prompt, callbacks: [callback] });

await chain.call({ topic: 'AI' });
```

**Automatic Tracking**:
- LLM calls (`handleLLMStart`, `handleLLMEnd`)
- Chain execution (`handleChainStart`, `handleChainEnd`)
- Tool usage (`handleToolStart`, `handleToolEnd`)
- Parent-child span relationships

## Configuration

### Two Configuration Patterns

**Pattern 1: Explicit Configuration**
```typescript
import { Brokle } from 'brokle';

const client = new Brokle({
  apiKey: 'bk_your_secret',
  baseUrl: 'http://localhost:8080',
  environment: 'production',
  debug: true,
  tracingEnabled: true,
  release: 'v1.2.3',
  sampleRate: 0.1,        // Sample 10% of traces
  flushSync: false,       // BatchSpanProcessor (long-running)
  flushAt: 200,           // Batch size
  flushInterval: 10,      // Seconds
  maxQueueSize: 10000,
  timeout: 30000,         // Milliseconds
});
```

**Pattern 2: Environment-Based Singleton**
```typescript
import { getClient } from 'brokle';

// Reads from BROKLE_* environment variables
const client = getClient();

// All subsequent calls return same instance
const client2 = getClient();  // Same instance
```

### Environment Variables

```bash
# Required
BROKLE_API_KEY=bk_your_secret

# Optional
BROKLE_BASE_URL=http://localhost:8080
BROKLE_ENVIRONMENT=production
BROKLE_RELEASE=v1.2.3
BROKLE_DEBUG=true
BROKLE_TRACING_ENABLED=true
BROKLE_SAMPLE_RATE=1.0              # 0.0 to 1.0
BROKLE_FLUSH_AT=100                 # Batch size
BROKLE_FLUSH_INTERVAL=10            # Seconds
BROKLE_FLUSH_SYNC=false             # true for serverless
BROKLE_MAX_QUEUE_SIZE=10000
BROKLE_TIMEOUT=30000                # Milliseconds
```

### Serverless Configuration

```typescript
const client = new Brokle({
  apiKey: process.env.BROKLE_API_KEY,
  flushSync: true,  // SimpleSpanProcessor for immediate export
});
```

### Validation Rules

**API Key**:
- Format: `bk_` + 40 alphanumeric characters (43 total)
- Example: `bk_1234567890abcdefghijklmnopqrstuvwxyz1234`

**Sample Rate**:
- Range: 0.0 to 1.0
- Checks for NaN and Infinity
- Trace-level sampling (entire traces sampled together)

## Symbol.for() Singleton Pattern

### Implementation

```typescript
const BROKLE_GLOBAL_SYMBOL = Symbol.for('brokle');

interface BrokleGlobalState {
  provider: NodeTracerProvider | null;
  client: Brokle | null;
}

function getGlobalState(): BrokleGlobalState {
  const g = globalThis as typeof globalThis & {
    [BROKLE_GLOBAL_SYMBOL]?: BrokleGlobalState;
  };

  if (!g[BROKLE_GLOBAL_SYMBOL]) {
    Object.defineProperty(g, BROKLE_GLOBAL_SYMBOL, {
      value: { provider: null, client: null },
      writable: false,
      configurable: false,
      enumerable: false,
    });
  }

  return g[BROKLE_GLOBAL_SYMBOL]!;
}

export function getClient(config?: BrokleConfigInput): Brokle {
  const state = getGlobalState();

  if (!state.client) {
    const clientConfig = config || loadFromEnv();
    state.client = new Brokle(clientConfig);
    state.provider = state.client.getProvider();
  }

  return state.client;
}
```

### Why Symbol.for()?

1. **Cross-Realm Uniqueness**: Works across ESM, CJS, VM contexts
2. **Cannot Be Overwritten**: Symbol guarantees uniqueness
3. **Global Registry**: `Symbol.for()` creates process-wide registry
4. **More Robust**: Better than `global.__brokle__` pattern

## Lifecycle Management

### No Automatic Exit Handlers

**Important**: SDK does NOT register process exit handlers to prevent memory leaks.

**Long-Running Apps (BatchSpanProcessor)**:
```typescript
const client = getClient({ flushSync: false });

// Explicit shutdown on SIGTERM
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await client.shutdown();  // Flush + cleanup
  process.exit(0);
});
```

**Serverless/Lambda (SimpleSpanProcessor)**:
```typescript
export const handler = async (event, context) => {
  const client = getClient({ flushSync: true });

  const result = await client.traced('lambda-handler', async (span) => {
    const res = await processEvent(event);
    span.setAttribute('result', res);
    return res;
  });

  // CRITICAL: Flush before exit
  await client.flush();

  return result;
};
```

### Flush vs Shutdown

**flush()**: Force export pending spans
```typescript
await client.flush();
```

**shutdown()**: Flush + cleanup resources
```typescript
await client.shutdown();
```

## GenAI 1.28+ Attributes (Type-Safe)

### Provider & Operation
```typescript
import { Attrs, LLMProvider } from 'brokle';

span.setAttribute(Attrs.GEN_AI_PROVIDER_NAME, LLMProvider.OPENAI);
span.setAttribute(Attrs.GEN_AI_OPERATION_NAME, 'chat');
```

### Request Parameters
```typescript
span.setAttribute(Attrs.GEN_AI_REQUEST_MODEL, 'gpt-4');
span.setAttribute(Attrs.GEN_AI_REQUEST_TEMPERATURE, 0.7);
span.setAttribute(Attrs.GEN_AI_REQUEST_MAX_TOKENS, 100);
span.setAttribute(Attrs.GEN_AI_REQUEST_TOP_P, 1.0);
```

### Messages (JSON Format)
```typescript
// Input messages
span.setAttribute(
  Attrs.GEN_AI_INPUT_MESSAGES,
  JSON.stringify([{ role: 'user', content: 'Hello' }])
);

// Output messages
span.setAttribute(
  Attrs.GEN_AI_OUTPUT_MESSAGES,
  JSON.stringify([{ role: 'assistant', content: 'Hi there!' }])
);
```

### Usage Metrics
```typescript
span.setAttribute(Attrs.GEN_AI_USAGE_INPUT_TOKENS, 10);
span.setAttribute(Attrs.GEN_AI_USAGE_OUTPUT_TOKENS, 20);
```

### Brokle Custom Attributes
```typescript
// Span type
span.setAttribute(Attrs.BROKLE_SPAN_TYPE, 'generation');

// A/B testing
span.setAttribute(Attrs.BROKLE_VERSION, '1.0');

// Filterable metadata
span.setAttribute(Attrs.USER_ID, 'user-123');
span.setAttribute(Attrs.SESSION_ID, 'session-456');
span.setAttribute(Attrs.TAGS, JSON.stringify(['production']));
span.setAttribute(Attrs.METADATA, JSON.stringify({ feature: 'chat' }));
```

## Development Commands

### Installation
```bash
# Install dependencies
pnpm install
```

### Build
```bash
# Build the package
pnpm build

# Watch mode
pnpm dev
```

### Testing
```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch
```

### Code Quality
```bash
# Lint
pnpm lint

# Type checking
pnpm typecheck

# Format code
pnpm format

# Format check
pnpm format:check
```

### Clean
```bash
# Remove build artifacts and node_modules
pnpm clean
```

## Build Configuration (tsup)

### Dual Build (ESM + CJS)
```typescript
// tsup.config.ts
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],        // Dual build
  dts: true,                     // Generate .d.ts
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  minify: false,
  outDir: 'dist',
  target: 'node20',
  platform: 'node',
});
```

**Output**:
- `dist/index.js` (CommonJS)
- `dist/index.mjs` (ES Modules)
- `dist/index.d.ts` (TypeScript types)

## Testing Patterns

### Unit Tests
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getClient, resetClient } from 'brokle';

describe('Brokle Client', () => {
  afterEach(async () => {
    await resetClient();
  });

  it('should create singleton instance', () => {
    const client1 = getClient();
    const client2 = getClient();
    expect(client1).toBe(client2);
  });

  it('should validate API key format', () => {
    expect(() => {
      new Brokle({ apiKey: 'invalid' });
    }).toThrow('must start with "bk_"');
  });
});
```

### Mock Spans
```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('test');

const span = tracer.startSpan('test-span');
span.setAttribute('test', 'value');
span.end();
```

## Common Patterns

### Nested Spans
```typescript
const tracer = client.getTracer();

await tracer.startActiveSpan('parent', async (parent) => {
  parent.setAttribute('parent_data', 'value');

  // Child span
  await tracer.startActiveSpan('child', async (child) => {
    child.setAttribute('child_data', 'value');
    child.end();
  });

  parent.end();
});
```

### traceFunction Helper
```typescript
import { traceFunction } from 'brokle';

const tracedFn = traceFunction(
  'process-data',
  async (data: string) => {
    return processData(data);
  },
  { captureInput: true, version: '1.0' }
);

const result = await tracedFn('hello');
```

## Key Architectural Decisions

1. **Symbol.for() Singleton**: Cross-realm safe, prevents accidental overwrites
2. **No Exit Handlers**: Explicit lifecycle management to prevent memory leaks
3. **Wrapper Pattern**: Processor wraps Batch/Simple for flexibility
4. **Proxy Pattern**: OpenAI/Anthropic wrappers use Proxy for zero-code integration
5. **Dual Build**: ESM + CJS for maximum compatibility
6. **TypeScript First**: Full type safety with GenAI 1.28+ attributes

## Troubleshooting

### experimentalDecorators Required
**Problem**: Decorator errors in TypeScript
**Solution**: Add to `tsconfig.json`:
```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### Symbol.for() Singleton Issues
**Problem**: Multiple client instances created
**Solution**: Symbol.for() creates process-wide registry. Check if using `new Brokle()` instead of `getClient()`.

### flushSync for Serverless
**Problem**: Spans not appearing in Lambda
**Solution**: Use `flushSync: true` for SimpleSpanProcessor:
```typescript
const client = getClient({ flushSync: true });
await client.flush();  // Before exit
```

### No Automatic Cleanup
**Problem**: Spans not exported on exit
**Solution**: SDK doesn't register exit handlers. Call `client.flush()` or `client.shutdown()` explicitly.

## Key Differences from Python SDK

| Feature | JavaScript | Python |
|---------|-----------|---------|
| **Singleton** | Symbol.for() | Global dict + atexit |
| **Lifecycle** | Explicit (no auto handlers) | Automatic atexit cleanup |
| **Processors** | Batch OR Simple (via flushSync) | Always Batch |
| **Decorators** | TypeScript decorators | Python decorators |
| **Wrappers** | Proxy pattern (sub-path exports) | Wrapper functions (in core) |
| **Build** | ESM + CJS dual build | Python package |
| **Structure** | Single package with sub-path exports | Single package |

## Reference

- **SDK Location**: `sdk/javascript/`
- **Source Code**: `src/`
- **Integrations**: `src/integrations/` (openai, anthropic, langchain)
- **Documentation**: `README.md`, `CLAUDE.md`
- **Examples**: `examples/` directory
- **Tests**: `src/**/*.test.ts` (unit), `tests/` (e2e)
