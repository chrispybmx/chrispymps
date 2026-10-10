// Keep this projection in sync with the public column grant migration.
// Ownership UUID is used by SpotOwnerActions; it is not an authorization token.
export const PUBLIC_SPOT_COLUMNS = 'id,slug,name,type,lat,lon,city,region,country,country_code,description,condition,condition_updated_at,status,youtube_url,surface,wax_needed,guardians,difficulty,submitted_by_user_id,submitted_by_username,created_at,approved_at,updated_at,likes_count,avg_rating,ratings_count,ostacoli' as const;

/** Explicit response allowlist: future database columns remain private by default. */
export function publicSpotPayload(row: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  for (const key of PUBLIC_SPOT_COLUMNS.split(',')) {
    if (Object.hasOwn(row, key)) data[key] = row[key];
  }
  const photos = Array.isArray(row.spot_photos) ? row.spot_photos : [];
  data.spot_photos = photos
    .filter(photo => photo && (photo.moderation_status === 'approved' || photo.moderation_status == null))
    .map(photo => ({ id: photo.id, url: photo.url, position: photo.position, credit_name: photo.credit_name }))
    .sort((a, b) => a.position - b.position);
  return data;
}
