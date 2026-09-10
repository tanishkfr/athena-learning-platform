import { readFile } from 'node:fs/promises';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { get as httpGet } from 'node:http';
import { get as httpsGet } from 'node:https';
import { load } from 'cheerio';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import mammoth from 'mammoth';
import { all, get, put, remove, id } from './db.js';
import { embed, embeddingModel } from './ollama.js';

export function isPrivateAddress(ip) {
  if (isIP(ip) === 4) { const [a, b] = ip.split('.').map(Number); return [0, 10, 127].includes(a) || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168); }
  return ip === '::1' || ip === '::' || /^(fc|fd|ff|fe[89ab])/i.test(ip) || ip.startsWith('::ffff:');
}
export async function safePublicUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80', '443'].includes(url.port))) throw new Error('Use a public HTTP or HTTPS resource URL.');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.localhost')) throw new Error('Local network URLs cannot be imported. Paste text or upload a file instead.');
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(a => isPrivateAddress(a.address))) throw new Error('Private network URLs cannot be imported.');
  return url;
}
async function fetchArticle(value) {
  let url = await safePublicUrl(value);
  for (let redirects = 0; redirects < 5; redirects++) {
    // Validate the addresses used by the actual connection, preventing a DNS
    // change between the preliminary URL check and the request.
    const response = await new Promise((resolve, reject) => {
      const request = (url.protocol === 'https:' ? httpsGet : httpGet)(url, {
        signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'Athena-Local-Reader/0.1', Accept: 'text/html,text/plain' },
        lookup(host, options, callback) {
          lookup(host, { all: true }).then(addresses => {
            if (!addresses.length || addresses.some(a => isPrivateAddress(a.address))) return callback(new Error('Private network URLs cannot be imported.'));
            options.all ? callback(null, addresses) : callback(null, addresses[0].address, addresses[0].family);
          }).catch(callback);
        }
      }, body => resolve({ body, status: body.statusCode, ok: body.statusCode >= 200 && body.statusCode < 300, headers: { get: name => body.headers[name] } }));
      request.on('error', reject);
    });
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) { response.body.destroy(); url = await safePublicUrl(new URL(response.headers.get('location'), url).href); continue; }
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}. Open the original or paste the article text.`);
    if (!/text\/(html|plain)|application\/xhtml/.test(response.headers.get('content-type') || '')) throw new Error('This URL is not a readable article. Download and upload the document instead.');
    let size = 0; const parts = [];
    for await (const part of response.body) { size += part.length; if (size > 4_000_000) throw new Error('Article is too large. Upload a smaller document or paste a section.'); parts.push(part); }
    const raw = Buffer.concat(parts).toString('utf8');
    if ((response.headers.get('content-type') || '').includes('text/plain')) return { title: '', sections: sectionsFromText(raw), source: url.hostname };
    const $ = load(raw);
    const title = $('meta[property="og:title"]').attr('content') || $('title').text();
    const author = $('meta[name="author"]').attr('content') || null;
    const date = $('meta[property="article:published_time"]').attr('content') || null;
    $('script,style,nav,footer,header,aside,form,noscript').remove();
    const root = $('article').first().length ? $('article').first() : $('main').first().length ? $('main').first() : $('body');
    let paragraphs = root.find('h1,h2,h3,p,li,pre').toArray().map(el => $(el).text().replace(/\s+/g, ' ').trim()).filter(t => t.length > 20);
    if (!paragraphs.length) paragraphs = [root.text().replace(/\s+/g, ' ').trim()];
    return { title: title.trim(), author, date, source: url.hostname, sections: sectionsFromText(paragraphs.join('\n\n')) };
  }
  throw new Error('Too many redirects. Open the original source instead.');
}
export function sectionsFromText(value, type = 'text') {
  let paragraph = 0;
  return value.replace(/\r/g, '').split(/\n\s*\n/).flatMap(block => {
    const clean = block.trim(); if (!clean) return [];
    paragraph++;
    const pieces = [];
    let remaining = clean;
    while (remaining.length > 1400) {
      let end = remaining.lastIndexOf(' ', 1400);
      if (end < 700) end = 1400;
      pieces.push(remaining.slice(0, end)); remaining = remaining.slice(end).trimStart();
    }
    if (remaining) pieces.push(remaining);
    return pieces.map((text, part) => ({ text: text.trim(), location: { kind: type === 'pdf' ? 'page' : 'paragraph', index: paragraph, label: `${type === 'pdf' ? 'Page' : 'Paragraph'} ${paragraph}${pieces.length > 1 ? ` · part ${part + 1}` : ''}`, part } }));
  });
}
export function transcriptSections(value) {
  const lines = value.replace(/\r/g, '').split('\n').filter(Boolean);
  let lastTime = null;
  return lines.flatMap(line => {
    if (/^(WEBVTT|\d+$)/.test(line.trim())) return [];
    const match = line.match(/^\[?((?:\d{1,2}:)?\d{1,2}:\d{2})(?:[.,]\d+)?\]?\s*(?:-->.*)?$/) || line.match(/^\[?((?:\d{1,2}:)?\d{1,2}:\d{2})\]?\s+(.+)/);
    if (match) { lastTime = match[1].split(':').reduce((n, v) => n * 60 + Number(v), 0); if (!match[2]) return []; line = match[2]; }
    if (!line.trim()) return [];
    return [{ text: line.trim(), location: lastTime === null ? { kind: 'paragraph', index: 1, label: 'Transcript · location unavailable' } : { kind: 'timestamp', seconds: lastTime, label: `${Math.floor(lastTime / 60)}:${String(lastTime % 60).padStart(2, '0')}` } }];
  });
}
const running = new Set();
export async function processResource(resourceId) {
  if (running.has(resourceId)) return;
  running.add(resourceId);
  let resource = get('resources', resourceId);
  if (!resource) { running.delete(resourceId); return; }
  put('resources', { ...resource, status: 'Processing', error: null });
  try {
    let sections = []; let metadata = {};
    if (resource.type === 'video') {
      sections = transcriptSections(resource.input || '');
      if (!sections.length) { put('resources', { ...resource, status: 'Partially Ready', error: 'Video saved. Add a transcript to enable grounded questions and review.', chunkCount: 0 }); return; }
    } else if (resource.type === 'pdf') {
      const pdf = await getDocument({ data: new Uint8Array(await readFile(resource.filePath)), useSystemFonts: true, isEvalSupported: false }).promise;
      try {
        if (pdf.numPages > 200) throw new Error('This prototype supports up to 200 PDF pages per resource.');
        for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
          const page = await pdf.getPage(pageNo); const content = await page.getTextContent();
          const text = content.items.map(item => item.str + (item.hasEOL ? '\n' : ' ')).join('').trim();
          if (text) sections.push(...sectionsFromText(text).map((section, i) => ({ text: section.text, location: { kind: 'page', index: pageNo, label: `Page ${pageNo}${i ? ` · part ${i + 1}` : ''}`, part: i } })));
        }
        metadata.pageCount = pdf.numPages;
      } finally { await pdf.destroy(); }
    } else if (resource.type === 'document') {
      const result = await mammoth.extractRawText({ path: resource.filePath });
      sections = sectionsFromText(result.value); metadata.extractionWarnings = result.messages.length;
    } else if (resource.type === 'article' && !resource.input?.trim()) {
      const result = await fetchArticle(resource.url); sections = result.sections; metadata = { ...result }; delete metadata.sections;
    } else {
      const value = resource.filePath ? await readFile(resource.filePath, 'utf8') : resource.input || '';
      sections = sectionsFromText(value);
    }
    if (!get('resources', resourceId)) return;
    if (!sections.length || !sections.some(s => s.text.length > 15)) throw new Error('No readable text found. Scanned documents need OCR outside this prototype; you can paste a transcript or open the original.');
    // Keep stable IDs on retry so existing notes and citations still resolve.
    const existing = all('chunks', resource.projectId).filter(c => c.resourceId === resource.id);
    const chunks = sections.map((section, i) => ({ ...section, id: existing[i]?.text === section.text ? existing[i].id : id(), projectId: resource.projectId, resourceId, embedding: null, embeddingModel: null }));
    for (const old of existing) if (!chunks.some(c => c.id === old.id)) remove('chunks', old.id);
    for (const chunk of chunks) put('chunks', chunk);
    resource = { ...get('resources', resourceId), ...metadata, title: resource.title || metadata.title || 'Untitled resource', chunkCount: chunks.length, wordCount: sections.reduce((n, s) => n + s.text.split(/\s+/).length, 0) };
    put('resources', resource);
    try {
      for (let i = 0; i < chunks.length; i += 16) {
        const batch = chunks.slice(i, i + 16); const vectors = await embed(batch.map(c => c.text));
        if (!get('resources', resourceId)) return;
        batch.forEach((chunk, index) => put('chunks', { ...chunk, embedding: vectors[index], embeddingModel }));
      }
      put('resources', { ...resource, status: 'Ready', error: null });
    } catch (error) { if (get('resources', resourceId)) put('resources', { ...resource, status: 'Partially Ready', error: `Readable content saved, but indexing is incomplete. ${error.message}` }); }
  } catch (error) { if (get('resources', resourceId)) put('resources', { ...get('resources', resourceId), status: 'Failed', error: error.message }); }
  finally { running.delete(resourceId); }
}
