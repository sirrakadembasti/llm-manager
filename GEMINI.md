# Proje Hafızası: llm-manager

## Ana hedef (kullanıcı kararı, 2026-10-19)
- Bu uygulama **bağımsız bir API / eklenti** olacak. Önceden türetildiği uygulamanın (XFactor) tüm bağımlılıkları, adlandırmaları ve varsayımları koparılacak.
- **Her GitHub reposundaki uygulamaya** (Express tabanlı) entegre edilebilir ve tek başına çalıştırılabilir olacak.
- **Basit ama çalışır** bir eklenti: az kurulum, net README, sıfır host-proje bağımlılığı.
- Sıra: önce kendi tespit ettiğim gözlemlerin düzeltilmesi, adım adım.

## Çalışma kuralları
- Her değişiklikten sonra `npm test` ile doğrula.
- Mevcut yorum ve dokümantasyon, değişiklikle ilgisi yoksa korunur.
- API anahtarı hiçbir zaman tarayıcıya/listeye/loglara dönmez.

## Düzeltme listesi (sırayla)
1. XFactor izlerini kaldır (paket adı, CSRF başlığı, README, yorumlar).
2. `index.js` gereksiz koşul (`'models' : 'models'`) temizliği.
3. Yönetim HTML/JS dosyalarını her istekte okumak yerine önbelleğe al.
4. `setup.js` `.env.example` ve `.env` zorunluluğunu kaldır; bağımsız anahtar dosyası.
5. Bağımsız paket metaverisi (isim, lisans, .env.example, .gitignore, bin/start).
6. README'yi bağımsız kullanıma göre güncelle, testleri çalıştır.
