import { searchLocations } from '../services/locationSearch.service.js';

export async function search(req, res, next) {
  try {
    const query = String(req.query.q || '').trim();

    if (query.length < 3) {
      return res.status(200).json({
        status: 'success',
        data: [],
      });
    }

    const locations = await searchLocations(query);

    return res.status(200).json({
      status: 'success',
      data: locations,
    });
  } catch (error) {
    console.warn('[LocationSearch] Search failed:', {
      message: error.message,
      providerErrors: error.providerErrors || [],
    });

    return res.status(503).json({
      status: 'error',
      message: 'Location search is temporarily unavailable. Please try again.',
      data: [],
    });
  }
}
