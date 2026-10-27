# Dağıtım ve işletim

Node.js **22.12+** gerekir. Core Express'siz kullanılabilir; aşağıdaki CLI servisleri için paket ve Express kurulu olmalıdır:

```sh
npm install github:sirrakadembasti/llm-manager "express@^4.19.2"
```

Üretimde TLS ters proxy, güçlü parola ve servis hesabına özel veri dizini kullanın. Ağa açık CLI en az **12 karakter** parola ister. Varsayılan sayfa `/llm`, sırsız public health `/api/llm/health`.

## Docker

```sh
docker build -t llm-manager .
docker run -d --name llm-manager --restart unless-stopped \
  -p 8010:8010 -v llm_data:/data \
  -e LLM_ADMIN_PASSWORD="$LLM_ADMIN_PASSWORD" llm-manager
```

Parolayı önce kabuk/secret yöneticisinde tanımlayın. İmaj node:22-alpine, non-root `node`, `/data` volume ve healthcheck içerir. Dockerfile Express'i kurar. Varsayılan CMD host/port/veri için `0.0.0.0:8010` ve `/data` kullanır; portu değiştirmek için CMD ve healthcheck'i birlikte uyarlayın, yalnız PORT env'ine güvenmeyin.

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

`docker compose up -d` ile başlatın. Kubernetes'te aynı imajı Secret'tan parola, `/data` PVC ve 8010 portundaki `/api/llm/health` liveness/readiness problarıyla kullanın. Yerel dosya deposunu çok düğümlü NFS/SMB depolamayla paylaşmayın; uygun host store verin.

## CLI ortamı

CLI çalışma dizininin `.env` dosyasını okur. Kaynaktaki `npm start` örneği için parola süreç ortamında tanımlanır; her seçenek her giriş noktasında otomatik okunmaz.

| Değişken | Amaç / varsayılan |
| --- | --- |
| `LLM_ADMIN_PASSWORD`, `LLM_ADMIN_USER` | Parola zorunlu; kullanıcı admin |
| `HOST`, `PORT` | CLI host 127.0.0.1, port 8010; bayraklar öncelikli |
| `LLM_DATA_DIR` | CLI veri dizini; varsayılan ./data |
| `LLM_CONFIG_PATH`, `LLM_CONFIG_KEY_PATH` | Açık profil/anahtar dosyası yolları |
| `LLM_CONFIG_ENCRYPTION_KEY` | Opsiyonel 32 bayt anahtar; yoksa anahtar dosyası |
| `LLM_CHAT_TOKENS` | Virgülle ayrılmış sohbet Bearer belirteçleri |
| `LLM_ALLOWED_ORIGINS` | Açık origin listesi; wildcard yalnız sohbet/credentials yok |
| `LLM_ALLOWED_PRIVATE_HOSTS` | Açık LAN host veya host:port listesi |
| `LLM_HTTPS_PROXY`, `LLM_USAGE_LOG` | Proxy; true ile içeriksiz kullanım kaydı |

CLI bayrakları: `--host`, `--port`, `--data-dir`, `--user`, `--password`, `--chat-token`, `--cors`. Parolayı argüman yerine servis ortamından verin; shell geçmişine yazmayın.

## PM2

Host proje `.env` dosyası hazırken:

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

Örnek host `/opt/llm-host`, servis hesabı `llm`:

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

Unit'i `/etc/systemd/system/llm-manager.service` olarak kaydedin; yolları uyarlayın. Hesaba veri yazma izni, `.env` için 0600 verin. `systemctl daemon-reload`, `systemctl enable --now llm-manager`; izleme: `journalctl -u llm-manager`. [systemd ortamı](https://www.freedesktop.org/software/systemd/man/256/systemd.exec.html).

## Windows / NSSM

Yönetici PowerShell'inde, Node/NSSM ve host kurulu iken:

```powershell
nssm install LLMManager 'C:\Program Files\nodejs\node.exe'
nssm set LLMManager AppDirectory 'C:\llm-host'
nssm set LLMManager AppParameters 'C:\llm-host\node_modules\@sirrakadembasti\llm-manager\bin\llm-manager.js'
nssm set LLMManager Start SERVICE_AUTO_START
nssm start LLMManager
```

Boşluklu betik yolunu AppParameters içinde de tırnaklayın. Parola çalışma dizininin `.env` dosyasında kalır. NSSM'de servis hesabını seçip veri/env için gerekli NTFS ACL'lerini verin; 0600 yeterli değildir. Registry ortamı gerekiyorsa mevcut sistem ortamını koruyan `AppEnvironmentExtra` kullanın. [NSSM](https://nssm.cc/usage).

## İzleme, yedek ve durdurma

`curl -f http://127.0.0.1:8010/api/llm/health`: ok/version/hasActiveProfile/requestId döner; profil/sır döndürmez. Health'in 200 olması canlı sağlayıcının çalıştığını kanıtlamaz.

`llm-profiles.json` ve `llm-encryption.key` birlikte yedeklenir. `.bak`, `.old-<tarih>-<kimlik>` ve gerekiyorsa kullanım kayıtlarını yedek politikasına ekleyin; anahtar arşivini herkese açmayın. Bozuk depoda mevcut dosyayı koruyun ve eşleşen profil+anahtar çiftini geri yükleyin. Anahtar kaybında şifreli profiller kurtarılamaz. Yazma ortasında zorla sonlandırma sonrası tek dosyayı rastgele geri almayın.

CLI SIGINT/SIGTERM'de yeni bağlantıları kapatıp işleri bekler; 10 sn sonra çıkış sınırı vardır. Servis yöneticisine en az bu süreyi tanıyın. Windows zorla sonlandırma, sinyal callback'lerini çalıştırmayabilir. Programatik gömülü sunucuda kendi kapanış akışınızdan `await instance.close()` çağırın.

Bu örneklerin dosya sözleşmesi testlidir; gerçek Docker/servis kurulumu yerel kabulde çalıştırılmış değildir. [Kanıt ve sınırlar](roadmap/YOL_HARITASI.md#kabul-ve-doğrulama).
