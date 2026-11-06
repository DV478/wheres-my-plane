import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
  const url = platform?.env.PUBLIC_PROTOMAPS_TILE_URL;
  if (!url) {
    throw error(503, 'Map tiles not configured. Set PUBLIC_PROTOMAPS_TILE_URL.');
  }
  return { tileUrl: url };
};
