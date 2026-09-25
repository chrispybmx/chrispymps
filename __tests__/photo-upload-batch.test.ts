import { describe, expect, it } from 'vitest';
import { createPhotoUploadBatch } from '@/lib/photo-upload-batch';

const file = (name: string) => ({ name });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('photo selection and background uploads', () => {
  it('keeps cover and photo order even when uploads finish out of order', async () => {
    const batch = createPhotoUploadBatch<ReturnType<typeof file>>();
    const a = file('cover.jpg'), b = file('detail.jpg');
    const first = deferred<string>(), second = deferred<string>();
    const pending = batch.run([a, b], f => f === a ? first.promise : second.promise);
    second.resolve('url-b');
    expect(batch.urlsFor([a, b])).toBeNull();
    first.resolve('url-a');
    expect(await pending).toEqual({ urls: ['url-a', 'url-b'], failed: 0 });
    expect(batch.urlsFor([a, b])).toEqual(['url-a', 'url-b']);
  });

  it('does not let a slow previous selection replace the photos the rider kept', async () => {
    const batch = createPhotoUploadBatch<ReturnType<typeof file>>();
    const a = file('removed.jpg'), b = file('kept.jpg');
    const old = deferred<string>();
    const obsolete = batch.run([a, b], async () => old.promise);
    expect(await batch.run([b], async () => 'current-b')).toEqual({ urls: ['current-b'], failed: 0 });
    old.resolve('old-url');
    expect(await obsolete).toBeNull();
    expect(batch.urlsFor([b])).toEqual(['current-b']);
    expect(batch.urlsFor([a, b])).toBeNull();
  });

  it('invalidates ready URLs as soon as replacement uploads start', async () => {
    const batch = createPhotoUploadBatch<ReturnType<typeof file>>();
    const a = file('a.jpg'), b = file('b.jpg');
    await batch.run([a], async () => 'a-url');
    const next = deferred<string>();
    const pending = batch.run([b], () => next.promise);
    expect(batch.urlsFor([a])).toBeNull();
    expect(batch.urlsFor([b])).toBeNull();
    next.resolve('b-url');
    await pending;
    expect(batch.urlsFor([b])).toEqual(['b-url']);
  });

  it('requires the exact ordered file selection, not just a matching count or filename', async () => {
    const batch = createPhotoUploadBatch<ReturnType<typeof file>>();
    const a = file('photo.jpg'), b = file('detail.jpg');
    await batch.run([a, b], async f => `${f.name}-url`);
    expect(batch.urlsFor([b, a])).toBeNull();
    expect(batch.urlsFor([file('photo.jpg'), b])).toBeNull();
    expect(batch.urlsFor([a])).toBeNull();
  });

  it('ignores uploads completing after closing the dialog or clearing all photos', async () => {
    const batch = createPhotoUploadBatch<ReturnType<typeof file>>();
    const a = file('a.jpg');
    const upload = deferred<string>();
    const pending = batch.run([a], () => upload.promise);
    batch.invalidate();
    upload.resolve('late-url');
    expect(await pending).toBeNull();
    expect(batch.urlsFor([a])).toBeNull();
    expect(batch.urlsFor([])).toBeNull();
  });

  it('never exposes a partial batch as ready and allows retry of all selected photos', async () => {
    const batch = createPhotoUploadBatch<ReturnType<typeof file>>();
    const a = file('a.jpg'), b = file('b.jpg');
    expect(await batch.run([a, b], async f => f === a ? 'url-a' : null))
      .toEqual({ urls: [], failed: 1 });
    expect(batch.urlsFor([a, b])).toBeNull();
    expect(await batch.run([a, b], async f => `retry-${f.name}`))
      .toEqual({ urls: ['retry-a.jpg', 'retry-b.jpg'], failed: 0 });
    expect(batch.urlsFor([a, b])).toEqual(['retry-a.jpg', 'retry-b.jpg']);
  });

  it('treats rejected requests and invalid upload URLs as failed files', async () => {
    const batch = createPhotoUploadBatch<ReturnType<typeof file>>();
    const a = file('a.jpg'), b = file('b.jpg');
    const rejected = deferred<string>();
    const pending = batch.run([a, b], f => f === a ? rejected.promise : Promise.resolve(''));
    rejected.reject(new Error('Network unavailable'));
    expect(await pending).toEqual({ urls: [], failed: 2 });
    expect(batch.urlsFor([a, b])).toBeNull();
  });

  it('does not surface a stale failure after a newer selection uploaded successfully', async () => {
    const batch = createPhotoUploadBatch<ReturnType<typeof file>>();
    const a = file('a.jpg'), b = file('b.jpg');
    const old = deferred<string>();
    const obsolete = batch.run([a], () => old.promise);
    await batch.run([b], async () => 'url-b');
    old.reject(new Error('Old request timed out'));
    expect(await obsolete).toBeNull();
    expect(batch.urlsFor([b])).toEqual(['url-b']);
  });
});
