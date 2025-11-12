# Brokle OpenAI Wrapper

Automatic tracing for OpenAI SDK with zero code changes. Drop-in replacement that adds comprehensive observability to your OpenAI API calls.

## Features

- ✅ **Zero Code Changes**: Wrap your OpenAI client once, trace all calls automatically
- ✅ **Full GenAI Compliance**: OTEL GenAI 1.28+ semantic conventions
- ✅ **Complete Coverage**: Chat completions, text completions, embeddings
- ✅ **Automatic Attribute Extraction**: Model, tokens, latency, messages, finish reasons
- ✅ **Proxy Pattern**: Non-invasive, preserves all OpenAI functionality
- ✅ **TypeScript Native**: Full type safety maintained

## Installation

```bash
npm install brokle brokle-openai openai @opentelemetry/api
```

## Quick Start

```typescript
import OpenAI from 'openai';
import { wrapOpenAI } from 'brokle-openai';
import { getClient } from 'brokle';

// 1. Initialize Brokle
const brokleClient = getClient({
  apiKey: process.env.BROKLE_API_KEY,
});

// 2. Create OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 3. Wrap it with Brokle
const tracedOpenAI = wrapOpenAI(openai);

// 4. Use normally - automatic tracing!
const response = await tracedOpenAI.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'What is the capital of France?' }
  ],
});

console.log(response.choices[0].message.content);
// Trace automatically sent to Brokle backend with all metadata
```

## What Gets Traced

### Automatic Attribute Extraction

Every OpenAI API call is automatically traced with:

#### Request Attributes
- `gen_ai.provider.name` = "openai"
- `gen_ai.operation.name` = "chat" | "text_completion" | "embeddings"
- `gen_ai.request.model` = Model name
- `gen_ai.request.temperature` = Temperature parameter
- `gen_ai.request.max_tokens` = Max tokens
- `gen_ai.request.top_p` = Top P
- `gen_ai.request.frequency_penalty` = Frequency penalty
- `gen_ai.request.presence_penalty` = Presence penalty
- `gen_ai.input.messages` = JSON array of messages
- `openai.request.n` = Number of completions
- `brokle.streaming` = Whether streaming is enabled

#### Response Attributes
- `gen_ai.response.id` = Response ID
- `gen_ai.response.model` = Actual model used
- `gen_ai.response.finish_reasons` = Finish reasons array
- `gen_ai.output.messages` = JSON array of response messages
- `gen_ai.usage.input_tokens` = Prompt tokens
- `gen_ai.usage.output_tokens` = Completion tokens
- `brokle.usage.total_tokens` = Total tokens
- `brokle.usage.latency_ms` = Request latency
- `openai.response.system_fingerprint` = System fingerprint

## Supported APIs

### Chat Completions

```typescript
const response = await tracedOpenAI.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' }
  ],
  temperature: 0.7,
  max_tokens: 100,
});
```

**Span Name**: `chat {model}`
**Span Type**: `generation`

### Text Completions

```typescript
const response = await tracedOpenAI.completions.create({
  model: 'gpt-3.5-turbo-instruct',
  prompt: 'Once upon a time',
  max_tokens: 50,
});
```

**Span Name**: `completion {model}`
**Span Type**: `generation`

### Embeddings

```typescript
const response = await tracedOpenAI.embeddings.create({
  model: 'text-embedding-ada-002',
  input: 'Your text here',
});
```

**Span Name**: `embedding {model}`
**Span Type**: `embedding`

## Advanced Usage

### With User/Session Context

```typescript
import { Attrs } from 'brokle';

// Set context attributes manually
const brokle = getClient();
await brokle.traced('user-query', async (span) => {
  span.setAttribute(Attrs.USER_ID, 'user-123');
  span.setAttribute(Attrs.SESSION_ID, 'session-456');

  const response = await tracedOpenAI.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello' }],
  });

  return response;
});
```

### Function Calling

```typescript
const response = await tracedOpenAI.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'What is the weather?' }],
  tools: [
    {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get current weather',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string' },
          },
        },
      },
    },
  ],
});

// Tool calls automatically captured in output messages
```

### Streaming

```typescript
const stream = await tracedOpenAI.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Tell me a story' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

**Note**: Streaming traces are created when the request starts. Final attributes (tokens, finish reason) may not be available for streaming requests.

## How It Works

### Proxy Pattern

The wrapper uses JavaScript Proxy to intercept method calls without modifying the original OpenAI client:

```typescript
wrapOpenAI(openai) → Proxy
  ↓
  Intercepts: chat.completions.create, completions.create, embeddings.create
  ↓
  Creates OTEL span → Calls original method → Extracts attributes → Closes span
  ↓
  Returns original response unchanged
```

**Benefits**:
- ✅ Zero modifications to OpenAI SDK
- ✅ All OpenAI features work normally
- ✅ TypeScript types preserved
- ✅ Error handling preserved

## Architecture

```
Your App → wrapOpenAI(client) → Proxy → OTEL Span → OpenAI API
                                  ↓
                         Brokle Client → OTLP → Backend
```

1. **Proxy intercepts** OpenAI API calls
2. **Span created** with GenAI attributes
3. **Original call** executed
4. **Response parsed** and attributes extracted
5. **Span closed** with complete metadata
6. **OTLP sent** to Brokle backend (batched, compressed)

## Limitations

- **Streaming**: Final usage metrics not available for streamed responses
- **Assistants API**: Not yet supported (coming soon)
- **Images**: Image generation not yet supported (coming soon)

## Requirements

- Node.js >= 18.0.0
- OpenAI SDK >= 4.0.0
- Brokle SDK >= 0.1.0

## License

MIT

## Links

- [Brokle SDK](../brokle)
- [OpenAI SDK](https://github.com/openai/openai-node)
- [Documentation](https://docs.brokle.ai)