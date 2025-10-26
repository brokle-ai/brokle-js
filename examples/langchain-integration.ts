/**
 * LangChain.js Integration Example
 *
 * Demonstrates automatic tracing for LangChain applications
 */

import { ChatOpenAI } from 'langchain/chat_models/openai';
import { PromptTemplate } from 'langchain/prompts';
import { LLMChain } from 'langchain/chains';
import { Calculator } from 'langchain/tools/calculator';
import { initializeAgentExecutorWithOptions } from 'langchain/agents';
import { BrokleLangChainCallback } from 'brokle-langchain';
import { getClient, Attrs } from 'brokle';

// ========== Initialize Brokle ==========

const brokleClient = getClient({
  apiKey: process.env.BROKLE_API_KEY || 'bk_test_key_1234567890123456789012345678901234567890',
  baseUrl: process.env.BROKLE_BASE_URL || 'http://localhost:8080',
  environment: 'development',
  debug: true,
});

// ========== 1. Simple LLM Chain ==========

async function simpleLLMChain() {
  console.log('\n=== Simple LLM Chain ===');

  const callback = new BrokleLangChainCallback({
    userId: 'user-123',
    sessionId: 'session-456',
    tags: ['example', 'simple-chain'],
    debug: true,
  });

  try {
    const model = new ChatOpenAI({
      modelName: 'gpt-3.5-turbo',
      openAIApiKey: process.env.OPENAI_API_KEY || 'sk-test-key',
    });

    const prompt = PromptTemplate.fromTemplate('What is the capital of {country}?');

    const chain = new LLMChain({ llm: model, prompt });

    const result = await chain.invoke({ country: 'France' }, { callbacks: [callback] });

    console.log('Result:', result.text);
    console.log('✅ Chain traced with user/session context');
  } catch (error) {
    console.log('Note: This is a demo. Use real API keys for actual responses.');
    console.log('✅ Chain would be traced in production');
  } finally {
    await callback.flush();
  }
}

// ========== 2. Chain with Override Context ==========

async function chainWithOverrideContext() {
  console.log('\n=== Chain with Override Context ===');

  const callback = new BrokleLangChainCallback({
    userId: 'default-user',
    sessionId: 'default-session',
    debug: true,
  });

  try {
    const model = new ChatOpenAI({
      modelName: 'gpt-4',
      openAIApiKey: process.env.OPENAI_API_KEY || 'sk-test-key',
    });

    const prompt = PromptTemplate.fromTemplate('Explain {topic} in one sentence.');

    const chain = new LLMChain({ llm: model, prompt });

    // Override userId and sessionId for this specific request
    const result = await chain.invoke(
      { topic: 'quantum computing' },
      {
        callbacks: [callback],
        metadata: {
          brokleUserId: 'override-user-999',
          brokleSessionId: 'override-session-xyz',
        },
      }
    );

    console.log('Result:', result.text || 'Demo result');
    console.log('✅ Traced with overridden user/session IDs');
  } catch (error) {
    console.log('✅ Would trace with override context in production');
  } finally {
    await callback.flush();
  }
}

// ========== 3. Agent with Tools ==========

async function agentWithTools() {
  console.log('\n=== Agent with Tools ===');

  const callback = new BrokleLangChainCallback({
    userId: 'user-456',
    tags: ['agent', 'calculator', 'tools'],
    debug: true,
  });

  try {
    const model = new ChatOpenAI({
      modelName: 'gpt-3.5-turbo',
      temperature: 0,
      openAIApiKey: process.env.OPENAI_API_KEY || 'sk-test-key',
    });

    const tools = [new Calculator()];

    const executor = await initializeAgentExecutorWithOptions(tools, model, {
      agentType: 'zero-shot-react-description',
      verbose: true,
    });

    const result = await executor.invoke(
      { input: 'What is 25 multiplied by 4, then add 10?' },
      { callbacks: [callback] }
    );

    console.log('Result:', result.output || 'Demo calculation result');
    console.log('✅ Agent execution traced:');
    console.log('   - Main agent span');
    console.log('   - LLM calls (reasoning)');
    console.log('   - Tool calls (calculator)');
    console.log('   - Final answer');
  } catch (error) {
    console.log('✅ Would trace agent execution in production');
  } finally {
    await callback.flush();
  }
}

// ========== 4. Multiple Chain Calls ==========

async function multipleChainCalls() {
  console.log('\n=== Multiple Chain Calls ===');

  const callback = new BrokleLangChainCallback({
    sessionId: 'conversation-789',
    tags: ['multi-turn'],
    debug: true,
  });

  try {
    const model = new ChatOpenAI({
      modelName: 'gpt-3.5-turbo',
      openAIApiKey: process.env.OPENAI_API_KEY || 'sk-test-key',
    });

    const prompt = PromptTemplate.fromTemplate('{input}');
    const chain = new LLMChain({ llm: model, prompt });

    console.log('Making multiple related calls...');

    // First call
    const result1 = await chain.invoke({ input: 'What is AI?' }, { callbacks: [callback] });
    console.log('Call 1:', result1.text || 'Demo response 1');

    // Second call
    const result2 = await chain.invoke(
      { input: 'How is it different from ML?' },
      { callbacks: [callback] }
    );
    console.log('Call 2:', result2.text || 'Demo response 2');

    // Third call
    const result3 = await chain.invoke(
      { input: 'Give me an example' },
      { callbacks: [callback] }
    );
    console.log('Call 3:', result3.text || 'Demo response 3');

    console.log('✅ All calls traced with same session ID');
  } catch (error) {
    console.log('✅ Would trace multiple calls in production');
  } finally {
    await callback.flush();
  }
}

// ========== 5. Combined with Brokle Client ==========

async function combinedWithBrokleClient() {
  console.log('\n=== Combined with Brokle Client ===');

  const callback = new BrokleLangChainCallback({
    debug: true,
  });

  try {
    // Wrap entire operation in Brokle traced span
    await brokleClient.traced('user-question', async (parentSpan) => {
      // Set custom attributes on parent span
      parentSpan.setAttribute(Attrs.USER_ID, 'user-888');
      parentSpan.setAttribute(Attrs.SESSION_ID, 'session-pqr');
      parentSpan.setAttribute(Attrs.TAGS, JSON.stringify(['important', 'premium']));
      parentSpan.setAttribute(
        Attrs.METADATA,
        JSON.stringify({
          source: 'web-app',
          path: '/api/chat',
        })
      );

      const model = new ChatOpenAI({
        modelName: 'gpt-4',
        openAIApiKey: process.env.OPENAI_API_KEY || 'sk-test-key',
      });

      const prompt = PromptTemplate.fromTemplate('Answer: {question}');
      const chain = new LLMChain({ llm: model, prompt });

      // LangChain creates child spans under parent
      const result = await chain.invoke(
        { question: 'What is the meaning of life?' },
        { callbacks: [callback] }
      );

      console.log('Result:', result.text || 'Demo philosophical answer');
      return result;
    });

    console.log('✅ Nested spans created:');
    console.log('   Parent: user-question (Brokle traced)');
    console.log('   Child: chain llm_chain (LangChain)');
    console.log('   Grandchild: chat gpt-4 (LangChain LLM)');
  } catch (error) {
    console.log('✅ Would create nested spans in production');
  } finally {
    await callback.flush();
  }
}

// ========== 6. Error Handling ==========

async function errorHandling() {
  console.log('\n=== Error Handling ===');

  const callback = new BrokleLangChainCallback({
    debug: true,
  });

  try {
    const model = new ChatOpenAI({
      modelName: 'gpt-3.5-turbo',
      openAIApiKey: 'invalid-api-key', // Intentional error
    });

    const prompt = PromptTemplate.fromTemplate('{input}');
    const chain = new LLMChain({ llm: model, prompt });

    await chain.invoke({ input: 'Test' }, { callbacks: [callback] });
  } catch (error) {
    console.log('Caught error (expected):', (error as Error).message.substring(0, 50) + '...');
    console.log('✅ Error automatically recorded in span');
    console.log('✅ Span closed with ERROR status');
  } finally {
    await callback.cleanup(); // Clean up any open spans
    await callback.flush();
  }
}

// ========== 7. Different Providers ==========

async function differentProviders() {
  console.log('\n=== Different Providers ===');

  const callback = new BrokleLangChainCallback({
    tags: ['multi-provider'],
    debug: true,
  });

  try {
    console.log('Testing different LLM providers...');

    // OpenAI
    try {
      const openai = new ChatOpenAI({
        modelName: 'gpt-3.5-turbo',
        openAIApiKey: process.env.OPENAI_API_KEY || 'sk-test-key',
      });

      const prompt = PromptTemplate.fromTemplate('Say hello in {language}');
      const chain = new LLMChain({ llm: openai, prompt });

      const result = await chain.invoke({ language: 'Spanish' }, { callbacks: [callback] });
      console.log('OpenAI:', result.text || 'Hola');
    } catch (error) {
      console.log('OpenAI: Demo response');
    }

    // Note: Anthropic, Google would work similarly
    console.log('✅ Provider auto-detected and set in span attributes');
  } catch (error) {
    console.log('✅ Would trace different providers in production');
  } finally {
    await callback.flush();
  }
}

// ========== Main Execution ==========

async function main() {
  console.log('Starting LangChain.js Integration Examples...\n');
  console.log('Note: These examples use demo API keys.');
  console.log('Use real OpenAI API keys to see actual responses.\n');

  try {
    // Run all examples
    await simpleLLMChain();
    await chainWithOverrideContext();
    await agentWithTools();
    await multipleChainCalls();
    await combinedWithBrokleClient();
    await errorHandling();
    await differentProviders();

    // Final flush
    console.log('\n=== Final Flush ===');
    await brokleClient.flush();
    console.log('✅ All traces flushed to backend');

    console.log('\n✅ All LangChain examples completed!');
    console.log('\nKey Features Demonstrated:');
    console.log('  • Automatic tracing of LLM calls, chains, and tools');
    console.log('  • User/session context tracking');
    console.log('  • Context override per request');
    console.log('  • Nested span relationships');
    console.log('  • Error handling and recording');
    console.log('  • Multi-provider support');
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