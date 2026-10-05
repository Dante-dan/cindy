/**
 * videoCacheStore.ts
 * ---------------------------------------------------------------------------
 * Read-only compatibility store for existing lizi_art video artifacts.
 * Sits behind the `xdt-video://` privileged scheme registered in
 * videoProtocol.ts. New managed media is written through cindy-media.
 *
 * Today only one reserved host is registered: `lizi-art-media-videos`
 * → userData/cc-agent/lizi-art-media/videos/{filename}
 *
 * The current videoProtocol reads the full Buffer and slices Range responses;
 * the stream helper remains reserved for a future streaming implementation.
 * The scheme name also lets the renderer distinguish video from image media.
 */

import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';

const SCHEME = 'xdt-video';

/**
 * Reserved hostname → absolute base directory. Mirrors the image-side
 * RESERVED_HOSTS shape so adding new producers (kling, luma, etc.) is just
 * another entry pointing at its cache folder.
 */
const RESERVED_HOSTS: Record<string, () => string> = {
  'lizi-art-media-videos': () =>
    path.join(app.getPath('userData'), 'cc-agent', 'lizi-art-media', 'videos'),
};

const MIME_BY_EXT: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

export function resolveSafe(url: string): { absPath: string; mimeType: string } {
  if (typeof url !== 'string' || !url.startsWith(`${SCHEME}://`)) {
    throw new Error('xdt-video: invalid url');
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('xdt-video: malformed url');
  }
  let host: string;
  let filename: string;
  try {
    host = decodeURIComponent(parsed.hostname);
    const pathnameRaw = parsed.pathname.startsWith('/')
      ? parsed.pathname.slice(1)
      : parsed.pathname;
    filename = decodeURIComponent(pathnameRaw);
  } catch {
    throw new Error('xdt-video: malformed url');
  }

  if (
    !host ||
    !filename ||
    host.includes('..') ||
    host.includes('\0') ||
    filename.includes('..') ||
    filename.includes('\0') ||
    filename.includes('/') ||
    filename.includes('\\')
  ) {
    throw new Error('xdt-video: path out of bounds');
  }

  const reservedDirFn = RESERVED_HOSTS[host];
  if (!reservedDirFn) {
    throw new Error('xdt-video: unknown host');
  }
  const baseDir = path.resolve(reservedDirFn());
  const absPath = path.resolve(baseDir, filename);
  if (!absPath.startsWith(baseDir + path.sep)) {
    throw new Error('xdt-video: path out of bounds');
  }
  const ext = path.extname(filename).toLowerCase();
  const mimeType = MIME_BY_EXT[ext] ?? 'application/octet-stream';
  return { absPath, mimeType };
}

/**
 * Read the full video into memory. Returns the Buffer + resolved mime so
 * the protocol handler can serve 200/206 responses (Range slicing is done
 * in the handler, not here, to keep this store unaware of HTTP semantics).
 *
 * Acceptable for current video sizes (1-30MB). If files grow much larger
 * this should switch to a Node Readable + per-range fs.createReadStream.
 */
export async function readFile(url: string): Promise<{
  buffer: Buffer;
  mimeType: string;
}> {
  const { absPath, mimeType } = resolveSafe(url);
  const buffer = await fsp.readFile(absPath);
  return { buffer, mimeType };
}

/**
 * Stream variant — kept for future Range-optimized path (currently unused
 * by the handler since readFile + slice is simpler for the file sizes we
 * see today). Don't delete: switching back when seedance supports longer
 * clips will want this.
 */
export async function streamFile(url: string): Promise<{
  stream: NodeJS.ReadableStream;
  mimeType: string;
  size: number;
}> {
  const { absPath, mimeType } = resolveSafe(url);
  const stat = await fsp.stat(absPath);
  return { stream: fs.createReadStream(absPath), mimeType, size: stat.size };
}
