/**
 * Turns aligned, fixed-size chunk downloads into a byte-exact stream for an
 * HTTP Range request, with read-ahead. Dependency-free so it can be unit
 * tested in isolation.
 *
 * Read-ahead keeps up to `readAheadChunks` chunks loading or buffered ahead
 * of what the viewer has received, with at most `concurrency` requests in
 * flight, so playback never waits on a single round trip.
 */

export interface ChunkedStreamOptions {
  /** First and last byte to deliver (inclusive). */
  start: number;
  end: number;
  /** Fixed request size; chunk N covers bytes [N*chunkSize, (N+1)*chunkSize). */
  chunkSize: number;
  /** Fetches the chunk starting at `offset` (always a multiple of chunkSize). */
  fetchChunk: (offset: number) => Promise<Uint8Array>;
  readAheadChunks?: number;
  concurrency?: number;
  /** Called exactly once when the stream ends, is cancelled, or fails. */
  onFinish?: () => void;
}

export function createChunkedStream({
  start,
  end,
  chunkSize,
  fetchChunk,
  readAheadChunks = 16,
  concurrency = 4,
  onFinish,
}: ChunkedStreamOptions): ReadableStream<Uint8Array> {
  const lastIndex = Math.floor(end / chunkSize);
  let nextToFetch = Math.floor(start / chunkSize);
  let nextToEmit = nextToFetch;
  let stopped = false;

  const pending = new Map<number, Promise<Uint8Array>>();
  let active = 0;
  const waiting: (() => void)[] = [];

  async function limited(offset: number): Promise<Uint8Array> {
    while (active >= concurrency) await new Promise<void>((resolve) => waiting.push(resolve));
    active++;
    try {
      if (stopped) return new Uint8Array();
      return await fetchChunk(offset);
    } finally {
      active--;
      waiting.shift()?.();
    }
  }

  function fillWindow() {
    while (!stopped && nextToFetch <= lastIndex && nextToFetch - nextToEmit < readAheadChunks) {
      const index = nextToFetch++;
      const chunk = limited(index * chunkSize);
      chunk.catch(() => {}); // surfaced when awaited in pull()
      pending.set(index, chunk);
    }
  }

  const stop = () => {
    if (stopped) return;
    stopped = true;
    pending.clear();
    onFinish?.();
  };

  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        fillWindow();
        const index = nextToEmit;
        let bytes: Uint8Array;
        try {
          bytes = await pending.get(index)!;
        } catch (error) {
          stop();
          throw error;
        }
        if (stopped) return;
        pending.delete(index);
        nextToEmit++;

        const chunkStart = index * chunkSize;
        const from = Math.max(start - chunkStart, 0);
        const to = Math.min(end - chunkStart + 1, bytes.length);
        if (to > from) controller.enqueue(bytes.subarray(from, to));

        // A short chunk means end of file, even if the range claimed more.
        if (index >= lastIndex || bytes.length < chunkSize) {
          stop();
          controller.close();
          return;
        }
        fillWindow();
      },
      cancel: stop,
    },
    { highWaterMark: 0 }, // buffering is handled by the read-ahead window
  );
}
