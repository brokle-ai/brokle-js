# Brokle Anthropic Wrapper

Automatic tracing for Anthropic (Claude) SDK with zero code changes. Drop-in replacement that adds comprehensive observability to your Anthropic API calls.

## Features

- ✅ **Zero Code Changes**: Wrap your Anthropic client once, trace all calls automatically
- ✅ **Full GenAI Compliance**: OTEL GenAI 1.28+ semantic conventions
- ✅ **Complete Coverage**: Messages API (Claude)
- ✅ **Automatic Attribute Extraction**: Model, tokens, latency, messages, stop reason
- ✅ **Proxy Pattern**: Non-invasive, preserves all Anthropic functionality
- ✅ **TypeScript Native**: Full type safety maintained

## Installation

```bash
npm install brokle brokle-anthropic @anthropic-ai/sdk @opentelemetry/api
```

## Quick Start

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { wrapAnthropic } from 'brokle-anthropic';
import { getClient } from 'brokle';

// 1. Initialize Brokle
const brokleClient = getClient({
  apiKey: process.env.BROKLE_API_KEY,
});

// 2. Create Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// 3. Wrap it with Brokle
const tracedAnthropic = wrapAnthropic(anthropic);

// 4. Use normally - automatic tracing!
const response = await tracedAnthropic.messages.create({
  model: 'claude-3-opus-20240229',
  max_tokens: 1024,
  messages: [
    { role: 'user', content: 'What is the capital of France?' }
  ],
});

console.log(response.content[0].text);
// Trace automatically sent to Brokle backend with all metadata
```

## What Gets Traced

### Automatic Attribute Extraction

Every Anthropic API call is automatically traced with:

#### Request Attributes
- `gen_ai.provider.name` = "anthropic"
- `gen_ai.operation.name` = "chat"
- `gen_ai.request.model` = Model name (e.g., "claude-3-opus-20240229")
- `gen_ai.request.max_tokens` = Max tokens
- `gen_ai.request.temperature` = Temperature parameter
- `gen_ai.request.top_p` = Top P
- `anthropic.request.top_k` = Top K (Anthropic-specific)
- `gen_ai.input.messages` = JSON array of messages
- `gen_ai.system_instructions` = System prompt (if provided)
- `brokle.streaming` = Whether streaming is enabled

#### Response Attributes
- `gen_ai.response.id` = Response ID
- `gen_ai.response.model` = Actual model used
- `gen_ai.response.finish_reasons` = Stop reason array
- `gen_ai.output.messages` = JSON array of response content
- `gen_ai.usage.input_tokens` = Input tokens
- `gen_ai.usage.output_tokens` = Output tokens
- `brokle.usage.total_tokens` = Total tokens
- `brokle.usage.latency_ms` = Request latency

## Supported APIs

### Messages API (Claude)

```typescript
const response = await tracedAnthropic.messages.create({
  model: 'claude-3-opus-20240229',
  max_tokens: 1024,
  messages: [
    { role: 'user', content: 'Hello, Claude!' }
  ],
});
```

**Span Name**: `chat {model}`
**Observation Type**: `generation`

### With System Prompt

```typescript
const response = await tracedAnthropic.messages.create({
  model: 'claude-3-sonnet-20240229',
  max_tokens: 1024,
  system: 'You are a helpful AI assistant specialized in mathematics.',
  messages: [
    { role: 'user', content: 'What is 2+2?' }
  ],
});
```

System prompts are captured in `gen_ai.system_instructions` attribute.

### With Tool Use

```typescript
const response = await tracedAnthropic.messages.create({
  model: 'claude-3-opus-20240229',
  max_tokens: 1024,
  tools: [
    {
      name: 'get_weather',
      description: 'Get current weather',
      input_schema: {
        type: 'object',
        properties: {
          location: { type: 'string' },
        },
      },
    },
  ],
  messages: [
    { role: 'user', content: 'What is the weather in Paris?' }
  ],
});
```

Tool use is automatically captured in the output messages.

## Advanced Usage

### With User/Session Context

```typescript
import { Attrs } from 'brokle';

const brokle = getClient();
await brokle.traced('user-query', async (span) => {
  span.setAttribute(Attrs.USER_ID, 'user-123');
  span.setAttribute(Attrs.SESSION_ID, 'session-456');

  const response = await tracedAnthropic.messages.create({
    model: 'claude-3-opus-20240229',
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'Hello' }],
  });

  return response;
});
```

### Streaming

```typescript
const stream = await tracedAnthropic.messages.create({
  model: 'claude-3-opus-20240229',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Tell me a story' }],
  stream: true,
});

for await (const event of stream) {
  if (event.type === 'content_block_delta') {
    process.stdout.write(event.delta.text);
  }
}
```

**Note**: Streaming traces are created when the request starts. Final attributes (tokens, stop reason) may not be available for streaming requests.

## How It Works

### Proxy Pattern

The wrapper uses JavaScript Proxy to intercept method calls:

```
wrapAnthropic(client) → Proxy
  ↓
  Intercepts: messages.create
  ↓
  Creates OTEL span → Calls original method → Extracts attributes → Closes span
  ↓
  Returns original response unchanged
```

## Architecture

```
Your App → wrapAnthropic(client) → Proxy → OTEL Span → Anthropic API
                                    ↓
                           Brokle Client → OTLP → Backend
```

## Supported Models

- Claude 3 Opus
- Claude 3 Sonnet
- Claude 3 Haiku
- All future Claude models (wrapper is model-agnostic)

## Limitations

- **Streaming**: Final usage metrics not available for streamed responses
- **Legacy Completions API**: Not supported (use Messages API instead)

## Requirements

- Node.js >= 18.0.0
- Anthropic SDK >= 0.17.0
- Brokle SDK >= 0.1.0

## License

MIT

## Links

- [Brokle SDK](../brokle)
- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript)
- [Documentation](https://docs.brokle.ai)