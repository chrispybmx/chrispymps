/**
 * Serializza un oggetto JSON-LD in modo sicuro per l'inserimento in <script> tags.
 * Escapa `</` → `<\/` per prevenire injection via `</script>`.
 */
export function safeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
