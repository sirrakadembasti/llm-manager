// Recognize only documented key types on official hosts; custom gateways may
// use different credentials. Never include credentials in an error or DTO.
export function credentialEndpointProblem(provider, baseURL, apiKey) {
  if (provider !== 'xiaomi_mimo') return null;
  const host = new URL(baseURL).hostname.toLowerCase();
  const tokenHost = /^token-plan-(cn|sgp|ams)\.xiaomimimo\.com$/.test(host);
  const paygHost = host === 'api.xiaomimimo.com';
  if (tokenHost && apiKey.startsWith('sk-')) return 'Bu adres Token Plan anahtarı gerektirir. PAYG anahtarınız için PAYG hizmetini seçin.';
  if (paygHost && /^(tp|ttp)-/.test(apiKey)) return 'Bu anahtar Token Plan türündedir. Xiaomi konsolunuzdaki Token Plan bölgesini ve adresini seçin.';
  return null;
}
