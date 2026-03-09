/**
 * Google Places API (New) — Church Discovery
 *
 * Uses Text Search endpoint with location bias to find churches within
 * a radius of a given location (ZIP code or city name).
 *
 * Requires GOOGLE_PLACES_API_KEY environment variable.
 */

const PLACES_API_URL = 'https://places.googleapis.com/v1/places:searchText';
const GEOCODING_API_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const MILES_TO_METERS = 1609.34;
const MAX_RADIUS_METERS = 50000;
const PAGE_SIZE = 20;
const PAGINATION_DELAY_MS = 200;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiscoveryParams {
  location: string;       // ZIP code or city name
  radiusMiles: number;    // radius in miles (converted to meters internally)
  filters?: string;       // optional additional search terms (e.g., "baptist", "youth ministry")
  maxResults?: number;    // default 60, cap at 100
}

export interface PlacesResult {
  placeId: string;
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
  types: string[];
  lat: number;
  lng: number;
  googleMapsUrl: string;
  rating: number | null;
  ratingCount: number | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    throw new Error(
      'GOOGLE_PLACES_API_KEY is not configured. ' +
      'Set it in .env.local to enable church discovery via Google Places.'
    );
  }
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Geocoding
// ---------------------------------------------------------------------------

/**
 * Convert a ZIP code or city name to lat/lng using Google Geocoding API.
 */
export async function geocodeLocation(
  location: string
): Promise<{ lat: number; lng: number }> {
  const apiKey = getApiKey();

  const url = new URL(GEOCODING_API_URL);
  url.searchParams.set('address', location);
  url.searchParams.set('key', apiKey);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Geocoding API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.results || data.results.length === 0) {
    throw new Error(`Could not geocode location: "${location}". No results found.`);
  }

  const { lat, lng } = data.results[0].geometry.location;
  return { lat, lng };
}

// ---------------------------------------------------------------------------
// Church Search
// ---------------------------------------------------------------------------

/**
 * Search for churches near a location using Google Places API (New) Text Search.
 *
 * Uses field masks to stay within the Pro pricing tier ($32/1K requests).
 * Handles pagination with nextPageToken, up to maxResults.
 */
export async function searchChurches(
  params: DiscoveryParams
): Promise<PlacesResult[]> {
  const apiKey = getApiKey();

  // Step 1: Geocode the location
  const { lat, lng } = await geocodeLocation(params.location);

  // Step 2: Build search parameters
  const radiusMeters = Math.min(
    params.radiusMiles * MILES_TO_METERS,
    MAX_RADIUS_METERS
  );
  const maxResults = Math.min(params.maxResults ?? 60, 100);
  const textQuery = `churches ${params.filters || ''}`.trim();

  const fieldMask = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.nationalPhoneNumber',
    'places.websiteUri',
    'places.types',
    'places.location',
    'places.googleMapsUri',
    'places.rating',
    'places.userRatingCount',
  ].join(',');

  const results: PlacesResult[] = [];
  let nextPageToken: string | undefined;

  // Step 3: Paginate through results
  const maxPages = Math.ceil(maxResults / PAGE_SIZE);

  for (let page = 0; page < maxPages; page++) {
    const body: Record<string, unknown> = {
      textQuery,
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusMeters,
        },
      },
      pageSize: PAGE_SIZE,
      includedType: 'church',
    };

    if (nextPageToken) {
      body.pageToken = nextPageToken;
    }

    const response = await fetch(PLACES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `Google Places API returned ${response.status}: ${errorText}`
      );
    }

    const data = await response.json();
    const places = data.places || [];

    for (const place of places) {
      results.push({
        placeId: place.id || '',
        name: place.displayName?.text || '',
        address: place.formattedAddress || '',
        phone: place.nationalPhoneNumber || null,
        website: place.websiteUri || null,
        types: place.types || [],
        lat: place.location?.latitude || 0,
        lng: place.location?.longitude || 0,
        googleMapsUrl: place.googleMapsUri || '',
        rating: place.rating ?? null,
        ratingCount: place.userRatingCount ?? null,
      });

      if (results.length >= maxResults) break;
    }

    // Check for more pages
    nextPageToken = data.nextPageToken;
    if (!nextPageToken || results.length >= maxResults) break;

    // Rate limit between paginated requests
    await sleep(PAGINATION_DELAY_MS);
  }

  return results;
}
