import { describe, it, expect } from 'vitest';
import {
  detectDialect,
  detectTemplateDialect,
  extractVariables,
} from '../prompt/compiler';

describe('Jinja2 Dot Notation', () => {
  describe('detectDialect', () => {
    it('detects dot notation as jinja2', () => {
      expect(detectDialect('{{ user.name }}')).toBe('jinja2');
      expect(detectDialect('{{ data.items.count }}')).toBe('jinja2');
    });

    it('detects simple vars as simple', () => {
      expect(detectDialect('{{ name }}')).toBe('simple');
    });
  });

  describe('extractVariables', () => {
    it('extracts root variable with explicit jinja2 dialect', () => {
      const template = { content: 'Hello {{ user.name }}' };
      const vars = extractVariables(template, 'jinja2');
      expect(vars).toContain('user');
    });

    it('extracts root variable with auto dialect', () => {
      const template = { content: 'Hello {{ user.name }}, email: {{ user.email }}' };
      const vars = extractVariables(template, 'auto');
      expect(vars).toContain('user');
    });

    it('extracts root from nested dot notation', () => {
      const template = { content: '{{ data.items.first.value }}' };
      const vars = extractVariables(template, 'auto');
      expect(vars).toContain('data');
    });

    it('extracts all roots from mixed simple and dot notation', () => {
      const template = { content: '{{ name }} and {{ user.email }}' };
      const vars = extractVariables(template, 'auto');
      expect(vars).toContain('name');
      expect(vars).toContain('user');
    });

    it('extracts root variable with filter', () => {
      const template = { content: '{{ user.name|upper }}' };
      const vars = extractVariables(template, 'jinja2');
      expect(vars).toContain('user');
    });

    it('extracts variables from chat templates with dot notation', () => {
      const template = {
        messages: [
          { role: 'system' as const, content: 'You are {{ config.assistant_name }}.' },
          { role: 'user' as const, content: 'Hello {{ user.name }}!' },
        ],
      };
      const vars = extractVariables(template, 'auto');
      expect(vars).toContain('config');
      expect(vars).toContain('user');
    });
  });
});
