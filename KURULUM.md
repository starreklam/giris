# Star Reklam — Kurulum Kılavuzu

Bu klasör, uygulamanın Vercel'e yüklenmeye hazır tam halidir. İki aşama var:
önce **Vercel'e yükleme** (şimdi), sonra **Firebase ile çok cihazlı senkron** (sonra).

---

## AŞAMA 1 — Vercel'e yükleme (canlıya alma)

### Gerekenler
- Bir GitHub hesabı (ücretsiz) — github.com
- Bir Vercel hesabı (ücretsiz) — vercel.com (GitHub ile giriş yapabilirsin)
- Bilgisayarına Node.js kurulu olması gerekmez (Vercel derlemeyi kendi yapar)

### Adım 1 — Projeyi GitHub'a koy
En kolay yol tarayıcıdan:

1. github.com'a gir, sağ üstten **New repository** de.
2. İsim ver (örn: `star-reklam`), **Private** seç, **Create repository**.
3. Açılan sayfada **uploading an existing file** bağlantısına tıkla.
4. Bu klasördeki TÜM dosyaları sürükleyip bırak:
   - `index.html`
   - `package.json`
   - `vite.config.js`
   - `.gitignore`
   - `src/` klasörü (içinde `App.jsx` ve `main.jsx`)
5. Altta **Commit changes** de.

> `node_modules` veya `dist` klasörünü YÜKLEME — zaten `.gitignore` bunları eler.

### Adım 2 — Vercel'e bağla
1. vercel.com'a gir, **Add New → Project**.
2. GitHub'ı bağla, `star-reklam` deposunu seç, **Import**.
3. Vercel otomatik "Vite" algılar. Ayarlara dokunma:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. **Deploy** de. 1-2 dakikada canlı bir adres verir (örn: `star-reklam.vercel.app`).

### Adım 3 — Telefona ekle
Verilen adresi telefonda aç. Tarayıcı menüsünden **"Ana ekrana ekle"** dersen
uygulama gibi simge oluşur.

**Bu aşamada:** Uygulama çalışır, veriler her cihazda O CİHAZIN tarayıcısında saklanır.
Cihazlar arası paylaşım için "Yedek" sekmesindeki indir/yükle kullanılır.
Canlı otomatik senkron için Aşama 2'ye geç.

---

## AŞAMA 2 — Firebase ile çok cihazlı canlı senkron (sonra)

Bunu yaptığında sen, ortağın ve telefon AYNI veriyi anında görürsünüz.
Hazır olduğunda bana "Firebase'i ekleyelim" de; kodu senin için hazırlarım.
Aşağıdakiler ön hazırlık:

### Adım 1 — Firebase projesi aç
1. console.firebase.google.com → **Proje ekle** → isim ver (örn: star-reklam).
2. Google Analytics'i kapatabilirsin (gerekmez).
3. Proje açılınca **Build → Firestore Database → Veritabanı oluştur**.
   - Konum: `eur3` (Avrupa) seç.
   - **Test modunda başlat** de (sonra güvenlik kuralını sıkacağız).

### Adım 2 — Web uygulaması kaydı
1. Proje ana ekranında `</>` (web) simgesine tıkla.
2. Bir takma ad ver (örn: star-web), kaydet.
3. Sana bir `firebaseConfig` bloğu gösterir — şuna benzer:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "star-reklam.firebaseapp.com",
  projectId: "star-reklam",
  storageBucket: "star-reklam.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234:web:abcd"
};
```

**Bu bloğu kopyala, sakla.** Firebase'i eklerken bunu vereceksin.
(Bu bilgiler gizli değildir, tarayıcıda görünür; güvenlik Firestore kurallarıyla sağlanır.)

### Adım 3 — Bana haber ver
Yukarıdaki `firebaseConfig`'i aldıktan sonra "Firebase'i ekleyelim" de.
Ben uygulamaya senkron kodunu ekleyip, güvenlik kurallarını ve
şifre korumasını buluta uygun hale getireceğim. Sonra tek yapman gereken
güncellenmiş dosyaları GitHub'a tekrar yüklemek — Vercel otomatik yeniler.

---

## Sık sorulanlar

**Yerelde denemek istersem?**
Node.js kuruluysa bu klasörde: `npm install` sonra `npm run dev`.
Tarayıcıda `localhost:5173` açılır.

**Verilerim kaybolur mu?**
Aşama 1'de veri tarayıcıda. Tarayıcı verisini temizlersen gider — bu yüzden
düzenli olarak "Yedek" sekmesinden indir. Aşama 2'den (Firebase) sonra veri
bulutta olur, cihaz değişse de durur.

**Şifre ne kadar güvenli?**
Aşama 1'de şifre (star4136) sadece gündelik gizlilik sağlar (kod açık).
Aşama 2'de Firebase ile gerçek güvenlik kuralları eklenebilir.
