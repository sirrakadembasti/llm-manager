import { ErrorCodes } from './errors.js';

export const MESSAGES = {
  tr: {
    [ErrorCodes.RUNTIME_OPTIONS_INVALID]: 'Geçersiz çalışma zamanı seçenekleri.',
    [ErrorCodes.PROFILE_INVALID]: 'Geçersiz profil verisi.',
    [ErrorCodes.PROFILE_NOT_FOUND]: 'Profil bulunamadı.',
    [ErrorCodes.PROFILE_CONFLICT]: 'Profil başka bir işlem tarafından değiştirildi.',
    [ErrorCodes.STORE_LOCKED]: 'Depo dosyası şu anda başka bir işlem tarafından kilitli.',
    [ErrorCodes.STORE_CORRUPT]: 'Profil veri dosyası bozuk veya geçersiz JSON içeriyor.',
    [ErrorCodes.STORE_DECRYPT_FAILED]:
      'Kayıtlı API anahtarı çözülemedi. LLM_CONFIG_ENCRYPTION_KEY ayarını ve profil dosyasıyla eşleşen şifreleme anahtarı yedeğini kontrol edin.',
    [ErrorCodes.STORE_VERSION_UNSUPPORTED]: 'Desteklenmeyen profil depolama sürümü.',
    [ErrorCodes.MESSAGES_INVALID]: 'Geçerli bir mesaj listesi (messages) veya prompt zorunludur.',
    [ErrorCodes.FORBIDDEN]: 'Yönetici yetkisi gerekli.',
    [ErrorCodes.RATE_LIMITED]: 'Çok fazla istek yapıldı. Lütfen biraz bekleyin.',
    [ErrorCodes.CSRF_REQUIRED]: 'İstek doğrulama başlığı eksik.',
    [ErrorCodes.BODY_TOO_LARGE]: 'Gövde boyutu sınırı aştı.',
    [ErrorCodes.BODY_INVALID]: 'Geçersiz JSON gövdesi.',
    [ErrorCodes.LLM_TIMEOUT]: 'Model yanıt süresi zaman aşımına uğradı.',
    [ErrorCodes.LLM_ABORTED]: 'İstek kullanıcı tarafından iptal edildi.',
    [ErrorCodes.LLM_UPSTREAM_UNAVAILABLE]: 'Sağlayıcı servisi şu anda yanıt vermiyor (5xx).',
    [ErrorCodes.LLM_NETWORK]: 'Model sağlayıcısına bağlanılamadı.',
    [ErrorCodes.LLM_DNS_BLOCKED]: 'Hedef sunucu adresi güvenlik politikası gereği engellendi.',
    [ErrorCodes.LLM_CONTENT_FILTERED]: 'Yanıt sağlayıcının içerik veya güvenlik filtresi tarafından durduruldu.',
    [ErrorCodes.LLM_RESPONSE_TOO_LARGE]: 'Sağlayıcı yanıt boyutu sınırı aştı.',
    [ErrorCodes.AI_CREDENTIAL_ENDPOINT_MISMATCH]: 'Kimlik bilgileri ile API adresi uyumsuz.',
    [ErrorCodes.PARAMS_INVALID]: 'Geçersiz istek parametreleri.',
    [ErrorCodes.API_KEY_REQUIRED]: 'API anahtarı girilmelidir.'
  },
  en: {
    [ErrorCodes.RUNTIME_OPTIONS_INVALID]: 'Invalid runtime options.',
    [ErrorCodes.PROFILE_INVALID]: 'Invalid profile data.',
    [ErrorCodes.PROFILE_NOT_FOUND]: 'Profile not found.',
    [ErrorCodes.PROFILE_CONFLICT]: 'Profile was modified by another operation.',
    [ErrorCodes.STORE_LOCKED]: 'Store file is currently locked by another process.',
    [ErrorCodes.STORE_CORRUPT]: 'Profile data file is corrupted or contains invalid JSON.',
    [ErrorCodes.STORE_DECRYPT_FAILED]:
      'The saved API key could not be decrypted. Check LLM_CONFIG_ENCRYPTION_KEY and the encryption key backup matching the profile file.',
    [ErrorCodes.STORE_VERSION_UNSUPPORTED]: 'Unsupported profile storage version.',
    [ErrorCodes.MESSAGES_INVALID]: 'A valid list of messages or prompt is required.',
    [ErrorCodes.FORBIDDEN]: 'Administrator access required.',
    [ErrorCodes.RATE_LIMITED]: 'Too many requests. Please wait a moment.',
    [ErrorCodes.CSRF_REQUIRED]: 'CSRF verification header is missing.',
    [ErrorCodes.BODY_TOO_LARGE]: 'Payload size exceeded the limit.',
    [ErrorCodes.BODY_INVALID]: 'Invalid JSON payload.',
    [ErrorCodes.LLM_TIMEOUT]: 'Model response timed out.',
    [ErrorCodes.LLM_ABORTED]: 'Request was aborted by the client.',
    [ErrorCodes.LLM_UPSTREAM_UNAVAILABLE]: 'Upstream provider is temporarily unavailable (5xx).',
    [ErrorCodes.LLM_NETWORK]: 'Failed to connect to the model provider.',
    [ErrorCodes.LLM_DNS_BLOCKED]: 'Destination address blocked by security policy.',
    [ErrorCodes.LLM_CONTENT_FILTERED]: 'Response was blocked by content or safety filters.',
    [ErrorCodes.LLM_RESPONSE_TOO_LARGE]: 'Provider response exceeded payload size limit.',
    [ErrorCodes.AI_CREDENTIAL_ENDPOINT_MISMATCH]: 'Credentials and endpoint mismatch.',
    [ErrorCodes.PARAMS_INVALID]: 'Invalid request parameters.',
    [ErrorCodes.API_KEY_REQUIRED]: 'API key is required.'
  }
};

export function getErrorMessage(code, locale = 'tr', fallback = null) {
  const normalizedLocale = locale === 'en' ? 'en' : 'tr';
  return MESSAGES[normalizedLocale]?.[code] || fallback || MESSAGES.tr[code] || 'Bir hata oluştu.';
}
