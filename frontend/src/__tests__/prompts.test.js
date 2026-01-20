/**
 * @fileoverview Tests for prompts module (centralized AI prompts)
 */

import { describe, it, expect } from 'vitest';
import {
  SCHEMAS,
  buildClassifyPrompt,
  buildSuggestPrompt,
  buildGeneratePrompt,
  buildRefinePrompt,
  getSchema,
  getSchemaString,
} from '../prompts.js';

describe('prompts module', () => {
  const sampleBug = {
    id: 123456,
    summary: 'Crash when clicking button',
    description: 'The app crashes when I click the submit button.',
    status: 'NEW',
    product: 'Firefox',
    component: 'General',
    comments: [
      { text: 'I can reproduce this on Windows 10.' },
      { text: 'Steps: 1. Open page 2. Click button 3. See crash' },
    ],
    attachments: [{ filename: 'crash.log', description: 'Crash log' }],
  };

  const sampleCannedResponse = {
    id: 'needinfo',
    title: 'Need More Information',
    bodyTemplate: 'Thank you for the report. Could you provide {{DETAILS}}?',
  };

  const sampleCannedResponses = [
    {
      id: 'needinfo',
      title: 'Need More Information',
      description: 'Request additional details',
      bodyTemplate: 'Thank you for the report. Could you provide more details?',
    },
    {
      id: 'wontfix',
      title: 'Wont Fix',
      description: 'Close as wont fix',
      bodyTemplate: 'Thank you for the report, but this is expected behavior.',
    },
  ];

  describe('SCHEMAS', () => {
    it('should have classify schema', () => {
      expect(SCHEMAS.classify).toBeDefined();
      expect(SCHEMAS.classify.properties).toHaveProperty('ai_detected_str');
      expect(SCHEMAS.classify.properties).toHaveProperty('ai_detected_test_attached');
      expect(SCHEMAS.classify.properties).toHaveProperty('crashstack_present');
      expect(SCHEMAS.classify.properties).toHaveProperty('fuzzing_testcase');
      expect(SCHEMAS.classify.properties).toHaveProperty('summary');
      // New triage fields
      expect(SCHEMAS.classify.properties).toHaveProperty('suggested_severity');
      expect(SCHEMAS.classify.properties).toHaveProperty('suggested_priority');
      expect(SCHEMAS.classify.properties).toHaveProperty('suggested_actions');
      expect(SCHEMAS.classify.properties).toHaveProperty('triage_reasoning');
    });

    it('should have suggest schema', () => {
      expect(SCHEMAS.suggest).toBeDefined();
      expect(SCHEMAS.suggest.properties).toHaveProperty('suggested_response_id');
      expect(SCHEMAS.suggest.properties).toHaveProperty('draft_response');
      expect(SCHEMAS.suggest.properties).toHaveProperty('reasoning');
    });

    it('should have generate schema', () => {
      expect(SCHEMAS.generate).toBeDefined();
      expect(SCHEMAS.generate.properties).toHaveProperty('response_text');
      expect(SCHEMAS.generate.properties).toHaveProperty('suggested_actions');
      expect(SCHEMAS.generate.properties).toHaveProperty('reasoning');
    });

    it('should have refine schema', () => {
      expect(SCHEMAS.refine).toBeDefined();
      expect(SCHEMAS.refine.properties).toHaveProperty('refined_response');
      expect(SCHEMAS.refine.properties).toHaveProperty('changes_made');
    });
  });

  describe('getSchema', () => {
    it('should return schema for valid task', () => {
      expect(getSchema('classify')).toEqual(SCHEMAS.classify);
      expect(getSchema('suggest')).toEqual(SCHEMAS.suggest);
    });

    it('should return null for invalid task', () => {
      expect(getSchema('invalid')).toBeNull();
    });
  });

  describe('getSchemaString', () => {
    it('should return JSON string for valid task', () => {
      const schemaStr = getSchemaString('classify');
      expect(typeof schemaStr).toBe('string');
      const parsed = JSON.parse(schemaStr);
      expect(parsed).toEqual(SCHEMAS.classify);
    });

    it('should return null for invalid task', () => {
      expect(getSchemaString('invalid')).toBeNull();
    });
  });

  describe('buildClassifyPrompt', () => {
    it('should include bug ID', () => {
      const prompt = buildClassifyPrompt(sampleBug);
      expect(prompt).toContain('123456');
    });

    it('should include bug summary', () => {
      const prompt = buildClassifyPrompt(sampleBug);
      expect(prompt).toContain('Crash when clicking button');
    });

    it('should include bug description', () => {
      const prompt = buildClassifyPrompt(sampleBug);
      expect(prompt).toContain('app crashes');
    });

    it('should include comments', () => {
      const prompt = buildClassifyPrompt(sampleBug);
      expect(prompt).toContain('Windows 10');
    });

    it('should include attachments', () => {
      const prompt = buildClassifyPrompt(sampleBug);
      expect(prompt).toContain('crash.log');
    });

    it('should include strict STR detection guidelines', () => {
      const prompt = buildClassifyPrompt(sampleBug);
      expect(prompt).toContain('70%');
      expect(prompt).toContain('Mark FALSE');
      expect(prompt).toContain('vague or generic');
    });

    it('should include JSON output format', () => {
      const prompt = buildClassifyPrompt(sampleBug);
      expect(prompt).toContain('ai_detected_str');
      expect(prompt).toContain('ai_detected_test_attached');
      expect(prompt).toContain('crashstack_present');
      expect(prompt).toContain('fuzzing_testcase');
      expect(prompt).toContain('summary');
      // New triage fields
      expect(prompt).toContain('suggested_severity');
      expect(prompt).toContain('suggested_priority');
      expect(prompt).toContain('suggested_actions');
      expect(prompt).toContain('triage_reasoning');
    });

    it('should include severity and priority guidelines', () => {
      const prompt = buildClassifyPrompt(sampleBug);
      expect(prompt).toContain('S1');
      expect(prompt).toContain('S2');
      expect(prompt).toContain('S3');
      expect(prompt).toContain('S4');
      expect(prompt).toContain('P1');
      expect(prompt).toContain('P2');
      expect(prompt).toContain('P3');
    });
  });

  describe('buildSuggestPrompt', () => {
    it('should include bug ID', () => {
      const prompt = buildSuggestPrompt(sampleBug, sampleCannedResponses);
      expect(prompt).toContain('123456');
    });

    it('should include all canned responses', () => {
      const prompt = buildSuggestPrompt(sampleBug, sampleCannedResponses);
      expect(prompt).toContain('needinfo');
      expect(prompt).toContain('wontfix');
    });

    it('should include JSON output format', () => {
      const prompt = buildSuggestPrompt(sampleBug, sampleCannedResponses);
      expect(prompt).toContain('suggested_response_id');
      expect(prompt).toContain('draft_response');
      expect(prompt).toContain('reasoning');
    });
  });

  describe('buildGeneratePrompt', () => {
    it('should include bug ID', () => {
      const prompt = buildGeneratePrompt(sampleBug);
      expect(prompt).toContain('123456');
    });

    it('should handle response mode', () => {
      const prompt = buildGeneratePrompt(sampleBug, { mode: 'response' });
      expect(prompt).toContain('triage comment');
      expect(prompt).toContain('professional');
    });

    it('should handle next-steps mode', () => {
      const prompt = buildGeneratePrompt(sampleBug, { mode: 'next-steps' });
      expect(prompt).toContain('triage actions');
      expect(prompt).toContain('priority');
    });

    it('should include canned responses when provided', () => {
      const prompt = buildGeneratePrompt(sampleBug, { cannedResponses: sampleCannedResponses });
      expect(prompt).toContain('needinfo');
    });

    it('should include JSON output format', () => {
      const prompt = buildGeneratePrompt(sampleBug);
      expect(prompt).toContain('response_text');
      expect(prompt).toContain('suggested_actions');
      expect(prompt).toContain('reasoning');
    });
  });

  describe('buildRefinePrompt', () => {
    const currentResponse = 'Thank you for the report.';
    const userInstruction = 'Make it more detailed';

    it('should include bug ID', () => {
      const prompt = buildRefinePrompt(sampleBug, currentResponse, userInstruction);
      expect(prompt).toContain('123456');
    });

    it('should include current response', () => {
      const prompt = buildRefinePrompt(sampleBug, currentResponse, userInstruction);
      expect(prompt).toContain('Thank you for the report');
    });

    it('should include user instruction', () => {
      const prompt = buildRefinePrompt(sampleBug, currentResponse, userInstruction);
      expect(prompt).toContain('Make it more detailed');
    });

    it('should include canned response reference when provided', () => {
      const prompt = buildRefinePrompt(sampleBug, currentResponse, userInstruction, {
        selectedCannedResponse: sampleCannedResponse,
      });
      expect(prompt).toContain('needinfo');
    });

    it('should include JSON output format', () => {
      const prompt = buildRefinePrompt(sampleBug, currentResponse, userInstruction);
      expect(prompt).toContain('refined_response');
      expect(prompt).toContain('changes_made');
    });
  });
});
