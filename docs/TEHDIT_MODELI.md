# Tehdit modeli

Aşağıda depoda mevcut kontroller listelenir. Planlanan kontroller garanti değildir.

## 1. Korunan varlıklar

| Varlık | Koruma / risk |
| --- | --- |
| Sağlayıcı anahtarları | Profil dosyasında AES-256-GCM; genel veri nesnelerinde/günlüklerde gösterilmez |
| Ana şifreleme anahtarı | Anahtar dosyası veya açık seçenek/ortam değişkeni; yedeklenmeli, erişimi kısıtlanmalı |
| Yönetici parolası | Sabit süreli SHA-256 karşılaştırması; yalnız sunucu ortamı/oturumu |
| İstemler / yanıtlar | Hassas çalışma verisi; içerik günlüğü kapalı |
| Kullanım bilgileri | İsteğe bağlı aylık sayı/token/süre; içerik veya kimlik bilgisi yok |

## 2. Tehditler ve mevcut kontroller

### 2.1 Sunucu tarafı istek sahteciliği (SSRF)

Sağlayıcı adresleri varsayılan HTTPS kullanır; soket düzeyindeki DNS çözümleme yerel/özel/bağlantı yereli IPv4/IPv6 adreslerini, yönlendirme takibi de yönlendirmeleri reddeder. Açık `allowedPrivateHosts` LAN hedeflerine izin verir; `allowLocalHttp` yerel geliştirme istisnasını korur. Vekilde DNS uzaktadır: bilinen katalog alan adları ve açık `allowedHosts`, yerel soket IP filtresinin yerini alır. Yöneticinin adres değişiklikleri yine doğrulanmalıdır.

### 2.2 Siteler arası istek sahteciliği (CSRF)

Değişiklik yapan HTTP uçları `X-LLM-CSRF: 1` ister. Farklı kaynaktan erişim CORS onayı gerektirir; joker hiçbir zaman kimlik bilgili yönetim erişimi vermez. CSP ve X-Frame-Options çerçevelemeyi önler. Ana uygulama kendi oturum çerezleri/SameSite ayarları ve uçlarından sorumludur.

### 2.3 Kimlik bilgisi ve sır sızıntısı

Genel profil nesneleri apiKey yerine hasApiKey gösterir. `redact()` kimlik bilgilerini/içeriği maskeler; logContent false kalır. Model önizlemesi anahtarları yinelemez; herkese açık sağlık ucu profil kimliğini/sırları içermez. Paket izin listesi testleri/veriyi/gerçek .env dosyasını dışlar. İç get/getActive sonuçları doğrudan döndürülmemeli veya günlüğe yazılmamalıdır. Tarayıcı Bearer belirteçleri herkese açıktır ve yalnız sohbet yetkisi verir.

### 2.4 Yetkisiz erişim ve kaba kuvvet

Yönetici ve sohbet kimlikleri ayrıdır; eksik Web kimlik doğrulaması erişimi kapalı bırakır. Basic başarısızlık kotası varsayılan 10/dk; chatAccess authenticated/admin/false olur. Kota havuzları süreç içidir ve doğru ana uygulama istemci kimliği/trust proxy ayarı gerektirir. TLS ve güçlü parola kullanın; dış ağa açılan sunucu en az 12 karakter ister.

### 2.5 Kaynak tüketimi ve maliyet istismarı

Varsayılanlar: 256 KiB gövde, 100 mesaj, toplam 200000/tek mesajda 100000 karakter; sağlayıcı JSON yanıtı 2 MiB ve SSE 8 MiB. Kota, süre/token sınırları, yalnız yöneticiye açık geçersiz kılmalar ve sağlayıcı isteğinin iptali istismarı sınırlar. Yeniden deneme/yedek profiller tek bütçe paylaşır ve çıktı başlayınca durur. Bunlar süreç başına kontrollerdir; dağıtık maliyet tavanı değildir.

### 2.6 Veri bütünlüğü ve yerel ortam

Atomik yazma, revizyon denetimi, sıralı yazma/süreç kilitleri ve Windows yeniden adlandırma denemeleri yerel dosyaları korur; eski kilit temizliği yaş/ölü PID denetimi ister. Tek nesillik .bak ve anahtar yedekleri kurtarmayı destekler. NFS/SMB garantisi yoktur; iki dosyalı anahtar döndürmesi kesilirse eşleşen eski çift gerekir. SDK doğrulaması geçici derleme dizinlerinin kalıcı kullanıcı PATH'ini değiştirmemesi için genel araç yolu kaydını kapatır.

### 2.7 Tedarik zinciri

Tehdit: Kötücül bağımlılık, kilit dosyası, CI eylemi veya yayıncı kimliği tüm korunan varlıkları açığa çıkarabilir.

**Mevcut kontroller:**

- Çalışma bağımlılığı `undici`, isteğe bağlı eş bağımlılık `express`; geliştirme araçları ayrıdır, risksiz değildir.
- `npm ci` depodaki `package-lock.json` dosyasını kullanır; bütünlük özetleri değişmiş baytları algılar, önceden kabul edilmiş kötücül kodu algılamaz.
- CI `npm audit --omit=dev` bilinen üretim açıklarını denetler; geliştirme bağımlılıklarını kapsamaz veya güvenilirliği kanıtlamaz.
- `npm pack --dry-run` ve dosya izin listesi test/veri/gerçek .env içeriğini dışlar.
- Yayın iş akışı yoktur. Yerel sürüm betikleri test/sürüm artırma/etiketleme yapar; eylem etiketleri değiştirilebilir. Yayın kaynağı, köken kanıtı ve imzalama zorunlu tutulmaz.

**Planlanan kontroller (uygulanmadı):**

- Geliştirme araçları ve kurulum betikleri dahil resmî bağımlılık/kilit dosyası incelemesi; güncelleme takibinin değerlendirilmesi.
- Eylemleri incelenmiş değişmez commit SHA'larına sabitleme ve sabitleme güncellemelerini inceleme.
- Yayıncı kimlik bilgisi/kaynak/etiket politikası belirleme; yayın otomasyonundan önce köken kanıtı ve çıktı imzalamayı değerlendirme.

### 2.8 Proje kaynakları, model talimatları ve dosya değişikliği

Bağlanan uygulamanın kaynakları ve model çıktısı güvenilmeyen veridir. Kaynak kökü yalnız host tarafından seçilir; yönetici API'si, CSRF ve sohbet kotası proje işlemlerine de uygulanır. Yol/realpath ve symlink kontrolleri, Git ignore, dosya/bağlam bütçeleri ve sır işaretleri erişimi sınırlar. Kaynak içindeki talimatlar yetki sayılmaz; model metni arayüzde HTML olarak işlenmez. Kaynak paylaşımı için ayrı kullanıcı onayı gerekir; filtreleme tüm sır veya kişisel verileri bulma garantisi vermez.

OpenCode yalnız temiz kopyada çalışır; bash, harici dizin, plugin/skill ve LSP kapalıdır. Gerçek sağlayıcı anahtarı ana süreçte kalır; rastgele belirteçli loopback köprüsü native protokolü mevcut ağ politikasından geçirir. Bunlar OS sandbox değildir; güvenilir yürütülebilir dosya ve servis hesabı sınırı gerekir. Host tanımlı komutlar da aynı işletim sistemi yetkileriyle çalışır.

Hedefe yazma/geri alma açık onay ve içerik sürümü eşleşmesi ister. Sonradan değişen dosyada işlem durur; kısmi yazmada yalnız beklenen içeriğe sahip dosyalar kurtarılır. Çok dosyalı ACID, başka süreçlerle atomik compare-and-swap ve çöküş sonrası kalıcı geri alma günlüğü yoktur. Görev kayıtları bellektedir; hard kill sonrası geçici kaynak kalıntıları işletmeci tarafından güvenli biçimde ele alınmalıdır. Graphify çıktıları kod yapısını açığa çıkarabilir; yalnız paylaşılması uygun kaynaklardan üretilmeli, sırlardan arındırılmalı ve yayın öncesi incelenmelidir.

## 3. İşletmeci sorumlulukları

TLS, servis hesabına özel dizinler ve şifreli/çevrimdışı yedekler kullanın. POSIX'te uygun dizin/dosya izinleri, Windows'ta ACL uygulayın. Profil ve ana anahtar yedeklerini eşleştirin. Ana uygulama oturumlarını ve yönlendirmesini koruyun; güvenilir ask/handle çağrılarını doğrudan anonim kullanıcıya açmayın. [Dağıtım](DAGITIM.md) · [Özel güvenlik açığı bildirimi](GUVENLIK.md).
