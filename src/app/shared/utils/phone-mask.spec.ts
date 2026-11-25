import { formatPhoneMask } from './phone-mask';

describe('formatPhoneMask', () => {
  it('formats mobile and landline numbers', () => {
    expect(formatPhoneMask('11987654321')).toBe('(11) 9 8765-4321');
    expect(formatPhoneMask('1133334444')).toBe('(11) 3333-4444');
  });

  it('returns an em dash for an empty phone', () => {
    expect(formatPhoneMask(null)).toBe('—');
  });
});
