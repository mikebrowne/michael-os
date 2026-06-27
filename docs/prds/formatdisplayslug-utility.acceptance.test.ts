import { describe, it, expect } from 'vitest';
import { formatDisplaySlug } from '../../src/utils/formatDisplaySlug.js';

describe('formatDisplaySlug', () => {
  it('should format a slug correctly', () => {
    expect(formatDisplaySlug('example_slug')).toBe('Example slug');
    expect(formatDisplaySlug('another_example_slug')).toBe('Another example slug');
  });
  it('should return an empty string for empty input', () => {
    expect(formatDisplaySlug('')).toBe('');
  });
  it('should return an empty string for undefined input', () => {
    expect(formatDisplaySlug(undefined)).toBe('');
  });
});
