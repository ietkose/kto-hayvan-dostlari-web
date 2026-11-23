# KTO Hayvan Dostları — Campus Animal Community & Management Platform

[Visit Live Web App ➜ https://CANLI-SITE-LINKIN.web.app](https://CANLI-SITE-LINKIN.web.app)

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Firebase Hosting](https://img.shields.io/badge/Firebase_Hosting-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Cloud Firestore](https://img.shields.io/badge/Cloud_Firestore-FF9100?style=for-the-badge&logo=firebase&logoColor=white)](https://firebase.google.com/docs/firestore)

═════════════════════════════════════════════════════════════════════════════════════════

## 🇬🇧 ENGLISH

### 🐾 About the Project
KTO Hayvan Dostları is a full-stack web platform and content management system built for the **KTO Karatay University Animal Friends Community (KTO Hayvan Dostları Topluluğu)**. Designed to introduce resident campus cats to students and streamline community operations, the platform combines a welcoming public showcase with a secure, code-free admin dashboard.

The project operates across two core interfaces:
1. **Public Community Showcase (`index.html`)**: A responsive web experience highlighting campus cats (such as Kadayıf, Karamel, Miyu, Safinaz, and Este) along with community updates and visual identity.
2. **Admin Management Dashboard (`admin.html`)**: A dedicated control panel enabling community organizers to add, edit, and manage animal profiles and announcements dynamically without touching source code.

---

### 🐾 Key Features

* **Campus Resident Cat Profiles**:
  * Dedicated showcase cards featuring photos, names, and details of beloved campus cats (`cats/`).
  * Custom mascot and vector branding (`cat-mascot.jpg`, `logo-full.svg`, `logo-icon.svg`).

* **Dynamic Admin Dashboard**:
  * Real-time content and profile management powered by Cloud Firestore.
  * Built specifically for non-technical community team members to keep information up to date effortlessly.

* **Security-First Database Architecture**:
  * Custom, granular **Firestore Security Rules (`firestore.rules`)** enforcing strict read/write access controls and data validation.
  * Indexed queries (`firestore.indexes.json`) for fast data retrieval.

---

### 🐾 Tech Stack
* **Vanilla JavaScript (ES6+)**: Modular frontend logic, DOM rendering, and real-time Firestore integration without framework overhead (`app.js`).
* **HTML5 & CSS3**: Responsive, mobile-first layout and custom styling (`index.html`, `admin.html`, `style.css`).
* **Cloud Firestore**: NoSQL cloud database for storing cat profiles and community content.
* **Firestore Security Rules**: Custom role-based access rules protecting backend write operations (`firestore.rules`)[cite: 2].
* **Deployment**: Hosted on Google Cloud Firebase Hosting with global CDN caching.

---

### 🐾 Local Setup

```bash
# Clone the repository
git clone [https://github.com/ietkose/kto-hayvan-dostlari-web.git](https://github.com/ietkose/kto-hayvan-dostlari-web.git)

# Navigate into the project directory
cd kto-hayvan-dostlari-web

# Open index.html in your preferred browser or use a local static server
npx serve .

═════════════════════════════════════════════════════════════════════════════════════════

🇹🇷 TÜRKÇE
🐾 Proje Hakkında
KTO Hayvan Dostları; KTO Karatay Üniversitesi Hayvan Dostları Topluluğu için geliştirilmiş, kampüsteki can dostlarımızı öğrencilere tanıtmayı ve topluluk içi içerik yönetimini dijitalleştirmeyi amaçlayan uçtan uca bir web platformudur[cite: 2].

Proje iki ana arayüz üzerinden çalışır:

Topluluk Vitrin Arayüzü (index.html): Kadayıf, Karamel, Miyu, Safinaz ve Este başta olmak üzere kampüs kedilerinin profillerini ve topluluk duyurularını sunan modern ve mobil uyumlu web sitesi[cite: 2].

Yönetim Paneli (admin.html): Topluluk yöneticilerinin kod bilgisine ihtiyaç duymadan yeni kedi profilleri ve içerikler ekleyip güncelleyebildiği özel kontrol paneli[cite: 2].

🐾 Öne Çıkan Özellikler
Kampüs Dostları Profil Kartları:

Kampüste yaşayan kedilerin fotoğraflarını ve bilgilerini içeren özel tanıtım kartları[cite: 2].

Topluluğa özel maskot ve vektörel logo tasarımları (logo-full.svg, logo-icon.svg)[cite: 2].

Kodsuz İçerik ve Yönetim Paneli:

Cloud Firestore entegrasyonu sayesinde anlık olarak güncellenebilen profil ve duyuru yapısı[cite: 2].

Ekip üyelerinin içerikleri kolayca yönetebilmesi için sadeleştirilmiş yönetim arayüzü[cite: 2].

Güvenlik Odaklı Veritabanı Mimarisi:

Yetkisiz veri yazma/değiştirme işlemlerini engelleyen kapsamlı Firestore Güvenlik Kuralları (firestore.rules)[cite: 2].

Hızlı sorgulama için yapılandırılmış veritabanı indeksleri (firestore.indexes.json)[cite: 2].

🐾 Kullanılan Teknolojiler
Saf JavaScript (ES6+): Dış framework bağımlılığı olmadan modüler arayüz mantığı ve Cloud Firestore veri yönetimi (app.js)[cite: 2].

HTML5 & CSS3: Tüm cihazlara uyumlu (responsive) tasarım ve özel bileşen stilleri (index.html, admin.html, style.css)[cite: 2].

Cloud Firestore: Dinamik içerik ve profil verileri için bulut tabanlı NoSQL veritabanı[cite: 2].

Firestore Security Rules: Veri bütünlüğünü ve yetkilendirmeyi sağlayan özel erişim kuralları (firestore.rules)[cite: 2].

Barındırma & Dağıtım: Global CDN ve SSL desteğiyle Google Cloud Firebase Hosting[cite: 7].

🐾 Canlı Bağlantılar
Web Platformu: https://CANLI-SITE-LINKIN.web.app

═════════════════════════════════════════════════════════════════════════════════════════

Sample Images / Örnek Görseller