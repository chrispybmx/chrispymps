/** Preserve the existing public policy for legacy photos with a null status. */
export function publicSpotPhotos<T extends { position: number; moderation_status?: string | null }>(photos: T[] | null | undefined): T[] {
  return (photos ?? [])
    .filter(photo => photo.moderation_status === 'approved' || photo.moderation_status === null)
    .sort((a, b) => a.position - b.position);
}
