# Dağıtım ve İşletim Kılavuzu (Deployment Guide)

`llm-manager`, tek başına bir mikroservis/sidecar olarak konteynerde (Docker/Kubernetes) veya mevcut Node.js/Express uygulamalarının içine gömülü olarak çalıştırılabilir.

---

## 1. Docker ile Dağıtım

### Docker İmajını Derleme

```bash
docker build -t llm-manager .
```

### Konteyneri Çalıştırma

> [!IMPORTANT]
> Ağa açık (`--host 0.0.0.0`) çalışırken `LLM_ADMIN_PASSWORD` en az 12 karakter olmalıdır.
> Profil ve şifreleme anahtarlarının kalıcı olması için `/data` hacmi (volume) mutlaka bağlanmalıdır.

```bash
docker run -d \
  --name llm-manager \
  --restart unless-stopped \
  -p 8010:8010 \
  -v llm_data:/data \
  -e LLM_ADMIN_PASSWORD="GucluYoneticiParolasi123!" \
  -e LLM_ADMIN_USER="admin" \
  llm-manager
```

Konteyner başlatıldıktan sonra tarayıcıdan `http://localhost:8010/llm` adresine gidebilirsiniz.

---

## 2. Docker Compose ile Dağıtım

Aşağıdaki `docker-compose.yml` örneğini kullanarak servisi ayağa kaldırabilirsiniz:

```yaml
version: '3.8'

services:
  llm-manager:
    build: .
    image: llm-manager:latest
    container_name: llm-manager
    restart: always
    ports:
      - '8010:8010'
    volumes:
      - llm_data:/data
    environment:
      - PORT=8010
      - HOST=0.0.0.0
      - LLM_ADMIN_USER=admin
      - LLM_ADMIN_PASSWORD=GucluYoneticiParolasi123!
      - LLM_DATA_DIR=/data
      # Opsiyonel: SPA/ön yüz CORS izinleri
      # - LLM_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
      # Opsiyonel: Yerel model sunucuları (Ollama)
      # - LLM_ALLOWED_PRIVATE_HOSTS=192.168.1.50:11434
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:8010/api/llm/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 5s

volumes:
  llm_data:
```

Başlatmak için:
```bash
docker compose up -d
```

---

## 3. Kubernetes Dağıtımı

Kubernetes ortamında Pod'lar için liveness ve readiness probları `/api/llm/health` uç noktasına bağlanmalıdır:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llm-manager
  labels:
    app: llm-manager
spec:
  replicas: 1
  selector:
    matchLabels:
      app: llm-manager
  template:
    metadata:
      labels:
        app: llm-manager
    spec:
      containers:
        - name: llm-manager
          image: llm-manager:latest
          ports:
            - containerPort: 8010
          env:
            - name: LLM_ADMIN_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: llm-secrets
                  key: admin-password
            - name: LLM_DATA_DIR
              value: /data
          volumeMounts:
            - name: storage
              mountPath: /data
          livenessProbe:
            httpGet:
              path: /api/llm/health
              port: 8010
            initialDelaySeconds: 5
            periodSeconds: 15
          readinessProbe:
            httpGet:
              path: /api/llm/health
              port: 8010
            initialDelaySeconds: 5
            periodSeconds: 10
      volumes:
        - name: storage
          persistentVolumeClaim:
            claimName: llm-manager-pvc
```

---

## 4. Ortam Değişkenleri Referansı

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `LLM_ADMIN_PASSWORD` | - | Yönetim arayüzü parolası (ağa açıkken ≥ 12 karakter zorunlu) |
| `LLM_ADMIN_USER` | `admin` | Yönetici kullanıcı adı |
| `LLM_DATA_DIR` | `./data` | Profil ve şifreleme anahtarı klasörü (`/data`) |
| `LLM_CONFIG_ENCRYPTION_KEY` | - | 32 bayt (64 hex) özel AES-256 anahtarı (belirtilmezse otomatik üretilir) |
| `LLM_ALLOWED_ORIGINS` | - | CORS izinli origin listesi (virgülle ayrılmış veya `*`) |
| `LLM_ALLOWED_PRIVATE_HOSTS`| - | İzin verilen yerel LAN sunucuları (örn. `ollama.lan,192.168.1.20:11434`) |
| `LLM_HTTPS_PROXY` | - | Kurumsal HTTP/HTTPS vekil sunucu adresi |
| `PORT` | `8010` | HTTP dinleme portu |
| `HOST` | `127.0.0.1` | HTTP dinleme adresi (`0.0.0.0` tüm arayüzler) |

---

## 5. Sağlık ve İzleme Kontrolü

`/api/llm/health` uç noktası kimlik doğrulama gerektirmez ve yük dengeleyiciler, konteyner orkestratörleri tarafından izlenebilir:

```bash
curl -f http://localhost:8010/api/llm/health
```

Örnek yanıt:
```json
{
  "ok": true,
  "version": "1.0.0",
  "hasActiveProfile": true,
  "requestId": "c1f7a0b3-4e89-4a92-9b2f-7634f18d53b2"
}
```

---

## 6. Yedekleme ve Kurtarma

Tüm durum `/data` klasöründe iki dosyada tutulur:
1. `llm-profiles.json`: Şifreli profil tanımları ve ayarlar.
2. `llm-encryption.key`: AES-256-GCM profil şifreleme anahtarı.

> [!CAUTION]
> `llm-encryption.key` kaybedilirse profillerdeki API anahtarlarının şifresi **kesinlikle çözülemez**. Bu iki dosyayı her zaman birlikte yedekleyin.
