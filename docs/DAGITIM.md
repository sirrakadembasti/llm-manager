# Dağıtım ve işletim

Node.js **22.12+** gerekir. Çekirdek Express olmadan kullanılabilir; aşağıdaki CLI servisleri için paket ve Express kurulu olmalıdır:

```sh
npm install github:sirrakadembasti/llm-manager "express@^4.19.2"
```

Üretimde TLS ters vekili, güçlü parola ve servis hesabına özel veri dizini kullanın. Ağa açık CLI en az **12 karakter** parola ister. Varsayılan sayfa `/llm`, sır içermeyen herkese açık sağlık ucu `/api/llm/health`.

## Docker

```sh
docker build -t llm-manager .
docker run -d --name llm-manager --restart unless-stopped \
  -p 8010:8010 -v llm_data:/data \
  -e LLM_ADMIN_PASSWORD="$LLM_ADMIN_PASSWORD" llm-manager
```

Parolayı önce kabuk/sır yöneticisinde tanımlayın. İmaj node:22-alpine, kök yetkisi olmayan `node` kullanıcısı, `/data` birimi ve sağlık denetimi içerir. Dockerfile Express'i kurar. Varsayılan CMD adres/port/veri için `0.0.0.0:8010` ve `/data` kullanır; portu değiştirmek için CMD ve sağlık denetimini birlikte uyarlayın, yalnız PORT ortam değişkenine güvenmeyin.

Compose:

```yaml
services:
  llm-manager:
    build: .
    restart: unless-stopped
    ports: ['8010:8010']
    volumes: ['llm_data:/data']
    environment:
      LLM_ADMIN_PASSWORD: ${LLM_ADMIN_PASSWORD:?Parola gerekli}
volumes:
  llm_data:
```

`docker compose up -d` ile başlatın. Kubernetes'te aynı imajı Secret'tan parola, `/data` PVC ve 8010 portundaki `/api/llm/health` canlılık/hazır olma yoklamalarıyla kullanın. Yerel dosya deposunu çok düğümlü NFS/SMB depolamayla paylaşmayın; uygun ana uygulama deposu verin.

## CLI ortamı

CLI ve kaynaktaki `npm start`, çalışma dizininin `.env` dosyasını okur; mevcut süreç ortamı önceliklidir. Her seçenek her giriş noktasında otomatik okunmaz.

| Değişken | Amaç / varsayılan |
| --- | --- |
| `LLM_ADMIN_PASSWORD`, `LLM_ADMIN_USER` | Parola zorunlu; kullanıcı admin |
| `HOST`, `PORT` | CLI adresi 127.0.0.1, port 8010; bayraklar öncelikli |
| `LLM_DATA_DIR` | CLI veri dizini; varsayılan ./data |
| `LLM_CONFIG_PATH`, `LLM_CONFIG_KEY_PATH` | Açık profil/anahtar dosyası yolları |
| `LLM_CONFIG_ENCRYPTION_KEY` | İsteğe bağlı 32 bayt anahtar; yoksa anahtar dosyası |
| `LLM_CHAT_TOKENS` | Virgülle ayrılmış sohbet Bearer belirteçleri |
| `LLM_ALLOWED_ORIGINS` | Açık kaynak adresi listesi; joker yalnız sohbet içindir ve kimlik bilgisi taşımaz |
| `LLM_ALLOWED_PRIVATE_HOSTS` | Açık LAN sunucu veya sunucu:port listesi |
| `LLM_HTTPS_PROXY`, `LLM_USAGE_LOG` | Vekil; true ile içeriksiz kullanım kaydı |
| `LLM_PROJECT_ROOT` | Proje Asistanı için açık kaynak kökü; ayarlanmazsa özellik kapalıdır |
| `LLM_OPENCODE_PATH` | İsteğe bağlı OpenCode yürütülebilir dosya yolu |
| `LLM_GRAPHIFY_PYTHON` | İsteğe bağlı, Graphify kurulu Python yürütülebilir dosyası |

CLI bayrakları: `--host`, `--port`, `--data-dir`, `--user`, `--password`, `--chat-token`, `--cors`, `--project-root`. Parolayı argüman yerine servis ortamından verin; kabuk geçmişine yazmayın.

Proje Asistanı için servis hesabının bağlı kaynak dizinine gerekli okuma/yazma yetkilerini ve sahipli geçici dizine erişimini tanımlayın. OpenCode/Graphify imaja otomatik eklenmez; Docker kullanılıyorsa ayrıca kurulmalı ve kaynak kökü açıkça bağlanmalıdır. `data` birimini kaynak kökü yapmayın. Motor izinleri OS sandbox değildir; hostun tanımladığı doğrulama komutları servis hesabı yetkileriyle çalışır. Görev/geri alma kayıtları bellektedir ve yeniden başlatmada silinir. Kapanışta paket entegrasyonunun `close()` metodunu çağırın.

## PM2

Ana projenin `.env` dosyası hazırken:

```sh
npm install -g pm2
pm2 start node_modules/@sirrakadembasti/llm-manager/bin/llm-manager.js --name llm-manager --cwd "$PWD"
pm2 startup
# Gösterilen platform komutunu uygulayın:
pm2 save
pm2 logs llm-manager
```

Node yükselince başlangıç kaydını yenileyin. [PM2](https://pm2.keymetrics.io/docs/usage/startup/).

## systemd

Örnek ana uygulama `/opt/llm-host`, servis hesabı `llm`:

```ini
[Unit]
Description=LLM Manager
After=network-online.target
[Service]
User=llm
WorkingDirectory=/opt/llm-host
EnvironmentFile=/opt/llm-host/.env
ExecStart=/usr/bin/node /opt/llm-host/node_modules/@sirrakadembasti/llm-manager/bin/llm-manager.js
Restart=on-failure
TimeoutStopSec=15
[Install]
WantedBy=multi-user.target
```

Birim dosyasını `/etc/systemd/system/llm-manager.service` olarak kaydedin; yolları uyarlayın. Hesaba veri yazma izni, `.env` için 0600 verin. `systemctl daemon-reload`, `systemctl enable --now llm-manager`; izleme: `journalctl -u llm-manager`. [systemd ortamı](https://www.freedesktop.org/software/systemd/man/256/systemd.exec.html).

## Windows / NSSM

Yönetici PowerShell'inde, Node/NSSM ve ana uygulama kurulu iken:

```powershell
nssm install LLMManager 'C:\Program Files\nodejs\node.exe'
nssm set LLMManager AppDirectory 'C:\llm-host'
nssm set LLMManager AppParameters 'C:\llm-host\node_modules\@sirrakadembasti\llm-manager\bin\llm-manager.js'
nssm set LLMManager Start SERVICE_AUTO_START
nssm start LLMManager
```

Boşluklu betik yolunu AppParameters içinde de tırnaklayın. Parola çalışma dizininin `.env` dosyasında kalır. NSSM'de servis hesabını seçip veri/ortam dosyaları için gerekli NTFS ACL'lerini verin; 0600 yeterli değildir. Kayıt defteri ortamı gerekiyorsa mevcut sistem ortamını koruyan `AppEnvironmentExtra` kullanın. [NSSM](https://nssm.cc/usage).

## İzleme, yedek ve durdurma

`curl -f http://127.0.0.1:8010/api/llm/health`: ok/version/hasActiveProfile/requestId döner; profil/sır döndürmez. Sağlık ucunun 200 döndürmesi canlı sağlayıcının çalıştığını kanıtlamaz.

`llm-profiles.json` ve `llm-encryption.key` birlikte yedeklenir. `.bak`, `.old-<tarih>-<kimlik>` ve gerekiyorsa kullanım kayıtlarını yedek politikasına ekleyin; anahtar arşivini herkese açmayın. Bozuk depoda mevcut dosyayı koruyun ve eşleşen profil+anahtar çiftini geri yükleyin. Anahtar kaybında şifreli profiller kurtarılamaz. Yazma ortasında zorla sonlandırma sonrası tek dosyayı rastgele geri almayın.

CLI SIGINT/SIGTERM'de yeni bağlantıları kapatıp işleri bekler; 10 sn sonra çıkış sınırı vardır. Servis yöneticisine en az bu süreyi tanıyın. Windows zorla sonlandırma, sinyal geri çağrılarını çalıştırmayabilir. Programatik gömülü sunucuda kendi kapanış akışınızdan `await instance.close()` çağırın.

Bu örneklerin dosya sözleşmesi testlidir; gerçek Docker/servis kurulumu yerel kabulde çalıştırılmış değildir. [Kanıt ve sınırlar](roadmap/YOL_HARITASI.md#kabul-ve-doğrulama).
