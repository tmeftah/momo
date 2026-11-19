import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import zlib from 'node:zlib';
import { httpError } from './util.js';

/**
 * Downloads a public web page or picture for the phone import (the phone's browser can't read
 * other sites itself). Only public addresses are reached: the check runs on every connection
 * and redirect, so a name that resolves to the server's own network is refused.
 */

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const MAX_REDIRECTS = 5;

export function isPublicIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return !(
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPublicIp(v.slice(7));
  return !(v === '::' || v === '::1' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith('64:ff9b:'));
}

function publicLookup(hostname, options, callback) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const allowed = addresses.filter((a) => isPublicIp(a.address));
    if (!allowed.length) return callback(Object.assign(new Error('Adresse non publique'), { code: 'EPRIVATE' }));
    if (options.all) return callback(null, allowed);
    callback(null, allowed[0].address, allowed[0].family);
  });
}

function decoderFor(res) {
  switch ((res.headers['content-encoding'] || '').trim()) {
    case 'gzip':
    case 'x-gzip':
      return res.pipe(zlib.createGunzip());
    case 'br':
      return res.pipe(zlib.createBrotliDecompress());
    case 'deflate':
      return res.pipe(zlib.createInflate());
    default:
      return res;
  }
}

/** → { url (after redirects), status, type, body: Buffer }. maxBytes applies after decompression. */
export function fetchUrl(url, { accept = '*/*', maxBytes = 5 * 1024 * 1024, timeoutMs = 15000 } = {}, hops = 0) {
  let u;
  try {
    u = new URL(url);
  } catch {
    throw httpError(400, 'Adresse invalide');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw httpError(400, 'Adresse invalide : http ou https attendu');
  if (u.port && !['80', '443'].includes(u.port)) throw httpError(400, 'Port non autorisé');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && !isPublicIp(host)) throw httpError(400, 'Adresse non publique');

  return new Promise((resolve, reject) => {
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.get(
      u,
      {
        lookup: publicLookup,
        timeout: timeoutMs,
        // The headers a browser sends when opening the page from the address bar
        headers: {
          'User-Agent': USER_AGENT,
          Accept: accept,
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': accept.startsWith('image') ? 'image' : 'document',
          'Sec-Fetch-Mode': accept.startsWith('image') ? 'no-cors' : 'navigate',
          'Sec-Fetch-Site': 'none',
        },
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          if (hops >= MAX_REDIRECTS) return reject(httpError(422, 'Trop de redirections'));
          try {
            return resolve(fetchUrl(new URL(res.headers.location, u).href, { accept, maxBytes, timeoutMs }, hops + 1));
          } catch (err) {
            return reject(err);
          }
        }
        const stream = decoderFor(res);
        const chunks = [];
        let size = 0;
        stream.on('data', (c) => {
          size += c.length;
          if (size > maxBytes) {
            req.destroy();
            reject(httpError(413, 'Fichier trop lourd'));
          } else chunks.push(c);
        });
        stream.on('end', () => resolve({ url: u.href, status: res.statusCode, type: String(res.headers['content-type'] || ''), body: Buffer.concat(chunks) }));
        stream.on('error', reject);
      }
    );
    req.on('timeout', () => req.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })));
    req.on('error', (err) => {
      if (err.statusCode) return reject(err);
      if (err.code === 'EPRIVATE') return reject(httpError(400, 'Adresse non publique'));
      if (err.code === 'ETIMEDOUT') return reject(httpError(422, 'Le site ne répond pas'));
      if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') return reject(httpError(422, 'Site introuvable'));
      reject(httpError(422, 'Le site est injoignable'));
    });
  });
}

/** Text with the charset declared by the server or the page (UTF-8 otherwise). */
export function decodeText(body, contentType) {
  let charset = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  if (!charset) charset = /<meta[^>]+charset=["']?([\w-]+)/i.exec(body.subarray(0, 4096).toString('latin1'))?.[1];
  try {
    return new TextDecoder(charset || 'utf-8').decode(body);
  } catch {
    return new TextDecoder('utf-8').decode(body);
  }
}
