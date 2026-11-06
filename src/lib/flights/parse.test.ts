import { describe, expect, test } from 'vitest';
import { parseFlightNumber, isValidFlightNumber } from './parse';

describe('parseFlightNumber', () => {
  test('parses IATA 2-letter + number', () => {
    expect(parseFlightNumber('BA456')).toEqual({
      airline: 'BA',
      number: 456,
      suffix: null,
      canonical: 'BA456'
    });
  });

  test('parses ICAO 3-letter + number', () => {
    expect(parseFlightNumber('BAW456')).toEqual({
      airline: 'BAW',
      number: 456,
      suffix: null,
      canonical: 'BAW456'
    });
  });

  test('strips leading zeros', () => {
    expect(parseFlightNumber('BA0456')?.canonical).toBe('BA456');
  });

  test('accepts single-space separator', () => {
    expect(parseFlightNumber('BA 456')?.canonical).toBe('BA456');
  });

  test('lowercase input is uppercased', () => {
    expect(parseFlightNumber('ba456')?.canonical).toBe('BA456');
  });

  test('accepts trailing letter suffix', () => {
    expect(parseFlightNumber('BA456A')?.canonical).toBe('BA456A');
  });

  test('rejects 4-digit zero flight number', () => {
    expect(parseFlightNumber('BA0000')).toBeNull();
  });

  test('rejects 1-letter airline', () => {
    expect(parseFlightNumber('B456')).toBeNull();
  });

  test('rejects 4-letter airline', () => {
    expect(parseFlightNumber('BAWA456')).toBeNull();
  });

  test('rejects >4 digits', () => {
    expect(parseFlightNumber('BA12345')).toBeNull();
  });

  test('rejects empty', () => {
    expect(parseFlightNumber('')).toBeNull();
  });

  test('isValidFlightNumber mirrors parseFlightNumber', () => {
    expect(isValidFlightNumber('BA456')).toBe(true);
    expect(isValidFlightNumber('nonsense')).toBe(false);
  });
});
