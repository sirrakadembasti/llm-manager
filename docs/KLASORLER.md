# Klasörler ve temizlik

Depodaki doğrudan dosya yolları, importlar, npm komutları ve CI yapılandırması incelendi. Proje Asistanı ve kod haritası konumları aşağıda açıklanır; tarihli çalışma/doğrulama kayıtları tek yol haritasındadır. Klasör silinmedi.

## Araç çıktıları

Önceki belgede anılan `.superpowers/` klasörü mevcut çalışma ağacında yoktur. `docs/graphify-out/` güncellenen statik kod haritasıdır; uygulamanın çalışması için zorunlu değildir. Araç önbellekleri veya geçici kaynak kopyaları bu klasöre konmaz. Yalnız bir klasör adına import olmaması, onu gereksiz yapmaz; bazı dosyalar çalışma anında diskten okunur.

## Kullanılan klasörler

| Klasör | Görevi |
| --- | --- |
| `bin/` | `llm-manager` komutu. |
| `src/` | Çekirdek, sunucu, profil deposu ve entegrasyon kodu. `project/` Proje Asistanı; `catalog/` sağlayıcı verisi; `transports/` sağlayıcı protokolleri; `store/` dosya deposu; `init/templates/` entegrasyon şablonları. |
| `public/` | Yönetim arayüzü; `i18n/tr.json` Türkçe metinleri içerir. Arayüz yalnız Türkçedir. |
| `examples/` | Çalışır örnekler; `npm start` doğrudan `examples/server.js` kullanır. |
| `types/` | TypeScript tipleri ve tip kontrolü. |
| `tests/` | Davranış ve güvenlik testleri; `fixtures/`, `helpers/`, `integration/` bu testlerce kullanılır. |
| `scripts/` | İsteğe bağlı katalog denetimi ve `check-project-assistant.mjs` ile sentetik gerçek motor/harita kabulü. Uygulama başlangıcında çağrılmaz. |
| `docs/` | Kılavuzlar ve politikalar; `roadmap/` tek görev/doğrulama kaydı; `graphify-out/` statik kod haritası. |
| `.github/` | CI iş akışları. |
| `.git/` | Sürüm geçmişi ve Git verisi. |
| `node_modules/` | Kurulu bağımlılıklar; çalıştırmak ve geliştirmek için gerekir. Silinirse `npm ci` ile yeniden kurulmalıdır. |
| `data/` | Aktif profiller ve şifreleme anahtarı. Ayrıca önceki kontrollerin logları/raporları bulunuyor; klasörün tamamı geçici değildir. |

`data/` altındaki `docs-*.log`, `docs-*.json`, `compact-docs-review.md`, `check_docs.py`, `compact_docs.py` gibi belge çalışma çıktıları uygulama tarafından yüklenmez. Bunlar klasör değil, isteğe bağlı temizlenebilecek dosyalardır. Anahtar, profil, `.bak`, `.old-*` ve PATH yedeğini bu listeyle karıştırmayın.

`GEMINI.md` çalışma zamanı özelliği sağlamıyordu. Tekrarlanan durum notları kaldırıldı; yararlı geliştirme kuralları [katkı belgesine](KATKI_REHBERI.md), görev kanıtları [yol haritasına](roadmap/YOL_HARITASI.md) bırakıldı.
