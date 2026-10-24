import fs from 'node:fs/promises';
import path from 'node:path';
import { RichAnswerStream, splitRichAnswer } from '@cindy/maker-shared/rich-answer';
import { BOT_GROUP_ATTACHMENTS_MAX, type BotGroupAttachment } from '../../shared/botGroupChat.js';
import { parseBlobUrl, resolveSafe } from '../cindy-media/blobStore.js';
import { sessionCanRead } from '../cindy-media/ledger.js';
import { materializeTaskImageTextResult } from '../cindy-media/taskImageDelivery.js';
import { hasLocalTaskImages, taskImageReferences, rewriteTaskImageReferences } from '../cindy-media/taskImageMarkdown.js';
import { getDbClient } from '../localDb/client/current.js';

/** Prepare only rendered, task-owned generated images. Never reads legacy caches. */
export async function prepareChatReplyImages(text: string, sessionId: string, assertCurrent: () => void) {
  assertCurrent();
  if (hasLocalTaskImages(text)) {
    const imported = await materializeTaskImageTextResult(sessionId, text);
    assertCurrent();
    if (imported.failures.length || hasLocalTaskImages(imported.text)) throw new Error('ATTACHMENT_UNAVAILABLE');
    text = imported.text;
  }
  const attachments: BotGroupAttachment[] = [];
  const delivered = new Map<string, string>();
  const urls = taskImageReferences(text).map(ref => ref.url);
  for (const part of splitRichAnswer(text)) {
    if (part.kind !== 'rich') continue;
    const doc = new RichAnswerStream().update(part.source, true);
    if (doc.issues) continue;
    // Only the final visible tree is delivered: patches and removals can replace images.
    const visit = (id: string) => {
      const node = doc.nodes.get(id);
      if (!node) return;
      if (node.kind === 'image' && typeof node.props.src === 'string') urls.push(node.props.src);
      node.children.forEach(visit);
    };
    doc.roots.forEach(visit);
  }
  for (const url of urls) {
    if (!/^(cindy-media|xdt-image):\/\//.test(url) || delivered.has(url)) continue;
    const blob = parseBlobUrl(url);
    if (!blob || attachments.length >= BOT_GROUP_ATTACHMENTS_MAX
      || !await sessionCanRead(blob.hash, sessionId, getDbClient().drizzle)) throw new Error('ATTACHMENT_UNAVAILABLE');
    assertCurrent();
    const image = resolveSafe(url);
    if (!image.mimeType.startsWith('image/')) throw new Error('ATTACHMENT_UNAVAILABLE');
    const stat = await fs.stat(image.absPath);
    assertCurrent();
    if (!stat.isFile() || stat.size <= 0 || stat.size > 100 * 1024 * 1024) throw new Error('ATTACHMENT_UNAVAILABLE');
    attachments.push({ id: url, name: path.basename(image.absPath), category: 'image',
      mimeType: image.mimeType, size: stat.size, url, path: null });
    delivered.set(url, url);
  }
  return { attachments, text: rewriteTaskImageReferences(text, delivered, image =>
    image.alt.replace(/[\\`*_{}[\]<>#!|]/g, '\\$&')) };
}
