# syntax=docker/dockerfile:1
FROM node:22-alpine AS base

# Üretim ortam değişkenleri
ENV NODE_ENV=production \
    PORT=8010 \
    HOST=0.0.0.0 \
    LLM_DATA_DIR=/data

WORKDIR /app

# Bağımlılık dosyalarını kopyala
COPY package*.json ./

# Bağımlılıkları kur (express peer dependency bağımsız sunucu için zorunludur)
RUN npm ci --omit=dev && \
    npm install express@^4.19.2 --no-save --no-package-lock

# Uygulama kaynak kodlarını kopyala
COPY bin ./bin
COPY src ./src
COPY public ./public
COPY types ./types
COPY LICENSE ./LICENSE

# Veri klasörünü oluştur ve izinleri ayarla
RUN mkdir -p /data && chown -R node:node /app /data

# Veri hacmini tanımla
VOLUME ["/data"]

# Güvenlik için non-root kullanıcıya geç
USER node

# Portu dışa aç
EXPOSE 8010

# Sağlık kontrolü: GET /api/llm/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8010) + '/api/llm/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Sunucuyu başlat
CMD ["node", "bin/llm-manager.js", "--host", "0.0.0.0", "--port", "8010", "--data-dir", "/data"]
