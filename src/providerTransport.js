import dns from 'node:dns';
import net from 'node:net';
import { Agent } from 'undici';

function isPublicAddress(address) {
  const family = net.isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99)))
      || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
      || (a === 203 && b === 0 && c === 113));
  }
  if (family === 6) {
    const first = parseInt(address.split(':')[0], 16);
    const second = parseInt(address.split(':')[1] || '0', 16);
    // Global unicast only; reject mapped IPv4, transition and documentation ranges.
    return first >= 0x2000 && first <= 0x3fff && first !== 0x2002 && first !== 0x3fff
      && !(first === 0x2001 && (second < 0x200 || second === 0xdb8));
  }
  return false;
}

export function createPublicLookup({ resolver = (...args) => dns.lookup(...args), allowLoopback = false } = {}) {
  return (hostname, options, callback) => {
    resolver(hostname, { all: true, verbatim: true }, (error, addresses) => {
      if (error) return callback(error);
      if (!addresses?.length || addresses.some(({ address }) => !isPublicAddress(address)
        && !(allowLoopback && ['localhost', '127.0.0.1', '::1'].includes(hostname) && ['127.0.0.1', '::1'].includes(address)))) {
        return callback(new Error('Provider DNS must resolve exclusively to public addresses; private networks are forbidden.'));
      }
      const family = typeof options === 'number' ? options : options?.family;
      const matching = family ? addresses.filter(entry => entry.family === family) : addresses;
      if (!matching.length) return callback(new Error('Provider DNS has no address in the requested family.'));
      if (options?.all) return callback(null, matching);
      callback(null, matching[0].address, matching[0].family);
    });
  };
}

const publicAgent = new Agent({ connect: { lookup: createPublicLookup() } });
const localAgent = new Agent({ connect: { lookup: createPublicLookup({ allowLoopback: true }) } });

export async function providerFetch(url, options = {}) {
  const { allowLocalHttp = process.env.LLM_ALLOW_LOCAL_HTTP === 'true', ...fetchOptions } = options;
  const target = new URL(url);
  const local = allowLocalHttp
    && target.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
  // Numeric hosts bypass socket lookup, so reject them here unless explicit local development.
  if ((!local && target.protocol !== 'https:') || target.username || target.password
    || (!local && net.isIP(target.hostname.replace(/^\[|\]$/g, '')))) {
    throw new Error('Provider transport requires a public HTTPS hostname.');
  }
  // The validated DNS result is the socket lookup result, preventing DNS rebinding.
  const response = await fetch(url, {
    ...fetchOptions,
    dispatcher: local ? localAgent : publicAgent,
    redirect: 'error',
    signal: fetchOptions.signal || AbortSignal.timeout(30000)
  });
  if (!response.body) return response;

  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2 * 1024 * 1024) {
        await reader.cancel();
        throw new Error('EXTERNAL_RESPONSE_TOO_LARGE');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return new Response(Buffer.concat(chunks), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}
