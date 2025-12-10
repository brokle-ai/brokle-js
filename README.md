# Brokle TypeScript/JavaScript SDK

OpenTelemetry-native observability for AI applications. Track, monitor, and optimize your LLM applications with industry-standard tracing.

## 📦 Packages

This monorepo contains multiple packages for different use cases:

### Core SDK
- **[brokle](./packages/brokle)** - Core SDK with OTEL-native tracing
  - ✅ Type-safe GenAI 1.28+ attributes
  - ✅ Trace-level sampling
  - ✅ Gzip compression
  - ✅ Decorators and async helpers
  - ✅ ESM + CJS dual build

### SDK Wrappers
- **[brokle-openai](./packages/brokle-openai)** - OpenAI SDK wrapper with automatic tracing
- **[brokle-anthropic](./packages/brokle-anthropic)** - Anthropic SDK wrapper

### Integrations
- **[brokle-langchain](./packages/brokle-langchain)** - LangChain.js callbacks
- **brokle-vercel** - Vercel AI SDK middleware (Coming Soon)

## 🚀 Quick Start

### Installation

```bash
npm install brokle @opentelemetry/api
```

### Basic Usage

```typescript
import { getClient, observe, Attrs } from 'brokle';

// Initialize
const client = getClient({
  apiKey: process.env.BROKLE_API_KEY,
  environment: 'production',
});

// Option 1: Decorators
class AIService {
  @observe({ name: 'chat', asType: 'generation' })
  async chat(prompt: string) {
    const response = await openai.chat.completions.create({...});
    return response.choices[0].message.content;
  }
}

// Option 2: Traced function
await client.traced('my-operation', async (span) => {
  span.setAttribute(Attrs.USER_ID, 'user-123');
  return await doWork();
});

// Option 3: Generation helper
await client.generation('chat', 'gpt-4', 'openai', async (span) => {
  const response = await openai.chat.completions.create({...});
  span.setAttribute(Attrs.GEN_AI_USAGE_INPUT_TOKENS, response.usage.prompt_tokens);
  return response;
});
```

## 📚 Documentation

- [Core SDK Documentation](./packages/brokle/README.md)
- [Examples](./examples/)
- [API Reference](https://docs.brokle.ai/sdk/typescript)

## 🎯 Features

### Industry-Standard OTLP
Built on OpenTelemetry SDK - compatible with OTEL ecosystem

### GenAI 1.28+ Compliance
Full support for OTEL GenAI semantic conventions:
- `gen_ai.provider.name`, `gen_ai.operation.name`
- `gen_ai.input.messages`, `gen_ai.output.messages`
- `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`
- Provider-specific attributes (OpenAI, Anthropic, Google)

### Trace-Level Sampling
Deterministic sampling with `TraceIdRatioBasedSampler`:
- No partial traces
- Consistent across distributed systems
- Configurable sample rate (0.0 to 1.0)

### Type-Safe Attributes
```typescript
import { Attrs, LLMProvider } from 'brokle';

span.setAttribute(Attrs.GEN_AI_PROVIDER_NAME, LLMProvider.OPENAI);
span.setAttribute(Attrs.GEN_AI_REQUEST_MODEL, 'gpt-4');
```

### Flexible Deployment
- **Long-running apps**: BatchSpanProcessor with configurable batching
- **Serverless/Lambda**: SimpleSpanProcessor with immediate export
- **Configurable**: Batch size, flush interval, queue size

### Gzip Compression
Automatic bandwidth optimization (65% size reduction)

## 🔒 Privacy and Data Masking

Brokle supports client-side data masking to protect sensitive information before transmission. Masking is applied to input/output data and metadata **before** it leaves your application.

### Basic Usage

```typescript
import { Brokle } from 'brokle';

const maskEmails = (data: unknown): unknown => {
  if (typeof data === 'string') {
    return data.replace(/\b[\w.]+@[\w.]+\b/g, '[EMAIL]');
  }
  if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data)) {
      return data.map(maskEmails);
    }
    return Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, maskEmails(v)])
    );
  }
  return data;
};

// Configure masking at client initialization
const client = new Brokle({
  apiKey: 'bk_secret',
  mask: maskEmails
});

// All input/output automatically masked
await client.traced('process', async (span) => {
  span.setAttribute('input.value', 'Contact john@example.com');
  // Transmitted as: input.value="Contact [EMAIL]"
});
```

### Using Built-in Helpers

The SDK includes pre-built masking utilities for common PII patterns:

```typescript
import { Brokle } from 'brokle';
import { MaskingHelper } from 'brokle/utils/masking';

// Option 1: Mask all common PII (recommended)
const client = new Brokle({
  apiKey: 'bk_secret',
  mask: MaskingHelper.maskPII  // Masks emails, phones, SSN, credit cards, API keys
});

// Option 2: Mask specific PII types
const client = new Brokle({apiKey: 'bk_secret', mask: MaskingHelper.maskEmails});
const client = new Brokle({apiKey: 'bk_secret', mask: MaskingHelper.maskPhones});
const client = new Brokle({apiKey: 'bk_secret', mask: MaskingHelper.maskAPIKeys});

// Option 3: Field-based masking
const client = new Brokle({
  apiKey: 'bk_secret',
  mask: MaskingHelper.fieldMask(['password', 'ssn', 'api_key'])
});

// Option 4: Combine multiple strategies
const combinedMask = MaskingHelper.combineMasks(
  MaskingHelper.maskEmails,
  MaskingHelper.maskPhones,
  MaskingHelper.fieldMask(['password', 'secret_token'])
);
const client = new Brokle({apiKey: 'bk_secret', mask: combinedMask});
```

### What Gets Masked

Masking applies to these span attributes:
- `input.value` - Generic input data
- `output.value` - Generic output data
- `gen_ai.input.messages` - LLM chat messages
- `gen_ai.output.messages` - LLM response messages
- `metadata` - Custom metadata

**Structural attributes are NOT masked** (model names, token counts, metrics, timestamps, environment tags).

### Error Handling

If your masking function throws an exception, Brokle returns:
```
"<fully masked due to failed mask function>"
```

This ensures sensitive data is **never transmitted** even if masking fails (security-first design).

### Custom Pattern Masking

Create custom masking for your specific needs:

```typescript
import { MaskingHelper } from 'brokle/utils/masking';

// Mask IPv4 addresses
const maskIP = MaskingHelper.customPatternMask(
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
  '[IP_ADDRESS]'
);

const client = new Brokle({apiKey: 'bk_secret', mask: maskIP});
```

### Security Best Practices

1. **Client-side masking**: Data is masked before leaving your application
2. **Test your masks**: Verify patterns catch your specific PII in development
3. **Fail-safe defaults**: Exceptions result in full masking (never sends unmasked data)
4. **Performance**: Masking adds <1ms overhead per span

For more examples, see `examples/masking-basic.ts` and `examples/masking-helpers.ts`.

## 🏗️ Architecture

### OTEL-Native Design

```
TypeScript SDK → OpenTelemetry SDK → OTLP/HTTP → Brokle Backend
                 (TracerProvider)     (Protobuf+Gzip)
```

### Key Components

1. **BrokleClient**: Main SDK class
   - TracerProvider setup
   - Resource attributes
   - Trace-level sampling
   - Helper methods

2. **BrokleSpanProcessor**: Wrapper pattern
   - Wraps BatchSpanProcessor or SimpleSpanProcessor
   - Future: PII masking, custom transformations

3. **BrokleExporter**: OTLP configuration
   - API key authentication
   - Gzip compression
   - Environment tags

4. **Symbol Singleton**: Global state management
   - Single TracerProvider instance
   - No process exit handlers
   - Explicit shutdown

## 📋 Examples

### Simple Tracing
```typescript
import { getClient } from 'brokle';

const client = getClient();

await client.traced('my-operation', async (span) => {
  span.setAttribute('custom', 'value');
  return await doWork();
});
```

### LLM Generation
```typescript
await client.generation('chat', 'gpt-4', 'openai', async (span) => {
  const response = await openai.chat.completions.create({...});

  span.setAttribute(Attrs.GEN_AI_INPUT_MESSAGES, JSON.stringify([...]));
  span.setAttribute(Attrs.GEN_AI_OUTPUT_MESSAGES, JSON.stringify([...]));
  span.setAttribute(Attrs.GEN_AI_USAGE_INPUT_TOKENS, response.usage.prompt_tokens);

  return response;
});
```

### Decorators
```typescript
class AIService {
  @observe({ captureInput: true, captureOutput: true })
  async process(data: any) {
    return await processData(data);
  }
}
```

### Serverless
```typescript
const client = getClient({ flushSync: true });

export const handler = async (event) => {
  await client.traced('handler', async (span) => {
    return await processEvent(event);
  });

  await client.flush();
  return { statusCode: 200 };
};
```

## 🛠️ Development

### Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Run tests
pnpm test

# Lint
pnpm run lint
```

### Project Structure

```
sdk/javascript/
├── packages/
│   ├── brokle/              # Core SDK
│   ├── brokle-openai/       # OpenAI wrapper
│   ├── brokle-anthropic/    # Anthropic wrapper
│   └── brokle-langchain/    # LangChain integration
├── examples/                # Usage examples
├── tests/                   # Integration tests
└── pnpm-workspace.yaml      # Monorepo config
```

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📄 License

MIT

## 🔗 Links

- [Documentation](https://docs.brokle.ai)
- [GitHub](https://github.com/brokle-ai/brokle-js)
- [Issues](https://github.com/brokle-ai/brokle-js/issues)
- [Brokle Platform](https://brokle.ai)