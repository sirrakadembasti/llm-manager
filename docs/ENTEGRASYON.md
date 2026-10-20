# 5 Senaryoda Kolay Entegrasyon Kılavuzu (`npx llm-manager init`)

Kaynak koduna sahip olduğunuz herhangi bir projeye `llm-manager` eklemek için **import yollarını veya ayarları ezberlemenize gerek yoktur.**

Kurulum sihirbazı (`npx llm-manager init`) projenizin tipini otomatik algılar ve projenizin içine hazır `llm.js` (veya Python için `llm_client.py`) dosyasını kendisi oluşturur. Size sadece kendi dosyanızda `askLLM('soru')` fonksiyonunu çağırmak kalır.

---

## Ortak Kurulum (Tüm Projeler İçin 2 Komut)

Kendi projenizin klasöründe terminali açın ve şu 2 komutu çalıştırın:

```bash
# 1. Paketi projenize kurun
npm install github:sirrakadembasti/llm-manager

# 2. Otomatik kurulum sihirbazını çalıştırın (projenize llm.js dosyasını oluşturur)
npx llm-manager init --password 12345
```

---

## Senaryo 1: Express.js Sunucu Uygulaması

`npx llm-manager init` komutu projenizin ana dizininde **`llm.js`** dosyasını otomatik oluşturur (projeniz eski `require` kullansa da yeni `import` kullansa da otomatik uyum sağlar).

### Hangi dosyaya ne yapıştıracağım?
Kendi projenizin ana sunucu dosyasını (**`server.js`**, **`app.js`** veya **`index.js`**) açın:

```js
import express from 'express';
import { setupLLM, askLLM } from './llm.js'; // <-- 1. BUNU EKLEYİN

const app = express();
app.use(express.json());

setupLLM(app); // <-- 2. BUNU EKLEYİN (/llm yönetim ekranı açılır)

// 3. Kendi endpoint'inizde yapay zekaya soru sorun:
app.post('/ozetle', async (req, res) => {
  const cevap = await askLLM(`Şu metni özetle: ${req.body.metin}`);
  res.json({ ozet: cevap });
});

app.listen(3000);
```
* **API Anahtarı Nereden Girilir?** Tarayıcıdan `http://localhost:3000/llm` adresine girip (`admin` / `12345`) API anahtarınızı ve modelinizi seçin.

---

## Senaryo 2: Tek Sayfalık (React, Vue, Vite) veya Statik Web Uygulaması

`npx llm-manager init` komutu **`src/llm.js`** (veya `llm.js`) dosyasını oluşturur ve `package.json` içine `"llm"` komutunu ekler.

### Nasıl çalıştırılır ve hangi dosyaya yapıştırılır?

**Adım 1:** Terminalde yönetim servisini başlatın:
```bash
npm run llm
```
*(Tarayıcıdan `http://127.0.0.1:8010/llm` adresine girip API anahtarınızı bir kez kaydedin ve etkinleştirin.)*

**Adım 2:** Kendi React/Vue/JS bileşen dosyanızı (ör. **`src/App.jsx`** veya **`main.js`**) açın ve doğrudan `askLLM` çağırın:
```js
import { askLLM } from './llm.js'; // <-- 1. BUNU EKLEYİN

async function butonaTiklandi() {
  const cevap = await askLLM('Bana kısa bir fıkra anlat.'); // <-- 2. TEK SATIRLA ÇAĞIRIN
  console.log(cevap);
}
```

---

## Senaryo 3: Full-Stack Uygulamalar (Next.js)

`npx llm-manager init` komutu Next.js projenizde **3 dosyayı kendi otomatik oluşturur**:
1. `llm.js` (veya `src/llm.js`)
2. `app/llm/[[...slug]]/route.js` (Yönetim ekranı: `/llm`)
3. `app/api/llm/[...slug]/route.js` (API rotaları: `/api/llm/*`)

### Hangi dosyaya ne yapıştıracağım?
Rotalar hazır olduğu için hiçbir ayar dosyasına dokunmanıza gerek yoktur! Kendi sayfa veya API dosyanızda (ör. **`app/page.js`** veya bir Server Action içinde) sadece şunu yazın:

```js
import { askLLM } from './llm.js'; // (src klasörü varsa '@/llm')

const cevap = await askLLM('Bu siparişi özetle');
```
* **API Anahtarı Nereden Girilir?** Next.js çalışırken `http://localhost:3000/llm` adresine girip profilinizi kaydedin.

---

## Senaryo 4: Python, Go, C# veya PHP Uygulamaları

Python projenizin klasöründe `npx github:sirrakadembasti/llm-manager init` çalıştırdığınızda **`llm_client.py`** dosyası otomatik oluşturulur.

### Nasıl çalıştırılır ve hangi dosyaya yapıştırılır?

**Adım 1:** Terminalde yerel LLM servisini başlatın:
```bash
npx github:sirrakadembasti/llm-manager --password 12345
```
*(Tarayıcıdan `http://127.0.0.1:8010/llm` adresine girip API anahtarınızı kaydedin.)*

**Adım 2:** Kendi Python dosyanızı (**`main.py`** veya **`app.py`**) açın:
```python
from llm_client import ask_llm  # <-- 1. BUNU EKLEYİN

cevap = ask_llm("Merhaba, nasılsın?")  # <-- 2. TEK SATIRLA ÇAĞIRIN
print(cevap)
```

---

## Senaryo 5: Masaüstü Uygulamaları (Electron / Tauri)

`npx llm-manager init` komutu projenizde **`llm.js`** dosyasını oluşturur ve `package.json` içine `"llm"` komutunu ekler.

### Hangi dosyaya ne yapıştıracağım?

**Adım 1 (API Anahtarı Girme):** Terminalde `npm run llm` çalıştırıp `http://127.0.0.1:8010/llm` ekranından API anahtarınızı kaydedin (veriler `./data` klasörüne şifreli kaydedilir).

**Adım 2:** Electron ana dosyanızı (**`main.js`**) açın:
```js
import { ipcMain } from 'electron';
import { registerLLMIpc, askLLM } from './llm.js'; // <-- 1. BUNU EKLEYİN

registerLLMIpc(ipcMain); // <-- 2. BUNU EKLEYİN (Ön yüzden 'llm:ask' kanalını açar)
```

* **Electron penceresinden (Renderer) çağırmak için:**
  ```js
  const cevap = await ipcRenderer.invoke('llm:ask', 'Merhaba!');
  ```
* **Doğrudan `main.js` içinden çağırmak için:**
  ```js
  const cevap = await askLLM('Merhaba!');
  ```
