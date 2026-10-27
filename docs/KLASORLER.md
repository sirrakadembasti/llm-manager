# Klasörler ve temizlik

Depodaki doğrudan dosya yolları, importlar, npm komutları ve CI yapılandırması incelendi. Aşağıdaki değerlendirme 2026-10-27 tarihli yerel çalışma kopyasına aittir. Klasör silinmedi.

## Silinebilecek araç kalıntısı

| Klasör | Bulgu | Silme etkisi |
| --- | --- | --- |
| `.superpowers/` | Yalnız `sdd/.gitignore` içeriyor. Uygulama, testler, npm komutları ve CI tarafından kullanılmıyor; önceki asistan çalışma aracından kalmış. | Uygulamanın çalışmasını etkilemez. Gelecekte aynı araç gerekirse klasörü yeniden oluşturabilir. |

İncelenen uygulama klasörleri içinde başka işlevsiz klasör saptanmadı. Yalnız bir klasör adına import olmaması, onu gereksiz yapmaz; bazı dosyalar çalışma anında diskten okunur.

## Kullanılan klasörler

| Klasör | Görevi |
| --- | --- |
| `bin/` | `llm-manager` komutu. |
| `src/` | Çekirdek, sunucu, profil deposu ve entegrasyon kodu. `catalog/` sağlayıcı verisi; `transports/` sağlayıcı protokolleri; `store/` dosya deposu; `init/templates/` entegrasyon şablonları. |
| `public/` | Yönetim arayüzü; `i18n/` Türkçe ve İngilizce metinler. Dil başlangıç yapılandırmasıyla seçilir. |
| `examples/` | Çalışır örnekler; `npm start` doğrudan `examples/server.js` kullanır. |
| `types/` | TypeScript tipleri ve tip kontrolü. |
| `tests/` | Davranış ve güvenlik testleri; `fixtures/`, `helpers/`, `integration/` bu testlerce kullanılır. |
| `scripts/` | `check-catalog.js` ile isteğe bağlı sağlayıcı model listesi denetimi. Uygulama başlangıcında çağrılmaz. |
| `docs/` | Kılavuzlar ve politikalar; `roadmap/` görev kaydı ve elle çalıştırılan doğrulama betiği. |
| `.github/` | CI iş akışları. |
| `.git/` | Sürüm geçmişi ve Git verisi. |
| `node_modules/` | Kurulu bağımlılıklar; çalıştırmak ve geliştirmek için gerekir. Silinirse `npm ci` ile yeniden kurulmalıdır. |
| `data/` | Aktif profiller ve şifreleme anahtarı. Ayrıca önceki kontrollerin logları/raporları bulunuyor; klasörün tamamı geçici değildir. |

`data/` altındaki `docs-*.log`, `docs-*.json`, `compact-docs-review.md`, `check_docs.py`, `compact_docs.py` gibi belge çalışma çıktıları uygulama tarafından yüklenmez. Bunlar klasör değil, isteğe bağlı temizlenebilecek dosyalardır. Anahtar, profil, `.bak`, `.old-*` ve PATH yedeğini bu listeyle karıştırmayın.

`GEMINI.md` çalışma zamanı özelliği sağlamıyordu. Tekrarlanan durum notları kaldırıldı; yararlı geliştirme kuralları [katkı belgesine](CONTRIBUTING.md), görev kanıtları [yol haritasına](roadmap/YOL_HARITASI.md) bırakıldı.
