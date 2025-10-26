/**
 * SDK Wrapper Usage Example
 *
 * Demonstrates automatic tracing with OpenAI and Anthropic wrappers
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { getClient, Attrs } from 'brokle';
import { wrapOpenAI } from 'brokle-openai';
import { wrapAnthropic } from 'brokle-anthropic';

// ========== Initialize Brokle Client ==========

const brokleClient = getClient({
  apiKey: process.env.BROKLE_API_KEY || 'bk_test_key_1234567890123456789012345678901234567890',
  baseUrl: process.env.BROKLE_BASE_URL || 'http://localhost:8080',
  environment: 'development',
  debug: true,
});

// ========== OpenAI Wrapper Examples ==========

async function openaiChatCompletion() {
  console.log('\n=== OpenAI Chat Completion (Wrapped) ===');

  // Create and wrap OpenAI client
  const openai = wrapOpenAI(
    new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'sk-test-key',
    })
  );

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'What is the capital of France?' },
      ],
      temperature: 0.7,
      max_tokens: 100,
    });

    console.log('Response:', response.choices[0].message.content);
    console.log('Tokens used:', response.usage);
    console.log('✅ Trace automatically sent to Brokle');
  } catch (error) {
    console.log('Note: This is a demo with mock API key');
    console.log('✅ Trace would be sent with real API key');
  }
}

async function openaiWithContext() {
  console.log('\n=== OpenAI with User/Session Context ===');

  const openai = wrapOpenAI(
    new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'sk-test-key',
    })
  );

  // Wrap in a traced span to add context
  await brokleClient.traced('user-question', async (span) => {
    // Add user/session context
    span.setAttribute(Attrs.USER_ID, 'user-456');
    span.setAttribute(Attrs.SESSION_ID, 'session-789');
    span.setAttribute(Attrs.TAGS, JSON.stringify(['production', 'customer-support']));

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'How do I reset my password?' }],
      });

      console.log('Response:', response.choices[0]?.message?.content || 'Demo response');
      console.log('✅ Trace with user/session context sent');
    } catch (error) {
      console.log('✅ Would trace with context in production');
    }
  });
}

async function openaiTextCompletion() {
  console.log('\n=== OpenAI Text Completion (Wrapped) ===');

  const openai = wrapOpenAI(
    new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'sk-test-key',
    })
  );

  try {
    const response = await openai.completions.create({
      model: 'gpt-3.5-turbo-instruct',
      prompt: 'Once upon a time',
      max_tokens: 50,
    });

    console.log('Completion:', response.choices[0]?.text || 'Demo completion');
    console.log('✅ Text completion traced');
  } catch (error) {
    console.log('✅ Would trace text completion in production');
  }
}

async function openaiEmbeddings() {
  console.log('\n=== OpenAI Embeddings (Wrapped) ===');

  const openai = wrapOpenAI(
    new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'sk-test-key',
    })
  );

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: 'The quick brown fox jumps over the lazy dog',
    });

    console.log('Embedding dimensions:', response.data[0]?.embedding?.length || 1536);
    console.log('✅ Embedding traced');
  } catch (error) {
    console.log('✅ Would trace embedding in production');
  }
}

// ========== Anthropic Wrapper Examples ==========

async function anthropicChatCompletion() {
  console.log('\n=== Anthropic Chat Completion (Wrapped) ===');

  // Create and wrap Anthropic client
  const anthropic = wrapAnthropic(
    new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-test-key',
    })
  );

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'What is the capital of France?' }],
    });

    console.log('Response:', response.content[0]?.text || 'Demo response');
    console.log('Tokens used:', response.usage);
    console.log('✅ Trace automatically sent to Brokle');
  } catch (error) {
    console.log('Note: This is a demo with mock API key');
    console.log('✅ Trace would be sent with real API key');
  }
}

async function anthropicWithSystem() {
  console.log('\n=== Anthropic with System Prompt (Wrapped) ===');

  const anthropic = wrapAnthropic(
    new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-test-key',
    })
  );

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1024,
      system: 'You are a helpful AI assistant specialized in mathematics.',
      messages: [{ role: 'user', content: 'What is 2+2?' }],
    });

    console.log('Response:', response.content[0]?.text || 'Demo response');
    console.log('✅ System prompt captured in trace');
  } catch (error) {
    console.log('✅ Would trace system prompt in production');
  }
}

async function anthropicWithContext() {
  console.log('\n=== Anthropic with User Context (Wrapped) ===');

  const anthropic = wrapAnthropic(
    new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-test-key',
    })
  );

  // Wrap in traced span for context
  await brokleClient.traced('claude-query', async (span) => {
    span.setAttribute(Attrs.USER_ID, 'user-999');
    span.setAttribute(Attrs.SESSION_ID, 'session-abc');

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 512,
        messages: [{ role: 'user', content: 'Tell me a short joke' }],
      });

      console.log('Response:', response.content[0]?.text || 'Demo joke');
      console.log('✅ Trace with user context sent');
    } catch (error) {
      console.log('✅ Would trace with context in production');
    }
  });
}

// ========== Multi-Provider Example ==========

async function multiProviderComparison() {
  console.log('\n=== Multi-Provider Comparison ===');

  const openai = wrapOpenAI(
    new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'sk-test-key',
    })
  );

  const anthropic = wrapAnthropic(
    new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-test-key',
    })
  );

  await brokleClient.traced('provider-comparison', async (span) => {
    span.setAttribute('comparison.type', 'multi-provider');

    console.log('\nComparing providers for same question...');

    try {
      // OpenAI
      const openaiResponse = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Explain AI in one sentence' }],
      });
      console.log('OpenAI:', openaiResponse.choices[0]?.message?.content || 'Demo');
    } catch (error) {
      console.log('OpenAI: Demo response');
    }

    try {
      // Anthropic
      const anthropicResponse = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Explain AI in one sentence' }],
      });
      console.log('Anthropic:', anthropicResponse.content[0]?.text || 'Demo');
    } catch (error) {
      console.log('Anthropic: Demo response');
    }

    console.log('✅ Both providers traced in same parent span');
  });
}

// ========== Main Execution ==========

async function main() {
  console.log('Starting SDK Wrapper Examples...\n');
  console.log('Note: These examples use demo API keys. In production,');
  console.log('use real API keys to see actual LLM responses.\n');

  try {
    // OpenAI examples
    await openaiChatCompletion();
    await openaiWithContext();
    await openaiTextCompletion();
    await openaiEmbeddings();

    // Anthropic examples
    await anthropicChatCompletion();
    await anthropicWithSystem();
    await anthropicWithContext();

    // Multi-provider
    await multiProviderComparison();

    // Flush all traces
    console.log('\n=== Flushing Traces ===');
    await brokleClient.flush();
    console.log('✅ All traces flushed to backend');

    console.log('\n✅ All wrapper examples completed!');
    console.log('\nKey Benefits:');
    console.log('  • Zero code changes to your LLM calls');
    console.log('  • Automatic GenAI attribute extraction');
    console.log('  • Full type safety preserved');
    console.log('  • All LLM features work normally');
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