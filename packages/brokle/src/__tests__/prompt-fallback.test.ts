/**
 * Tests for prompt fallback/guaranteed availability functionality.
 *
 * Ensures prompts are always available even during network failures through fallback mechanisms.
 */

import { describe, it, expect } from 'vitest';
import { Prompt } from '../prompt/prompt';
import type { PromptData, ChatMessage } from '../prompt/types';

describe('Prompt Fallback', () => {
  describe('Prompt.createFallback()', () => {
    it('creates TEXT prompt from string fallback', () => {
      const fallback = 'Hello {{name}}, welcome to our service!';

      const prompt = Prompt.createFallback('greeting', fallback);

      expect(prompt.name).toBe('greeting');
      expect(prompt.type).toBe('text');
      expect(prompt.isFallback).toBe(true);
      expect(prompt.template).toEqual({ content: fallback });
      expect(prompt.variables).toContain('name');
    });

    it('creates CHAT prompt from array fallback', () => {
      const fallback: ChatMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: '{{user_query}}' },
      ];

      const prompt = Prompt.createFallback('assistant', fallback);

      expect(prompt.name).toBe('assistant');
      expect(prompt.type).toBe('chat');
      expect(prompt.isFallback).toBe(true);
      expect(prompt.template).toEqual({ messages: fallback });
      expect(prompt.variables).toContain('user_query');
    });

    it('fallback version is 0', () => {
      const prompt = Prompt.createFallback('test', 'Hello!');

      expect(prompt.version).toBe(0);
    });

    it('fallback id is "fallback"', () => {
      const prompt = Prompt.createFallback('test', 'Hello!');

      expect(prompt.id).toBe('fallback');
    });

    it('empty string works as text fallback', () => {
      const prompt = Prompt.createFallback('empty', '');

      expect(prompt.type).toBe('text');
      expect(prompt.template).toEqual({ content: '' });
    });

    it('empty array works as chat fallback', () => {
      const prompt = Prompt.createFallback('empty', []);

      expect(prompt.type).toBe('chat');
      expect(prompt.template).toEqual({ messages: [] });
    });
  });

  describe('Fallback template compilation', () => {
    it('text fallback compiles with variables', () => {
      const fallback = 'Hello {{name}}, your order #{{order_id}} is ready!';
      const prompt = Prompt.createFallback('notification', fallback);

      const compiled = prompt.compile({ name: 'Alice', order_id: '12345' });

      expect(compiled).toEqual({ content: 'Hello Alice, your order #12345 is ready!' });
    });

    it('chat fallback compiles with variables', () => {
      const fallback: ChatMessage[] = [
        { role: 'system', content: 'You help with {{topic}}.' },
        { role: 'user', content: '{{question}}' },
      ];
      const prompt = Prompt.createFallback('qa', fallback);

      const compiled = prompt.compile({ topic: 'Python', question: 'How do decorators work?' });

      expect(compiled).toEqual({
        messages: [
          { role: 'system', content: 'You help with Python.' },
          { role: 'user', content: 'How do decorators work?' },
        ],
      });
    });

    it('text fallback converts to OpenAI messages', () => {
      const fallback = 'Hello {{name}}!';
      const prompt = Prompt.createFallback('greeting', fallback);

      const messages = prompt.toOpenAIMessages({ name: 'World' });

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('Hello World!');
    });

    it('chat fallback converts to OpenAI messages', () => {
      const fallback: ChatMessage[] = [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello {{name}}!' },
      ];
      const prompt = Prompt.createFallback('assistant', fallback);

      const messages = prompt.toOpenAIMessages({ name: 'there' });

      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('system');
      expect(messages[1].content).toBe('Hello there!');
    });

    it('chat fallback converts to Anthropic messages', () => {
      const fallback: ChatMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello {{name}}!' },
      ];
      const prompt = Prompt.createFallback('assistant', fallback);

      const anthropic = prompt.toAnthropicMessages({ name: 'Claude' });

      expect(anthropic.system).toBe('You are a helpful assistant.');
      expect(anthropic.messages).toHaveLength(1);
      expect(anthropic.messages[0].role).toBe('user');
      expect(anthropic.messages[0].content).toBe('Hello Claude!');
    });
  });

  describe('Fallback type detection', () => {
    it('string detected as text', () => {
      const prompt = Prompt.createFallback('test', 'Simple string');

      expect(prompt.isText()).toBe(true);
      expect(prompt.isChat()).toBe(false);
    });

    it('array detected as chat', () => {
      const prompt = Prompt.createFallback('test', [{ role: 'user', content: 'Hello' }]);

      expect(prompt.isChat()).toBe(true);
      expect(prompt.isText()).toBe(false);
    });
  });

  describe('Fallback variable extraction', () => {
    it('extracts text variables', () => {
      const fallback = 'Hello {{name}}, your code is {{code}}.';
      const prompt = Prompt.createFallback('test', fallback);

      expect(prompt.variables).toContain('name');
      expect(prompt.variables).toContain('code');
      expect(prompt.variables).toHaveLength(2);
    });

    it('extracts chat variables', () => {
      const fallback: ChatMessage[] = [
        { role: 'system', content: 'You assist with {{domain}}.' },
        { role: 'user', content: 'Question: {{query}}' },
      ];
      const prompt = Prompt.createFallback('test', fallback);

      expect(prompt.variables).toContain('domain');
      expect(prompt.variables).toContain('query');
      expect(prompt.variables).toHaveLength(2);
    });

    it('no variables in static template', () => {
      const prompt = Prompt.createFallback('static', 'Hello World!');

      expect(prompt.variables).toHaveLength(0);
    });

    it('duplicate variables deduplicated', () => {
      const fallback = 'Hello {{name}}, welcome {{name}}!';
      const prompt = Prompt.createFallback('test', fallback);

      expect(prompt.variables.filter((v) => v === 'name')).toHaveLength(1);
    });
  });

  describe('isFallback property', () => {
    it('fallback prompt has isFallback=true', () => {
      const prompt = Prompt.createFallback('test', 'Fallback content');

      expect(prompt.isFallback).toBe(true);
    });

    it('normal prompt has isFallback=false', () => {
      // Simulate a prompt from API response
      const data: PromptData = {
        id: '123',
        project_id: 'proj-1',
        name: 'test',
        type: 'text',
        description: 'Test prompt',
        tags: [],
        template: { content: 'Hello!' },
        config: null,
        variables: [],
        labels: [],
        version: 1,
        is_fallback: false,
        commit_message: 'Initial',
        created_by: 'user',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      const prompt = Prompt.fromData(data);

      expect(prompt.isFallback).toBe(false);
    });
  });

  describe('Fallback with model config', () => {
    it('fallback has null config', () => {
      const prompt = Prompt.createFallback('test', 'Hello!');

      expect(prompt.config).toBeNull();
    });

    it('getModelConfig returns empty object for fallback', () => {
      const prompt = Prompt.createFallback('test', 'Hello!');

      const config = prompt.getModelConfig();

      expect(config).toEqual({});
    });

    it('getModelConfig with overrides works for fallback', () => {
      const prompt = Prompt.createFallback('test', 'Hello!');

      const config = prompt.getModelConfig({ temperature: 0.7, model: 'gpt-4' });

      expect(config).toEqual({ temperature: 0.7, model: 'gpt-4' });
    });
  });
});
