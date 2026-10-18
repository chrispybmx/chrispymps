/* Gli admin salvano youtube_url cosi' come lo copiano: watch?v=, youtu.be,
   shorts, embed, con o senza www e parametri. L'embed si costruisce da zero
   a partire dall'ID: un replace sull'URL originale lasciava pezzi del vecchio
   dominio nel src dell'iframe. */
const YOUTUBE_ID_RE =
  /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/i;

export function youtubeEmbedUrl(url: string | null | undefined): string | null {
  const id = url?.trim().match(YOUTUBE_ID_RE)?.[1];
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null;
}
