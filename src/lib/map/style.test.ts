import { describe, expect, it } from 'vitest';
import { darkStyle } from './style';

describe('darkStyle source resolution', () => {
  it('derives the TileJSON URL from a Protomaps tile template without URL-encoding the braces', () => {
    const style = darkStyle({
      tileUrl: 'https://api.protomaps.com/tiles/v4/{z}/{x}/{y}.mvt?key=TESTKEY'
    }) as { sources: { protomaps: { url: string } } };
    expect(style.sources.protomaps.url).toBe('https://api.protomaps.com/tiles/v4.json?key=TESTKEY');
    expect(style.sources.protomaps.url).not.toContain('%7B');
  });

  it('passes a TileJSON URL through unchanged', () => {
    const tileJsonUrl = 'https://api.protomaps.com/tiles/v4.json?key=TESTKEY';
    const style = darkStyle({ tileUrl: tileJsonUrl }) as {
      sources: { protomaps: { url: string } };
    };
    expect(style.sources.protomaps.url).toBe(tileJsonUrl);
  });
});
