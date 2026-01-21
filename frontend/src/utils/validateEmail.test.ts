import { describe, it, expect } from 'vitest';
import { validateEmail } from './validateEmail';

describe('validateEmail', () => {
  it('accepts well-formed emails', () => {
    expect(validateEmail('john@example.com')).toBe(true);
    expect(validateEmail('Jane.Doe+tag@sub.example.co.uk')).toBe(true);
  });

  it('rejects malformed emails', () => {
    const invalids = [
      '',
      ' ',
      'notanemail',
      'john@',
      '@example.com',
      'john@example',
      'john@@example.com',
      'john@example..com',
      'john@example,com',
      'john@example.com;doe@example.com',
      'john example@example.com',
    ];
    invalids.forEach(e => expect(validateEmail(e)).toBe(false));
  });
});
