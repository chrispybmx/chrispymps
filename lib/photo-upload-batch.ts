/** Keeps background uploads attached to the exact, ordered selection that started them. */
export function createPhotoUploadBatch<T>() {
  let generation = 0;
  let completed: { files: T[]; urls: string[] } | null = null;

  return {
    invalidate() {
      generation += 1;
      completed = null;
    },
    async run(files: readonly T[], upload: (file: T) => Promise<string | null>) {
      const current = ++generation;
      const selection = [...files];
      completed = null;
      const results = await Promise.all(selection.map(async file => {
        try {
          const url = await upload(file);
          return typeof url === 'string' && url.length > 0 ? url : null;
        } catch {
          return null;
        }
      }));
      if (current !== generation) return null;
      const failed = results.filter(url => url === null).length;
      if (failed) return { urls: [] as string[], failed };
      const urls = results as string[];
      completed = { files: selection, urls };
      return { urls: [...urls], failed: 0 };
    },
    urlsFor(files: readonly T[]): string[] | null {
      if (!files.length || !completed || files.length !== completed.files.length ||
          files.some((file, index) => file !== completed!.files[index])) return null;
      return [...completed.urls];
    },
  };
}
