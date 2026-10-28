# Graphify kod haritası

Bu klasör LLM Manager deposunun paylaşılabilir kod kaynaklarından üretilen statik haritayı içerir. Uygulamadaki Proje Asistanı'nın çalışma anı haritasından ayrıdır. Tarihli üretim kapsamı, sayısal sonuçlar ve doğrulamalar [tek yol haritasında](../roadmap/YOL_HARITASI.md) tutulur.

| Dosya | İçerik |
| --- | --- |
| `graph.html` | Tarayıcıda açılabilen etkileşimli harita; görselleştirme kitaplığı için internet bağlantısı gerekebilir. |
| `graph.json` | Graphify'ın düğüm, ilişki ve topluluk verisi. |
| `GRAPH_REPORT.md` | Araç tarafından üretilen gezinme/merkez sembol raporu; otomatik metin özgün dilindedir. |
| `.graphify_analysis.json` | Topluluk, merkez sembol ve ilişki analizi. |
| `manifest.json` | Graphify'ın kaynak değişim metaverisi; zamanlar temiz kopyaya aittir. |
| `source-manifest.json` | Depoya göre kaynak yolları, SHA-256 özetleri, araç sürümü ve üretim yöntemi. |

Üretim, Git indeksindeki onaylanmış `src`, `bin`, `public`, `types`, `examples`, `scripts`, `tests`, `.github` kaynakları ve `package.json` üzerinden temiz geçici kopyada yapılır. `.env*`, `data`, anahtarlar, bağımlılık dizinleri, kilit dosyası ve üretilmiş çıktılar alınmaz. Testlerdeki sentetik değerler kaynak kodunun parçasıdır; gerçek yerel sırlarla eşleşme kontrolü yapılmadan çıktı paylaşılmaz. Kişisel HOME/APPDATA ayarları ve LLM anahtarları araca aktarılmaz.

Graphify kurulu ayrı Python ortamında, temiz kaynak kopyası ve ayrı çıktı diziniyle:

```sh
python -m graphify extract /clean/source --code-only --max-workers 1 --out /temporary/result
python -m graphify cluster-only /temporary/result --no-label
```

Her iki komutta `GRAPHIFY_BACKEND=none` kullanılır; LLM ile belge analizi veya topluluk adlandırması yapılmaz. Yalnız yukarıdaki paylaşılabilir sonuç dosyaları bu klasöre alınır; `cache/` ve geçici dizine işaret eden `.graphify_root` kopyalanmaz. Mutlak makine yolları ve sırlar kontrol edilir, `source-manifest.json` yeniden üretilir. Gerçek çalışma dizininde bu komutları filtresiz çalıştırmayın.

Harita statik çıkarıma dayanır; dinamik çağrılar, metin içindeki şablonlar veya desteklenmeyen dil yapıları eksik/varsayımsal olabilir. Bazı `source_file` değerleri gerçek dosya yerine harici paket, Node modülü veya TypeScript import belirtecidir. Hiç sembol üretmeyen dosyalar bulunabilir. Kaynak yolları depo köküne göredir; güncel kaynak ve testler esas alınmalıdır.
