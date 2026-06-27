import { describe, it, expect } from 'vitest';
import { greet } from '../../src/greet.js';

describe('Greet Functionality', () => {
  it('should greet correctly with a valid name', () => {
    const result = greet('Alice');
    expect(result).toBe('Hello, Alice!');
  });

  it('should handle empty input gracefully', () => {
    const result = greet('');
    expect(result).toBe('Hello, Guest!');
  });

  it('should handle null input gracefully', () => {
    const result = greet(null);
    expect(result).toBe('Hello, Guest!');
  });
});
