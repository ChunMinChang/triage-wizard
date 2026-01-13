/**
 * @fileoverview Tests for canned responses module (L4-F1)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseCannedResponsesMarkdown,
  slugify,
  getAll,
  getById,
  getByCategory,
  saveResponse,
  deleteResponse,
  importMarkdown,
  STORAGE_KEY,
} from '../cannedResponses.js';

describe('cannedResponses module', () => {
  describe('slugify', () => {
    it('should convert to lowercase', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('should replace spaces with hyphens', () => {
      expect(slugify('foo bar baz')).toBe('foo-bar-baz');
    });

    it('should replace non-alphanumeric with hyphens', () => {
      expect(slugify('foo@bar#baz')).toBe('foo-bar-baz');
    });

    it('should collapse multiple hyphens', () => {
      expect(slugify('foo---bar')).toBe('foo-bar');
    });

    it('should trim leading/trailing hyphens', () => {
      expect(slugify('-foo-bar-')).toBe('foo-bar');
      expect(slugify('...hello...')).toBe('hello');
    });

    it('should handle empty string', () => {
      expect(slugify('')).toBe('');
    });

    it('should handle special characters', () => {
      expect(slugify("It's a test!")).toBe('it-s-a-test');
    });
  });

  describe('parseCannedResponsesMarkdown', () => {
    it('should parse a single response with all metadata', () => {
      const markdown = `## need-str
ID: need-str
Title: Ask for Steps to Reproduce
Categories: need-info, str
Description: Ask the reporter for STR

Hi, and thanks for filing this bug!

Please provide **Steps to Reproduce**.`;

      const responses = parseCannedResponsesMarkdown(markdown);

      expect(responses).toHaveLength(1);
      expect(responses[0].id).toBe('need-str');
      expect(responses[0].title).toBe('Ask for Steps to Reproduce');
      expect(responses[0].categories).toEqual(['need-info', 'str']);
      expect(responses[0].description).toBe('Ask the reporter for STR');
      expect(responses[0].bodyTemplate).toContain('thanks for filing');
      expect(responses[0].bodyTemplate).toContain('**Steps to Reproduce**');
    });

    it('should parse multiple responses', () => {
      const markdown = `## Response One
Title: First Response

Body of first response.

## Response Two
Title: Second Response

Body of second response.

## Response Three
Title: Third Response

Body of third response.`;

      const responses = parseCannedResponsesMarkdown(markdown);

      expect(responses).toHaveLength(3);
      expect(responses[0].title).toBe('First Response');
      expect(responses[1].title).toBe('Second Response');
      expect(responses[2].title).toBe('Third Response');
    });

    it('should generate ID from heading when no ID provided', () => {
      const markdown = `## Ask for More Information
Title: Need Info

Please provide more details.`;

      const responses = parseCannedResponsesMarkdown(markdown);

      expect(responses).toHaveLength(1);
      expect(responses[0].id).toBe('ask-for-more-information');
    });

    it('should use heading as title when no Title provided', () => {
      const markdown = `## My Custom Response

This is the body.`;

      const responses = parseCannedResponsesMarkdown(markdown);

      expect(responses).toHaveLength(1);
      expect(responses[0].title).toBe('My Custom Response');
    });

    it('should handle response with no metadata', () => {
      const markdown = `## Simple Response

Just the body content here.`;

      const responses = parseCannedResponsesMarkdown(markdown);

      expect(responses).toHaveLength(1);
      expect(responses[0].id).toBe('simple-response');
      expect(responses[0].title).toBe('Simple Response');
      expect(responses[0].bodyTemplate).toBe('Just the body content here.');
    });

    it('should preserve markdown formatting in body', () => {
      const markdown = `## Formatted Response
Title: Test

**Bold text**

- List item 1
- List item 2

\`\`\`javascript
const code = 'example';
\`\`\``;

      const responses = parseCannedResponsesMarkdown(markdown);

      expect(responses[0].bodyTemplate).toContain('**Bold text**');
      expect(responses[0].bodyTemplate).toContain('- List item 1');
      expect(responses[0].bodyTemplate).toContain('```javascript');
    });

    it('should handle duplicate IDs by appending suffix', () => {
      const markdown = `## Duplicate
ID: same-id

First one.

## Another Duplicate
ID: same-id

Second one.

## Third Duplicate
ID: same-id

Third one.`;

      const responses = parseCannedResponsesMarkdown(markdown);

      expect(responses).toHaveLength(3);
      expect(responses[0].id).toBe('same-id');
      expect(responses[1].id).toBe('same-id-2');
      expect(responses[2].id).toBe('same-id-3');
    });

    it('should parse categories as array', () => {
      const markdown = `## Test
Categories: cat1, cat2, cat3

Body.`;

      const responses = parseCannedResponsesMarkdown(markdown);

      expect(responses[0].categories).toEqual(['cat1', 'cat2', 'cat3']);
    });

    it('should trim whitespace from categories', () => {
      const markdown = `## Test
Categories:   spacy  ,  categories

Body.`;

      const responses = parseCannedResponsesMarkdown(markdown);

      expect(responses[0].categories).toEqual(['spacy', 'categories']);
    });

    it('should handle empty categories', () => {
      const markdown = `## Test
Categories:

Body.`;

      const responses = parseCannedResponsesMarkdown(markdown);

      expect(responses[0].categories).toEqual([]);
    });

    it('should ignore content before first heading', () => {
      const markdown = `# Main Title

Some intro text that should be ignored.

---

## Actual Response
Title: Real Response

This is the real body.`;

      const responses = parseCannedResponsesMarkdown(markdown);

      expect(responses).toHaveLength(1);
      expect(responses[0].title).toBe('Real Response');
    });

    it('should handle empty markdown', () => {
      expect(parseCannedResponsesMarkdown('')).toEqual([]);
      expect(parseCannedResponsesMarkdown(null)).toEqual([]);
      expect(parseCannedResponsesMarkdown(undefined)).toEqual([]);
    });

    it('should handle markdown with no responses', () => {
      const markdown = `# Just a title

Some text without any level-2 headings.`;

      expect(parseCannedResponsesMarkdown(markdown)).toEqual([]);
    });

    it('should trim leading/trailing blank lines from body', () => {
      const markdown = `## Test Response
Title: Test


The actual body content.


`;

      const responses = parseCannedResponsesMarkdown(markdown);

      expect(responses[0].bodyTemplate).toBe('The actual body content.');
    });

    it('should handle response with empty body', () => {
      const markdown = `## Empty Body Response
Title: No Body`;

      const responses = parseCannedResponsesMarkdown(markdown);

      expect(responses).toHaveLength(1);
      expect(responses[0].bodyTemplate).toBe('');
    });

    it('should treat horizontal rules as body content', () => {
      const markdown = `## Response With HR
Title: Test

First paragraph.

---

Second paragraph after horizontal rule.`;

      const responses = parseCannedResponsesMarkdown(markdown);

      expect(responses[0].bodyTemplate).toContain('---');
      expect(responses[0].bodyTemplate).toContain('Second paragraph');
    });

    it('should handle case-insensitive metadata keys', () => {
      const markdown = `## Test
id: my-id
TITLE: My Title
CaTeGoRiEs: cat1, cat2
description: A description

Body text.`;

      const responses = parseCannedResponsesMarkdown(markdown);

      expect(responses[0].id).toBe('my-id');
      expect(responses[0].title).toBe('My Title');
      expect(responses[0].categories).toEqual(['cat1', 'cat2']);
      expect(responses[0].description).toBe('A description');
    });

    it('should ignore unknown metadata keys', () => {
      const markdown = `## Test
Title: Test Response
Unknown: Some value
Author: John Doe

Body content.`;

      const responses = parseCannedResponsesMarkdown(markdown);

      expect(responses[0].title).toBe('Test Response');
      expect(responses[0].bodyTemplate).toBe('Body content.');
      expect(responses[0]).not.toHaveProperty('unknown');
      expect(responses[0]).not.toHaveProperty('author');
    });
  });

  describe('response library management', () => {
    beforeEach(() => {
      // Clear localStorage mock
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    });

    it('should export STORAGE_KEY constant', () => {
      expect(STORAGE_KEY).toBeDefined();
      expect(typeof STORAGE_KEY).toBe('string');
    });

    it('should get response by ID', () => {
      const markdown = `## test-response
ID: test-id
Title: Test

Body.`;

      importMarkdown(markdown, { replace: true });
      const response = getById('test-id');

      expect(response).not.toBeNull();
      expect(response.title).toBe('Test');
    });

    it('should return null for non-existent ID', () => {
      expect(getById('non-existent')).toBeNull();
    });

    it('should filter responses by category', () => {
      const markdown = `## Response 1
ID: r1
Categories: cat-a, cat-b

Body 1.

## Response 2
ID: r2
Categories: cat-b, cat-c

Body 2.

## Response 3
ID: r3
Categories: cat-a

Body 3.`;

      importMarkdown(markdown, { replace: true });

      const catA = getByCategory('cat-a');
      expect(catA).toHaveLength(2);
      expect(catA.map((r) => r.id)).toContain('r1');
      expect(catA.map((r) => r.id)).toContain('r3');

      const catB = getByCategory('cat-b');
      expect(catB).toHaveLength(2);

      const catC = getByCategory('cat-c');
      expect(catC).toHaveLength(1);
      expect(catC[0].id).toBe('r2');
    });

    it('should import with replace option', () => {
      const md1 = `## First
ID: first
Body 1.`;
      const md2 = `## Second
ID: second
Body 2.`;

      importMarkdown(md1, { replace: true });
      expect(getAll()).toHaveLength(1);

      importMarkdown(md2, { replace: true });
      expect(getAll()).toHaveLength(1);
      expect(getAll()[0].id).toBe('second');
    });

    it('should import with merge option', () => {
      const md1 = `## First
ID: first
Body 1.`;
      const md2 = `## Second
ID: second
Body 2.`;

      importMarkdown(md1, { replace: true });
      expect(getAll()).toHaveLength(1);

      importMarkdown(md2, { replace: false });
      expect(getAll()).toHaveLength(2);
    });

    it('should update existing response when merging with same ID', () => {
      const md1 = `## Original
ID: my-id
Title: Original Title

Original body.`;

      const md2 = `## Updated
ID: my-id
Title: Updated Title

Updated body.`;

      importMarkdown(md1, { replace: true });
      importMarkdown(md2, { replace: false });

      const responses = getAll();
      expect(responses).toHaveLength(1);
      expect(responses[0].title).toBe('Updated Title');
      expect(responses[0].bodyTemplate).toBe('Updated body.');
    });

    it('should save a new response', () => {
      importMarkdown('', { replace: true }); // Clear

      const newResponse = {
        id: 'new-response',
        title: 'New Response',
        bodyTemplate: 'New body content.',
        categories: ['test'],
      };

      saveResponse(newResponse);

      const saved = getById('new-response');
      expect(saved).not.toBeNull();
      expect(saved.title).toBe('New Response');
    });

    it('should update an existing response', () => {
      const markdown = `## Existing
ID: existing-id
Title: Original

Original body.`;

      importMarkdown(markdown, { replace: true });

      saveResponse({
        id: 'existing-id',
        title: 'Updated',
        bodyTemplate: 'Updated body.',
      });

      const updated = getById('existing-id');
      expect(updated.title).toBe('Updated');
      expect(updated.bodyTemplate).toBe('Updated body.');
    });

    it('should delete a response', () => {
      const markdown = `## To Delete
ID: delete-me

Body.`;

      importMarkdown(markdown, { replace: true });
      expect(getById('delete-me')).not.toBeNull();

      const result = deleteResponse('delete-me');

      expect(result).toBe(true);
      expect(getById('delete-me')).toBeNull();
    });

    it('should return false when deleting non-existent response', () => {
      expect(deleteResponse('non-existent')).toBe(false);
    });

    it('should return copy of library from getAll', () => {
      const markdown = `## Test
ID: test
Body.`;

      importMarkdown(markdown, { replace: true });

      const all1 = getAll();
      const all2 = getAll();

      expect(all1).not.toBe(all2); // Different array instances
      expect(all1).toEqual(all2); // Same content
    });
  });
});
