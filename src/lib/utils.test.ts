import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('should merge basic strings', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2');
  });

  it('should handle conditional classes', () => {
    expect(cn('class1', true && 'class2', false && 'class3')).toBe('class1 class2');
  });

  it('should handle falsy values', () => {
    expect(cn('class1', null, undefined, '', 0, false)).toBe('class1');
  });

  it('should correctly merge tailwind classes', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    expect(cn('px-2 py-1', 'p-4')).toBe('p-4');
  });

  it('should handle complex conditional tailwind classes', () => {
    const isError = true;
    const isSmall = false;
    expect(cn(
      'text-gray-700 p-2',
      isError && 'text-red-500',
      isSmall ? 'text-sm' : 'text-lg',
      'p-4'
    )).toBe('text-red-500 text-lg p-4');
  });
});
