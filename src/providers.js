import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rawCatalog = fs.readFileSync(path.join(__dirname, 'catalog/providers.json'), 'utf8');
const catalogData = JSON.parse(rawCatalog);

function deepFreeze(obj) {
  Object.freeze(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    const val = obj[key];
    if (val && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

export const CATALOG_VERSION = catalogData.catalogVersion;
export const CATALOG_UPDATED_AT = catalogData.updatedAt;
export const PROVIDERS = deepFreeze(catalogData.providers);

const disallowedHost = /(^|\.)(localhost|local|internal)$/i;
export function validateProviderUrl(value, { allowLocalHttp = false, allowedPrivateHosts = [] } = {}) {
  let url;
  try {
    url = new URL(String(value || ''));
  } catch {
    throw new Error('Geçerli bir API adresi girin.');
  }
  if (url.username || url.password) throw new Error('API adresinde kimlik bilgisi bulunamaz.');
  if (url.search || url.hash) throw new Error('API adresinde sorgu veya parça bulunamaz.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  // LAN access is an explicit programmatic option only; no environment variable widens it.
  const privateList = (allowedPrivateHosts || []).map(h => h.trim().toLowerCase()).filter(Boolean);

  const isAllowedPrivate = privateList.some(h => h === url.host.toLowerCase() || h === host.toLowerCase());

  const local = disallowedHost.test(host) || host === '127.0.0.1' || host === '::1';
  const ip = net.isIP(host);
  if (isAllowedPrivate) {
    return url.toString().replace(/\/$/, '');
  }
  if (local && !(allowLocalHttp && url.protocol === 'http:')) throw new Error('Yerel API adresi kapalıdır.');
  if (ip && !allowLocalHttp) throw new Error('IP adresine doğrudan bağlantı kapalıdır.');
  if (url.protocol !== 'https:' && !(allowLocalHttp && local && url.protocol === 'http:'))
    throw new Error('API adresi HTTPS kullanmalıdır.');
  return url.toString().replace(/\/$/, '');
}
