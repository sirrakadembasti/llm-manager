# Güvenlik politikası

## Desteklenen sürümler

Yalnız en güncel ana/ara sürüme etkin olarak güvenlik güncellemesi sağlanır.

| Sürüm | Destekleniyor |
| --- | --- |
| 1.x.x | Evet |
| < 1.0 | Hayır |

Yerel `2.0.0` **yayımlanmamıştır**; yayımlanmış 2.x sürümünün kanıtı değildir. Bu durum başka bir sürüm dalına bakım veya eski sürüme düzeltme taşıma taahhüdü eklemez. Geliştirme sürümündeki açıkları da aşağıdaki özel kanallardan bildirin; commit ve yerel sürümü ekleyin.

## Güvenlik açığı bildirme

Sırları veya istismar ayrıntılarını herkese açık sorun kayıtlarında paylaşmayın. [Özel GitHub güvenlik bildirimi](https://github.com/sirrakadembasti/llm-manager/security/advisories/new) kullanın veya `sirrakadembasti@users.noreply.github.com` adresine `[SECURITY VULNERABILITY] llm-manager` konusuyla e-posta gönderin.

Etkiyi, yeniden üretim adımlarını/kavram kanıtını, etkilenen bileşeni, işletim sistemi ve Node sürümünü ekleyin. Alındı bildirimi hedefi 48 saat, ön değerlendirme hedefi 5 iş günüdür. Herkese açıklamadan önce düzeltme/yayını koordine edin.

## Güvenlik mimarisi ilkeleri

- **Sır sızıntısını önleme:** Anahtar/parolalar sunucuda kalır; günlükler sırları ve mesaj içeriğini maskeler.
- AES-256-GCM: 12 bayt IV, 16 bayt doğrulama etiketi; profil ve şifreleme anahtarı birlikte yedeklenir.
- HTTPS ve soket/DNS SSRF filtresi uygulanır; özel adresler açık izin gerektirir. Vekil DNS'i yerel IP filtresi yerine hedef izin listesi kullanır.
- Değişiklik yapan HTTP istekleri `X-LLM-CSRF: 1` gerektirir; yönetici ve sohbet kimlikleri ayrıdır.
- Üretim TLS, güçlü kimlik bilgileri ve yalnız servis hesabına açık dosyalar gerektirir. Windows ACL ister; POSIX 0600 tek başına yeterli değildir.
- Proje Asistanı kaynak kökü sunucu tarafından açıkça seçilir. `.env`, `data`, anahtarlar ve bağlantılı dizinler dışlanır; içerik filtresi sırları kusursuz saptama garantisi vermez. Kaynakların sağlayıcıya gönderilmesi ayrıca kullanıcı onayı ister.
- OpenCode gerçek API anahtarını almaz; süreli yerel köprü belirteci kullanır. Dosyalar geçici kopyada hazırlanır, hedefe uygulama ve geri alma ayrı onay ve sürüm eşleşmesi gerektirir. Motor/komut süreçleri işletim sistemi sandbox'ı değildir; güvenilir araç ve host komutları kullanın.

Mevcut ve planlanan kontroller: [tehdit modeli](TEHDIT_MODELI.md). Yerel güvenlik testi/denetimi uzak dağıtımın güvenliğini kanıtlamaz.
