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
  }
};

// İkinci parametre eski çağrıların üçüncü fallback değerini korumak için tutulur.
export function getErrorMessage(code, _legacyLocale = 'tr', fallback = null) {
  return MESSAGES.tr[code] || fallback || 'Bir hata oluştu.';
}
