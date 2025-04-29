// src/utils/formatting.test.ts

import { formatSize } from './formatting';

describe('formatSize', () => {
  it('should format zero bytes', () => {
    expect(formatSize(0)).toBe('0 Bytes');
  });

  it('should format bytes less than 1 KB', () => {
    expect(formatSize(500)).toBe('500 Bytes');
  });

  it('should format exact KB', () => {
    expect(formatSize(1024)).toBe('1.00 KB');
    expect(formatSize(2048)).toBe('2.00 KB');
  });

  it('should format fractional KB', () => {
    expect(formatSize(1500)).toBe('1.46 KB'); // 1500 / 1024
  });

  it('should format exact MB', () => {
    expect(formatSize(1024 * 1024)).toBe('1.00 MB');
    expect(formatSize(5 * 1024 * 1024)).toBe('5.00 MB');
  });

  it('should format fractional MB', () => {
    expect(formatSize(1.5 * 1024 * 1024)).toBe('1.50 MB');
  });

  it('should format exact GB', () => {
    expect(formatSize(1024 * 1024 * 1024)).toBe('1.00 GB');
  });

  it('should format fractional GB', () => {
    expect(formatSize(2.75 * 1024 * 1024 * 1024)).toBe('2.75 GB');
  });

  it('should format TB and higher as GB', () => {
    expect(formatSize(1024 * 1024 * 1024 * 1024)).toBe('1024.00 GB'); // 1 TB
    expect(formatSize(1.5 * 1024 * 1024 * 1024 * 1024)).toBe('1536.00 GB'); // 1.5 TB
  });

  it('should handle negative numbers (return "N/A")', () => {
    expect(formatSize(-100)).toBe('N/A');
  });

  it('should handle non-numeric input (return "N/A")', () => {
    // @ts-expect-error - Testing invalid input
    expect(formatSize('abc')).toBe('N/A');
    // @ts-expect-error - Testing invalid input
    expect(formatSize(null)).toBe('N/A');
    // @ts-expect-error - Testing invalid input
    expect(formatSize(undefined)).toBe('N/A');
  });
});
