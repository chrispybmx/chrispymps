import { describe, expect, it } from 'vitest';
import { exactIlikePattern } from '@/lib/username-pattern';

describe('exactIlikePattern', () => {
  it('escapes underscore so it no longer matches any character', () => {
    expect(exactIlikePattern('bmx_rider')).toBe('bmx\\_rider');
  });
  it('escapes the other LIKE wildcards and backslash', () => {
    expect(exactIlikePattern('a%b*c\\d')).toBe('a\\%b\\*c\\\\d');
  });
  it('leaves plain usernames untouched', () => {
    expect(exactIlikePattern('chrispy-bmx')).toBe('chrispy-bmx');
  });
});
