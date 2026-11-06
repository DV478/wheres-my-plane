const FLIGHT_RE = /^([A-Z]{2,3})\s*0*(\d{1,4})([A-Z]?)$/i;

export interface ParsedFlightNumber {
  airline: string;
  number: number;
  suffix: string | null;
  canonical: string;
}

export function parseFlightNumber(input: string): ParsedFlightNumber | null {
  const m = FLIGHT_RE.exec(input.trim());
  if (!m) return null;
  const airline = m[1].toUpperCase();
  const number = parseInt(m[2], 10);
  if (number < 1 || number > 9999) return null;
  const suffix = m[3] ? m[3].toUpperCase() : null;
  const canonical = `${airline}${number}${suffix ?? ''}`;
  return { airline, number, suffix, canonical };
}

export function isValidFlightNumber(input: string): boolean {
  return parseFlightNumber(input) !== null;
}
