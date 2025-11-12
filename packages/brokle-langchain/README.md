# Brokle LangChain.js Integration

Automatic tracing for LangChain.js applications with comprehensive observability for chains, LLMs, tools, and agents.

## Features

- ✅ **Full LangChain Coverage**: LLMs, chains, tools, agents, retrievers
- ✅ **Automatic Tracing**: Drop-in callback handler
- ✅ **GenAI 1.28+ Compliant**: Full OTEL semantic conventions
- ✅ **Context Support**: User ID, session ID, tags, metadata
- ✅ **Error Tracking**: Automatic error recording
- ✅ **Nested Spans**: Proper parent-child relationships
- ✅ **TypeScript Native**: Full type safety

## Installation

```bash
npm install brokle brokle-langchain langchain @opentelemetry/api
```

## Quick Start

```typescript
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { PromptTemplate } from 'langchain/prompts';
import { LLMChain } from 'langchain/chains';
import { BrokleLangChainCallback } from 'brokle-langchain';
import { getClient } from 'brokle';

// 1. Initialize Brokle
const brokleClient = getClient({
  apiKey: process.env.BROKLE_API_KEY,
});

// 2. Create LangChain callback
const callback = new BrokleLangChainCallback({
  userId: 'user-123',
  sessionId: 'session-456',
  tags: ['production'],
});

// 3. Use with any LangChain component
const model = new ChatOpenAI({ modelName: 'gpt-4' });
const prompt = PromptTemplate.fromTemplate('What is {topic}?');
const chain = new LLMChain({ llm: model, prompt });

// 4. Run with callbacks - automatic tracing!
const result = await chain.invoke(
  { topic: 'artificial intelligence' },
  { callbacks: [callback] }
);

// 5. Flush before exit
await callback.flush();
```

## What Gets Traced

### LLM Calls

Every LLM call is automatically traced with:

**Request Attributes**:
- `gen_ai.provider.name` = Provider (openai, anthropic, etc.)
- `gen_ai.operation.name` = "chat"
- `gen_ai.request.model` = Model name
- `gen_ai.input.messages` = Prompt(s) as JSON

**Response Attributes**:
- `gen_ai.output.messages` = Completion(s) as JSON
- `gen_ai.usage.input_tokens` = Prompt tokens
- `gen_ai.usage.output_tokens` = Completion tokens
- `brokle.usage.total_tokens` = Total tokens
- `gen_ai.response.model` = Actual model used

**Span Name**: `chat {model}`
**Span Type**: `generation`

### Chains

Chain execution is traced with:

**Attributes**:
- `chain.type` = Chain type (e.g., "llm_chain")
- `chain.input` = Input data (JSON)
- `chain.output` = Output data (JSON)
- `brokle.span_type` = "span"

**Span Name**: `chain {type}`

### Tools

Tool calls are traced with:

**Attributes**:
- `tool.name` = Tool name
- `tool.input` = Tool input
- `tool.output` = Tool output
- `brokle.span_type` = "tool"

**Span Name**: `tool {name}`

## Advanced Usage

### With User/Session Context

```typescript
const callback = new BrokleLangChainCallback({
  userId: 'user-789',
  sessionId: 'session-abc',
  tags: ['customer-support', 'premium'],
  metadata: {
    tenant: 'acme-corp',
    region: 'us-east-1',
  },
});

const result = await chain.invoke(
  { input: 'How do I reset my password?' },
  { callbacks: [callback] }
);
```

All traces will include these context attributes for filtering and analysis.

### Override Context Per-Request

You can override context values per request using metadata:

```typescript
const callback = new BrokleLangChainCallback({
  userId: 'default-user',
  sessionId: 'default-session',
});

const result = await chain.invoke(
  { input: 'Question' },
  {
    callbacks: [callback],
    metadata: {
      brokleUserId: 'override-user-123',
      brokleSessionId: 'override-session-456',
    },
  }
);
```

### With Agents

```typescript
import { initializeAgentExecutorWithOptions } from 'langchain/agents';
import { Calculator } from 'langchain/tools/calculator';

const callback = new BrokleLangChainCallback({
  userId: 'user-123',
  tags: ['agent', 'tools'],
});

const tools = [new Calculator()];
const executor = await initializeAgentExecutorWithOptions(tools, model, {
  agentType: 'zero-shot-react-description',
});

const result = await executor.invoke(
  { input: 'What is 25 * 4?' },
  { callbacks: [callback] }
);

// Agent traces include:
// - Main agent span
// - LLM calls (reasoning)
// - Tool calls (calculator)
// - Final answer
await callback.flush();
```

### With Retrievers

```typescript
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';

const callback = new BrokleLangChainCallback({
  tags: ['retrieval', 'rag'],
});

const vectorStore = await MemoryVectorStore.fromTexts(
  ['Text 1', 'Text 2'],
  [{ id: 1 }, { id: 2 }],
  new OpenAIEmbeddings()
);

const retriever = vectorStore.asRetriever();

const docs = await retriever.getRelevantDocuments('query', {
  callbacks: [callback],
});

// Retrieval traced automatically
await callback.flush();
```

### With ConversationChain

```typescript
import { BufferMemory } from 'langchain/memory';
import { ConversationChain } from 'langchain/chains';

const callback = new BrokleLangChainCallback({
  sessionId: 'conversation-123',
});

const memory = new BufferMemory();
const chain = new ConversationChain({ llm: model, memory });

// First message
await chain.invoke(
  { input: 'Hi, my name is Alice' },
  { callbacks: [callback] }
);

// Second message (with context)
await chain.invoke(
  { input: 'What is my name?' },
  { callbacks: [callback] }
);

// Both messages traced with same session
await callback.flush();
```

## Configuration Options

```typescript
interface BrokleLangChainCallbackConfig {
  /** User ID for filtering (optional) */
  userId?: string;

  /** Session ID for filtering (optional) */
  sessionId?: string;

  /** Tags for categorization (optional) */
  tags?: string[];

  /** Custom metadata (optional) */
  metadata?: Record<string, unknown>;

  /** Enable debug logging (optional) */
  debug?: boolean;
}
```

### Debug Logging

```typescript
const callback = new BrokleLangChainCallback({
  debug: true, // Enable debug logs
});

// Logs will show:
// [Brokle LangChain] LLM started: {runId} ({model})
// [Brokle LangChain] LLM ended: {runId}
// [Brokle LangChain] Chain started: {runId} ({type})
// etc.
```

## Lifecycle Management

### Flush Before Exit

```typescript
// Serverless/Lambda
export const handler = async (event) => {
  const callback = new BrokleLangChainCallback();

  const result = await chain.invoke({ input: event.query }, { callbacks: [callback] });

  await callback.flush(); // Important: flush before return
  return result;
};
```

### Cleanup on Error

```typescript
const callback = new BrokleLangChainCallback();

try {
  const result = await chain.invoke({ input }, { callbacks: [callback] });
  await callback.flush();
} catch (error) {
  await callback.cleanup(); // End any open spans
  await callback.flush();
  throw error;
}
```

## Nested Span Example

LangChain operations create proper parent-child span relationships:

```
Trace: user-query
├── Span: chain llm_chain
│   ├── Span: chat gpt-4 (LLM call)
│   └── Span: chat gpt-4 (LLM call)
└── Span: tool calculator
```

This allows you to see the complete execution flow in Brokle dashboard.

## Integration with Brokle Client

You can combine LangChain callbacks with Brokle client for custom context:

```typescript
import { getClient, Attrs } from 'brokle';

const brokle = getClient();
const callback = new BrokleLangChainCallback();

await brokle.traced('user-question', async (span) => {
  // Set custom attributes on parent span
  span.setAttribute(Attrs.USER_ID, 'user-999');
  span.setAttribute(Attrs.TAGS, JSON.stringify(['important']));

  // Run LangChain - creates child spans
  const result = await chain.invoke({ input: 'Question' }, { callbacks: [callback] });

  return result;
});

await callback.flush();
```

## How It Works

### Callback Lifecycle

```
LangChain Run Starts
  ↓
handleLLMStart() → Create OTEL span (keep open)
  ↓
LLM API Call
  ↓
handleLLMEnd() → Extract attributes → End span
  ↓
Span exported to Brokle backend (batched, compressed)
```

### Key Implementation Details

1. **Manual Span Control**: Spans are started in `handleLLMStart()` and kept open until `handleLLMEnd()`
2. **Correct Signature**: Uses `extraParams` object for tags/metadata (LangChain.js pattern)
3. **Context Merging**: Merges config context with run-level context
4. **Error Handling**: Properly records exceptions in spans

## Supported LangChain Components

- ✅ **LLMs**: OpenAI, Anthropic, Google, Cohere, etc.
- ✅ **Chat Models**: ChatOpenAI, ChatAnthropic, etc.
- ✅ **Chains**: LLMChain, ConversationChain, etc.
- ✅ **Agents**: All agent types
- ✅ **Tools**: Calculator, Search, Custom tools
- ✅ **Retrievers**: Vector stores, Document loaders
- ✅ **Memory**: Buffer, Summary, etc.

## Requirements

- Node.js >= 18.0.0
- LangChain >= 0.1.0
- Brokle SDK >= 0.1.0

## Limitations

- Streaming responses: Final attributes may not be available
- Some custom chains may require manual instrumentation

## License

MIT

## Links

- [Brokle SDK](../brokle)
- [LangChain.js](https://js.langchain.com)
- [Documentation](https://docs.brokle.ai)