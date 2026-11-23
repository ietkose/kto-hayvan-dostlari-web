// KTO Hayvan Dostları Topluluğu - Firebase Auth + Firestore Güvenli Kampüs Kedi Arşivi
// Masalsı İllüstrasyon & Klasik Tipografi Teması (Sıfır Emoji - Saf Tipografi ve Semboller)

import { app, auth, db, SUPER_ADMIN_EMAIL } from "./firebase-config.js";
import {
    GoogleAuthProvider,
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    sendEmailVerification,
    signInAnonymously,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

const LOCAL_VOTES_CACHE_KEY = 'kto_local_votes_cache_v4';
const DEFAULT_WHATSAPP_URL = 'https://chat.whatsapp.com/KTOHayvanDostlariKulubu';

// Başlangıç Gerçek Verileri (KTO Kampüs Kedileri)
const defaultCatsSeed = [
    {
        id: 'cat-1',
        code: '#KTO-01',
        isNamed: true,
        name: 'Este',
        bio: 'Kampüsün en cana yakın sakinlerinden. Öğrencilerin ders aralarında adımlarını neşeyle takip eder.',
        photo: 'https://ktohayvandostlari.web.app/cats/este-1.jpeg',
        vaccineSummary: 'Karma & Kuduz: Tamamlandı [✓]',
        vaccineDue: false,
        pollOptions: []
    },
    {
        id: 'cat-2',
        code: '#KTO-02',
        isNamed: true,
        name: 'Kadayıf',
        bio: 'Tatlı sarman kürkü ve sevecen bakışlarıyla kampüsün simgesi. Güneşli köşelerde dinlenmeyi çok sever.',
        photo: 'https://ktohayvandostlari.web.app/cats/kadayif-1.jpeg',
        vaccineSummary: 'İç-Dış Parazit: Tamamlandı [✓]',
        vaccineDue: false,
        pollOptions: []
    },
    {
        id: 'cat-3',
        code: '#KTO-03',
        isNamed: true,
        name: 'Karamel',
        bio: 'Karamel tonlarındaki parlak kürkü ve meraklı tavırlarıyla dikkat çeker. Mama saatlerini asla kaçırmaz.',
        photo: 'https://ktohayvandostlari.web.app/cats/karamel.jpeg',
        vaccineSummary: 'Karma Aşı: Planlandı [·]',
        vaccineDue: true,
        pollOptions: []
    },
    {
        id: 'cat-4',
        code: '#KTO-04',
        isNamed: true,
        name: 'Miyu',
        bio: 'Narin patileri ve yumuşacık mırlamalarıyla kalpleri fetheden kampüs prensesi.',
        photo: 'https://ktohayvandostlari.web.app/cats/miyu.jpeg',
        vaccineSummary: 'İç-Dış Parazit: Tamamlandı [✓]',
        vaccineDue: false,
        pollOptions: []
    },
    {
        id: 'cat-5',
        code: '#KTO-05',
        isNamed: true,
        name: 'Safinaz',
        bio: 'Zarif duruşu ve sakin karakteriyle kampüs bahçesinin en asil misafirlerinden biri.',
        photo: 'https://ktohayvandostlari.web.app/cats/safinaz-1.jpeg',
        vaccineSummary: 'Kuduz Aşısı: Planlandı [·]',
        vaccineDue: true,
        pollOptions: []
    }
];

const defaultVaccinesSeed = [
    {
        id: 'vac-1',
        catId: 'cat-1',
        type: 'Karma Aşı (Yıllık)',
        date: '2026-11-10',
        vet: 'Kampüs Vet / Zeynep',
        status: 'done'
    },
    {
        id: 'vac-2',
        catId: 'cat-2',
        type: 'İç - Dış Parazit Uygulaması',
        date: '2026-11-05',
        vet: 'Karatay Vet Kliniği',
        status: 'done'
    },
    {
        id: 'vac-3',
        catId: 'cat-3',
        type: 'Karma Aşı (1. Doz)',
        date: '2026-11-20',
        vet: 'Kampüs Vet / Emre',
        status: 'upcoming'
    },
    {
        id: 'vac-4',
        catId: 'cat-4',
        type: 'Genel Muayene & Parazit',
        date: '2026-10-25',
        vet: 'Karatay Vet Kliniği',
        status: 'done'
    },
    {
        id: 'vac-5',
        catId: 'cat-5',
        type: 'Kuduz Aşısı',
        date: '2026-11-28',
        vet: 'Kampüs Vet / Ayşe',
        status: 'upcoming'
    }
];

// Uygulama Durumu (Firestore Gerçek Zamanlı Senkronize)
let catsData = [];
let vaccinesData = [];
let pollVotesData = []; // { id: "catId_uid", catId, optionName }
let clubSettings = { whatsappUrl: DEFAULT_WHATSAPP_URL, seeded: false };
let adminRequestsData = [];
let currentStaffRole = null; // 'superadmin' | 'admin' | 'pending' | 'rejected' | null
let pendingSignupProfile = null;
let isDatabaseSeeded = false;

let localVotesCache = {};
try {
    localVotesCache = JSON.parse(localStorage.getItem(LOCAL_VOTES_CACHE_KEY)) || {};
} catch (e) {
    localVotesCache = {};
}

let currentFilter = 'all';
let searchQuery = '';
let adminListenersAttached = false;
let adminUnsubscribers = [];

// ==========================================
// YARDIMCI FONKSİYONLAR
// ==========================================
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showToast(message) {
    const toast = document.getElementById('pixelToast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => {
        toast.classList.add('hidden');
    }, 3600);
}

function getAuthErrorMessage(error) {
    const code = error?.code || '';
    switch (code) {
        case 'auth/email-already-in-use':
            return '[!] Bu e-posta adresi ile zaten bir kayıt mevcut.';
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
            return '[!] E-posta adresi veya şifre hatalı.';
        case 'auth/weak-password':
            return '[!] Şifre en az 6 karakter olmalıdır.';
        case 'auth/popup-closed-by-user':
            return '· Google giriş penceresi kapatıldı.';
        case 'auth/unauthorized-domain':
            return '[!] Bu alan adı Firebase Auth Yetkili Alan Adları listesinde tanımlı değil.';
        case 'auth/too-many-requests':
            return '[!] Çok fazla deneme yapıldı. Lütfen biraz bekleyin.';
        default:
            return `[!] İşlem hatası: ${error?.message || 'Lütfen tekrar deneyin.'}`;
    }
}

function generateNextCatCode() {
    let maxNum = 0;
    catsData.forEach(c => {
        const match = String(c.code || '').match(/(\d+)/);
        if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
        }
    });
    return `#KTO-${String(maxNum + 1).padStart(2, '0')}`;
}

function computeCatVaccineSummary(catId, vaccinesList = vaccinesData) {
    const catVacs = vaccinesList.filter(v => v.catId === catId);
    if (catVacs.length === 0) {
        return { summary: 'Kayıtlı Aşı Yok', due: false };
    }
    const urgentVac = catVacs.find(v => v.status === 'urgent');
    if (urgentVac) {
        return { summary: `${urgentVac.type}: Günü Geldi [!]`, due: true };
    }
    const upcomingVac = catVacs.find(v => v.status === 'upcoming');
    if (upcomingVac) {
        return { summary: `${upcomingVac.type} (${upcomingVac.date}) [·]`, due: true };
    }
    return { summary: `${catVacs[0].type}: Tamamlandı [✓]`, due: false };
}

function getCatPollTallies(cat) {
    const options = Array.isArray(cat.pollOptions) ? cat.pollOptions : [];
    const liveVotesForCat = pollVotesData.filter(v => v.catId === cat.id);

    return options.map(opt => {
        const base = Number(opt.votes || 0);
        const liveCount = liveVotesForCat.filter(v => v.optionName === opt.name).length;
        return {
            name: opt.name,
            baseVotes: base,
            totalVotes: base + liveCount
        };
    });
}

function getUserVotedOptionForCat(catId) {
    const uid = auth.currentUser?.uid;
    if (uid) {
        const expectedVoteId = `${catId}_${uid}`;
        const dbVote = pollVotesData.find(v => v.id === expectedVoteId);
        if (dbVote) return dbVote.optionName;
    }
    return localVotesCache[catId] || null;
}

// ==========================================
// SEED (VERİTABANINI BAŞLANGIÇ VERİSİYLE DOLDURMA)
// ==========================================
async function seedStarterDataToFirestore() {
    const batch = writeBatch(db);
    const now = serverTimestamp();

    defaultCatsSeed.forEach(cat => {
        const ref = doc(db, 'cats', cat.id);
        batch.set(ref, {
            code: cat.code,
            isNamed: cat.isNamed,
            name: cat.name,
            bio: cat.bio,
            photo: cat.photo,
            vaccineSummary: cat.vaccineSummary,
            vaccineDue: cat.vaccineDue,
            pollOptions: cat.pollOptions,
            createdAt: now,
            updatedAt: now
        });
    });

    defaultVaccinesSeed.forEach(vac => {
        const ref = doc(db, 'vaccines', vac.id);
        batch.set(ref, {
            catId: vac.catId,
            type: vac.type,
            date: vac.date,
            vet: vac.vet,
            status: vac.status,
            createdAt: now
        });
    });

    batch.set(doc(db, 'settings', 'club'), {
        whatsappUrl: clubSettings.whatsappUrl || DEFAULT_WHATSAPP_URL,
        seeded: true,
        updatedAt: now
    }, { merge: true });

    await batch.commit();
}

// ==========================================
// ANA SİTE BİLEŞENLERİ (INDEX.HTML)
// ==========================================
function getCatPhotos(cat) {
    if (Array.isArray(cat?.photos) && cat.photos.length > 0) {
        return cat.photos.filter(Boolean).slice(0, 3);
    }
    return cat?.photo ? [cat.photo] : [];
}

function buildPhotoLightboxAttrs(cat) {
    const photos = getCatPhotos(cat);
    const displayName = cat.isNamed ? cat.name : `İsimsiz Dostumuz (Aday: ${cat.name})`;
    return `data-lightbox-open data-photo-src="${escapeHtml(photos[0] || '')}" data-photo-list="${escapeHtml(JSON.stringify(photos))}" data-photo-name="${escapeHtml(displayName)}" data-photo-code="${escapeHtml(cat.code)}" data-photo-bio="${escapeHtml(cat.bio)}" role="button" tabindex="0" aria-label="${escapeHtml(displayName)} fotoğrafını büyüt"`;
}

function renderCatOfTheDay() {
    const showcaseEl = document.getElementById('catOfTheDayCard');
    if (!showcaseEl) return;

    const list = catsData.length > 0 ? catsData : (!isDatabaseSeeded ? defaultCatsSeed : []);
    if (list.length === 0) {
        showcaseEl.innerHTML = `
            <div class="showcase-header">
                <span class="showcase-tag">✦ GÜNÜN KEDİSİ</span>
                <span class="hp-stars">★ ★ ★</span>
            </div>
            <div class="showcase-info">
                <h3>Henüz Kayıtlı Kedi Yok</h3>
                <p>Yönetim panelinden yeni kampüs kedisi eklendiğinde burada otomatik sergilenecektir.</p>
            </div>
        `;
        return;
    }

    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    let hash = 0;
    for (let i = 0; i < dateKey.length; i++) {
        hash = (hash * 31 + dateKey.charCodeAt(i)) % 100000;
    }

    const chosenIndex = hash % list.length;
    const cat = list[chosenIndex];
    const cuteness = 92 + (chosenIndex * 3) % 8;
    const energy = 85 + (chosenIndex * 7) % 14;
    const dayPhotos = getCatPhotos(cat);

    showcaseEl.innerHTML = `
        <div class="showcase-header">
            <span class="showcase-tag">✦ GÜNÜN KEDİSİ · ${escapeHtml(cat.code)}</span>
            <span class="hp-stars">SEVGİ ★ ★ ★ ★ ★</span>
        </div>
        <div class="showcase-photo-box" ${buildPhotoLightboxAttrs(cat)}>
            <img src="${escapeHtml(dayPhotos[0] || cat.photo)}" alt="${escapeHtml(cat.name)}">
            <span class="showcase-date-tag">Tarih: ${escapeHtml(dateKey)}</span>
            ${dayPhotos.length > 1 ? `<span class="cat-photo-count-pill">◈ ${dayPhotos.length} Görsel</span>` : ''}
        </div>
        <div class="showcase-info">
            <h3>${cat.isNamed ? escapeHtml(cat.name) : 'Aday: ' + escapeHtml(cat.name) + ' (Oylamada)'}</h3>
            <p>${escapeHtml(cat.bio)}</p>
            <div class="stat-bars">
                <div class="stat-row">
                    <span>Sevecenlik</span>
                    <div class="bar-bg"><div class="bar-fill amber" style="width: ${cuteness}%"></div></div>
                </div>
                <div class="stat-row">
                    <span>Mırlama Gücü</span>
                    <div class="bar-bg"><div class="bar-fill teal" style="width: ${energy}%"></div></div>
                </div>
            </div>
        </div>
    `;
}

function updateStats() {
    const statTotal = document.getElementById('statTotalCats');
    if (!statTotal) return;

    const cList = catsData.length > 0 ? catsData : (!isDatabaseSeeded ? defaultCatsSeed : []);
    const vList = vaccinesData.length > 0 ? vaccinesData : (!isDatabaseSeeded ? defaultVaccinesSeed : []);

    statTotal.textContent = cList.length;
    document.getElementById('statUnnamedCats').textContent = cList.filter(c => !c.isNamed).length;
    document.getElementById('statCompletedVaccines').textContent = vList.filter(v => v.status === 'done').length;
}

function renderCatArchive() {
    const grid = document.getElementById('catArchiveGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const sourceList = catsData.length > 0 ? catsData : (!isDatabaseSeeded ? defaultCatsSeed : []);

    const filtered = sourceList.filter(cat => {
        const matchesFilter =
            currentFilter === 'all' ||
            (currentFilter === 'named' && cat.isNamed) ||
            (currentFilter === 'unnamed' && !cat.isNamed) ||
            (currentFilter === 'vaccine-due' && cat.vaccineDue);

        const matchesSearch =
            cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            cat.bio.toLowerCase().includes(searchQuery.toLowerCase()) ||
            cat.code.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesFilter && matchesSearch;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="art-box empty-state">
                <h3>Aradığınız kriterde kedi bulunamadı</h3>
                <p>Farklı bir filtre seçerek diğer kampüs dostlarımızı inceleyebilirsiniz.</p>
            </div>
        `;
        return;
    }

    filtered.forEach(cat => {
        const card = document.createElement('article');
        card.className = `cat-card ${cat.isNamed ? '' : 'unnamed-card'}`;

        const tallies = !cat.isNamed ? getCatPollTallies(cat) : [];
        const topPoll = tallies.length > 0
            ? [...tallies].sort((a, b) => b.totalVotes - a.totalVotes)[0]
            : null;

        const catPhotos = getCatPhotos(cat);
        const coverPhoto = catPhotos[0] || cat.photo;

        card.innerHTML = `
            <div class="cat-card-top">
                <span class="cat-code">✦ ${escapeHtml(cat.code)}</span>
                <span class="cat-role-tag">${cat.isNamed ? '★ İSİMLİ DOSTUMUZ' : '◈ İSİM OYLAMASINDA'}</span>
            </div>
            <div class="cat-photo-wrap" ${buildPhotoLightboxAttrs(cat)}>
                <img src="${escapeHtml(coverPhoto)}" alt="${escapeHtml(cat.name)}" loading="lazy">
                ${catPhotos.length > 1 ? `<span class="cat-photo-count-pill">◈ ${catPhotos.length} Görsel</span>` : ''}
                ${
                    !cat.isNamed
                        ? `<span class="cat-status-pill unnamed">★ Lider: ${topPoll ? escapeHtml(topPoll.name) : 'Oylama Açık'}</span>`
                        : ''
                }
            </div>
            <div class="cat-body">
                <div class="cat-name-row">
                    <h3>${cat.isNamed ? escapeHtml(cat.name) : 'İsimsiz Dostumuz'}</h3>
                </div>
                <p class="cat-bio">${escapeHtml(cat.bio)}</p>
                <div class="cat-vaccine-mini">
                    <span class="vaccine-label">Sağlık Takvimi:</span>
                    <span class="vaccine-val">${escapeHtml(cat.vaccineSummary)}</span>
                </div>
                <div class="cat-card-actions">
                    ${
                        cat.isNamed
                            ? `<a href="#vaccine-tracker" class="art-btn btn-teal">Aşı Takvimini Gör →</a>`
                            : `<a href="#name-polls" class="art-btn btn-amber">İsim Oylamasında Oy Ver →</a>`
                    }
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderPublicPolls() {
    const container = document.getElementById('pollsContainer');
    if (!container) return;
    container.innerHTML = '';

    const sourceList = catsData.length > 0 ? catsData : (!isDatabaseSeeded ? defaultCatsSeed : []);
    const unnamedCats = sourceList.filter(c => !c.isNamed);

    if (unnamedCats.length === 0) {
        container.innerHTML = `
            <div class="art-box empty-state">
                <h3>Tüm Kedilerimizin İsmi Belirlendi ✦</h3>
                <p>Yeni bir patili misafirimiz katıldığında isim oylaması burada açılacaktır.</p>
            </div>
        `;
        return;
    }

    unnamedCats.forEach(cat => {
        const tallies = getCatPollTallies(cat);
        const totalVotes = tallies.reduce((acc, item) => acc + item.totalVotes, 0);
        const votedOptionName = getUserVotedOptionForCat(cat.id);
        const hasVoted = Boolean(votedOptionName);

        const pollCard = document.createElement('div');
        pollCard.className = 'poll-card';

        const optionsHtml = tallies
            .map((opt, idx) => {
                const pct = totalVotes > 0 ? Math.round((opt.totalVotes / totalVotes) * 100) : 0;
                const isSelected = votedOptionName === opt.name;
                return `
                    <button
                        type="button"
                        class="poll-option-btn ${isSelected ? 'voted' : ''}"
                        data-cat-id="${escapeHtml(cat.id)}"
                        data-opt-name="${escapeHtml(opt.name)}"
                        ${hasVoted ? 'disabled' : ''}
                    >
                        <div class="poll-option-fill" style="width: ${pct}%"></div>
                        <div class="poll-option-content">
                            <span>${isSelected ? '★ ' : '✦ '}${escapeHtml(opt.name)} ${isSelected ? '(Oyunuz)' : ''}</span>
                            <span class="poll-vote-count">${opt.totalVotes} Oy (%${pct})</span>
                        </div>
                    </button>
                `;
            })
            .join('');

        pollCard.innerHTML = `
            <div class="poll-cat-header">
                <img src="${escapeHtml(cat.photo)}" alt="${escapeHtml(cat.name)}">
                <div>
                    <h4>${escapeHtml(cat.code)} · İsim Oylaması</h4>
                    <p>${escapeHtml(cat.bio)}</p>
                </div>
            </div>
            <div class="poll-options-list">
                ${optionsHtml}
            </div>
            <div class="poll-status-notice ${hasVoted ? 'voted' : ''}">
                ${hasVoted ? `[✓] "${escapeHtml(votedOptionName)}" ismine oy verdiniz. Her kedi için 1 kez oy kullanılabilir.` : 'Oy vermek istediğiniz isme tıklayın (Her kediye 1 oy hakkı bulunur)'}
            </div>
        `;

        container.appendChild(pollCard);
    });

    container.querySelectorAll('.poll-option-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const catId = btn.getAttribute('data-cat-id');
            const optionName = btn.getAttribute('data-opt-name');

            if (!isDatabaseSeeded && catsData.length === 0) {
                showToast('[!] Veritabanı henüz başlatılmadı. Yönetici ilk kez giriş yaptığında oylama açılır.');
                return;
            }

            if (getUserVotedOptionForCat(catId)) {
                showToast('[!] Bu kedi için zaten oy kullandınız. Her kediye 1 oy hakkı bulunur.');
                return;
            }

            try {
                btn.disabled = true;
                let user = auth.currentUser;
                if (!user) {
                    const cred = await signInAnonymously(auth);
                    user = cred.user;
                }

                const voteDocId = `${catId}_${user.uid}`;
                await setDoc(doc(db, 'pollVotes', voteDocId), {
                    catId,
                    optionName,
                    createdAt: serverTimestamp()
                });

                localVotesCache[catId] = optionName;
                try {
                    localStorage.setItem(LOCAL_VOTES_CACHE_KEY, JSON.stringify(localVotesCache));
                } catch (err) { /* ignore storage errors */ }

                showToast(`[✓] "${optionName}" ismine oyunuz kaydedildi ve kilitlendi.`);
            } catch (err) {
                btn.disabled = false;
                if (err?.code === 'permission-denied') {
                    showToast('[!] Bu kedi için zaten oy kullanılmış veya oylama kapanmış.');
                } else {
                    showToast(`[!] Oy kaydedilemedi: ${err?.message || 'Hata oluştu.'}`);
                }
            }
        });
    });
}

function renderPublicVaccineTable() {
    const tbody = document.getElementById('vaccineTableBody');
    if (!tbody) return;

    const filterSelect = document.getElementById('vaccineStatusFilter');
    const filterVal = filterSelect ? filterSelect.value : 'all';
    tbody.innerHTML = '';

    const statusBadgeMap = {
        done: '<span class="badge status-done">✓ Tamamlandı</span>',
        upcoming: '<span class="badge status-upcoming">· Planlandı</span>',
        urgent: '<span class="badge status-urgent">! Günü Geldi</span>'
    };

    const cList = catsData.length > 0 ? catsData : (!isDatabaseSeeded ? defaultCatsSeed : []);
    const vList = vaccinesData.length > 0 ? vaccinesData : (!isDatabaseSeeded ? defaultVaccinesSeed : []);
    const filteredVaccines = vList.filter(v => filterVal === 'all' || v.status === filterVal);

    if (filteredVaccines.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding:24px; font-weight:600; color:var(--text-muted);">
                    Bu filtrede kayıtlı aşı veya bakım uygulaması bulunamadı.
                </td>
            </tr>
        `;
        return;
    }

    filteredVaccines.forEach(vac => {
        const cat = cList.find(c => c.id === vac.catId) || {
            name: 'Kampüs Kedisi',
            photo: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=200&q=80'
        };

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="Kedi Dostumuz">
                <div class="cat-table-cell">
                    <img src="${escapeHtml(cat.photo)}" alt="${escapeHtml(cat.name)}">
                    <span>${escapeHtml(cat.name)}</span>
                </div>
            </td>
            <td data-label="Uygulama Türü"><strong>${escapeHtml(vac.type)}</strong></td>
            <td data-label="Tarih">${escapeHtml(vac.date)}</td>
            <td data-label="Sorumlu">${escapeHtml(vac.vet)}</td>
            <td data-label="Durum">${statusBadgeMap[vac.status] || statusBadgeMap.upcoming}</td>
        `;
        tbody.appendChild(tr);
    });
}

function updateWhatsappUI() {
    const url = clubSettings.whatsappUrl || DEFAULT_WHATSAPP_URL;
    const linkEl = document.getElementById('whatsappDirectLink');
    const qrImg = document.getElementById('whatsappQrImage');
    if (linkEl && qrImg) {
        linkEl.href = url;
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}&color=161424&bgcolor=ffffff`;
    }
    const waInput = document.getElementById('adminWhatsappInput');
    if (waInput && document.activeElement !== waInput) {
        waInput.value = url;
    }
}

function refreshPublicUI() {
    renderCatOfTheDay();
    updateStats();
    renderCatArchive();
    renderPublicPolls();
    renderPublicVaccineTable();
    updateWhatsappUI();
}

function isStaffAuthorized(role) {
    return role === 'superadmin' || role === 'approver' || role === 'admin';
}

function canApproveRequests(role) {
    return role === 'superadmin' || role === 'approver';
}

// ==========================================
// ORTAK FIRESTORE DİNLEYİCİLERİ
// ==========================================
function startPublicRealtimeListeners() {
    onSnapshot(query(collection(db, 'cats'), orderBy('createdAt', 'desc')), snapshot => {
        catsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if (catsData.length > 0) isDatabaseSeeded = true;
        refreshPublicUI();
        if (isStaffAuthorized(currentStaffRole)) {
            renderAdminAll();
        }
    }, err => {
        console.warn('Cats listener warning:', err.code || err.message);
        refreshPublicUI();
    });

    onSnapshot(query(collection(db, 'vaccines'), orderBy('createdAt', 'desc')), snapshot => {
        vaccinesData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        refreshPublicUI();
        if (isStaffAuthorized(currentStaffRole)) {
            renderAdminAll();
        }
    }, err => {
        console.warn('Vaccines listener warning:', err.code || err.message);
    });

    onSnapshot(collection(db, 'pollVotes'), snapshot => {
        pollVotesData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCatArchive();
        renderPublicPolls();
        if (isStaffAuthorized(currentStaffRole)) {
            renderAdminPolls();
        }
    }, err => {
        console.warn('PollVotes listener warning:', err.code || err.message);
    });

    onSnapshot(doc(db, 'settings', 'club'), snap => {
        if (snap.exists()) {
            clubSettings = snap.data();
            if (clubSettings.seeded) isDatabaseSeeded = true;
            updateWhatsappUI();
        }
    }, err => {
        console.warn('Settings listener warning:', err.code || err.message);
    });
}

// ==========================================
// YÖNETİM PANELİ: YETKİ KAPISI VE ONAY SİSTEMİ
// ==========================================
function setAuthGateScreen(activeBoxId) {
    const gate = document.getElementById('adminAuthGate');
    const dashboard = document.getElementById('adminDashboard');
    const navItems = document.querySelectorAll('.admin-only-nav');
    const approverNavs = document.querySelectorAll('.approver-only-nav');
    const approverSections = document.querySelectorAll('.approver-only-section');
    if (!gate || !dashboard) return;

    const boxes = ['authLoadingBox', 'authLoginBox', 'authKvkkConfirmBox', 'authVerifyBox', 'authPendingBox', 'authRejectedBox'];

    if (activeBoxId === 'DASHBOARD') {
        gate.classList.add('hidden');
        dashboard.classList.remove('hidden');
        navItems.forEach(el => el.classList.remove('hidden'));
        const showApprovals = canApproveRequests(currentStaffRole);
        approverNavs.forEach(el => el.classList.toggle('hidden', !showApprovals));
        approverSections.forEach(el => el.classList.toggle('hidden', !showApprovals));
    } else {
        gate.classList.remove('hidden');
        dashboard.classList.add('hidden');
        navItems.forEach(el => el.classList.add('hidden'));
        approverSections.forEach(el => el.classList.add('hidden'));
        boxes.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (id === activeBoxId) el.classList.remove('hidden');
                else el.classList.add('hidden');
            }
        });
    }
}

async function resolveAndHandleAdminUser(user) {
    if (!user || user.isAnonymous) {
        currentStaffRole = null;
        detachAdminListeners();
        setAuthGateScreen('authLoginBox');
        return;
    }

    const userEmail = (user.email || '').toLowerCase();
    const isSuperEmail = userEmail === SUPER_ADMIN_EMAIL.toLowerCase();

    // SuperAdmin e-posta/şifre ile kayıt olduysa doğrulama iste
    if (isSuperEmail && !user.emailVerified) {
        currentStaffRole = null;
        setAuthGateScreen('authVerifyBox');
        return;
    }

    const userDocRef = doc(db, 'adminRequests', user.uid);
    let userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
        const hasKvkkConsent = Boolean(
            pendingSignupProfile?.kvkkAccepted ||
            document.getElementById('googleKvkkConsent')?.checked ||
            isSuperEmail
        );

        if (!hasKvkkConsent) {
            currentStaffRole = null;
            const confirmNameEl = document.getElementById('kvkkConfirmName');
            const confirmEmailEl = document.getElementById('kvkkConfirmEmail');
            if (confirmNameEl) confirmNameEl.textContent = user.displayName || userEmail.split('@')[0] || '-';
            if (confirmEmailEl) confirmEmailEl.textContent = user.email || '-';
            setAuthGateScreen('authKvkkConfirmBox');
            return;
        }

        const initialRole = (isSuperEmail && user.emailVerified) ? 'superadmin' : 'pending';
        const displayName = pendingSignupProfile?.name || user.displayName || userEmail.split('@')[0];
        const note = pendingSignupProfile?.note || (initialRole === 'superadmin' ? '' : 'Yönetim Ekibi Başvurusu');

        await setDoc(userDocRef, {
            uid: user.uid,
            email: user.email,
            displayName,
            note,
            role: initialRole,
            kvkkAccepted: true,
            kvkkAcceptedAt: serverTimestamp(),
            createdAt: serverTimestamp()
        });

        pendingSignupProfile = null;
        userSnap = await getDoc(userDocRef);
    } else if (isSuperEmail && user.emailVerified && userSnap.data().role !== 'superadmin') {
        await updateDoc(userDocRef, {
            role: 'superadmin',
            reviewedAt: serverTimestamp()
        });
        userSnap = await getDoc(userDocRef);
    }

    const profile = userSnap.data();
    currentStaffRole = profile.role;

    if (isStaffAuthorized(profile.role)) {
        document.getElementById('staffDisplayName').textContent = profile.displayName || user.email;
        document.getElementById('staffEmailText').textContent = profile.email;

        const roleLabelMap = {
            superadmin: '★ Sistem Yöneticisi',
            approver: '★ Onay Yetkilisi (Başkan / Yrd.)',
            admin: '✦ Yönetim Ekibi Üyesi'
        };
        document.getElementById('staffRoleBadge').textContent = roleLabelMap[profile.role] || '✦ Yönetici';

        setAuthGateScreen('DASHBOARD');

        // İlk açılışta veritabanı boşsa örnek verileri bir kez yükle
        if (!isDatabaseSeeded && catsData.length === 0) {
            try {
                const catsCheck = await getDocs(collection(db, 'cats'));
                const settingsCheck = await getDoc(doc(db, 'settings', 'club'));
                if (catsCheck.empty && !settingsCheck.exists()) {
                    await seedStarterDataToFirestore();
                    showToast('✦ Başlangıç kampüs kedi verileri Firestore veritabanına yüklendi.');
                }
            } catch (e) {
                console.warn('Auto-seed skipped:', e.message);
            }
        }

        if (canApproveRequests(profile.role)) {
            attachAdminListeners();
        } else {
            detachAdminListeners();
        }
        renderAdminAll();
    } else if (profile.role === 'pending') {
        detachAdminListeners();
        document.getElementById('pendingUserName').textContent = profile.displayName || '-';
        document.getElementById('pendingUserEmail').textContent = profile.email || '-';
        document.getElementById('pendingUserNote').textContent = profile.note || '-';
        setAuthGateScreen('authPendingBox');
    } else {
        detachAdminListeners();
        setAuthGateScreen('authRejectedBox');
    }
}

function attachAdminListeners() {
    if (adminListenersAttached) return;
    adminListenersAttached = true;

    const unsubReqs = onSnapshot(query(collection(db, 'adminRequests'), orderBy('createdAt', 'desc')), snapshot => {
        adminRequestsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderAdminApprovals();
    }, err => {
        console.warn('Admin requests listener error:', err);
    });
    adminUnsubscribers.push(unsubReqs);
}

function detachAdminListeners() {
    adminUnsubscribers.forEach(unsub => unsub());
    adminUnsubscribers = [];
    adminListenersAttached = false;
}

function renderAdminApprovals() {
    const pendingList = document.getElementById('pendingRequestsList');
    const approvedList = document.getElementById('approvedAdminsList');
    const pendingCountEl = document.getElementById('pendingRequestsCount');
    if (!pendingList || !approvedList) return;

    const pending = adminRequestsData.filter(r => r.role === 'pending');
    const approved = adminRequestsData.filter(r => isStaffAuthorized(r.role));

    pendingCountEl.textContent = pending.length;
    pendingList.innerHTML = '';
    approvedList.innerHTML = '';

    if (pending.length === 0) {
        pendingList.innerHTML = `
            <div style="padding:16px; border:1px dashed var(--parchment-border); border-radius:6px; text-align:center; color:var(--text-muted); font-size:0.9rem;">
                Şu anda onay bekleyen yetki başvurusu bulunmuyor.
            </div>
        `;
    } else {
        pending.forEach(req => {
            const card = document.createElement('div');
            card.className = 'request-item-card';
            card.innerHTML = `
                <div class="request-item-header">
                    <div>
                        <strong>${escapeHtml(req.displayName)}</strong>
                        <div style="font-size:0.82rem; color:var(--text-muted);">${escapeHtml(req.email)}</div>
                    </div>
                    <span class="badge status-upcoming">· Onay Bekliyor</span>
                </div>
                <div style="font-size:0.86rem; background:var(--parchment-surface); color:var(--text-main); padding:8px 10px; border-radius:4px; border:1px solid var(--parchment-border);">
                    <strong>Görev / Not:</strong> ${escapeHtml(req.note || 'Belirtilmedi')}
                </div>
                <div class="request-item-actions">
                    <button type="button" class="art-btn btn-teal btn-sm" data-approve-uid="${escapeHtml(req.uid)}">✓ Onayla (Yönetici Yap)</button>
                    <button type="button" class="art-btn btn-danger btn-sm" data-reject-uid="${escapeHtml(req.uid)}">✕ Reddet</button>
                </div>
            `;
            pendingList.appendChild(card);
        });
    }

    const memberBadgeMap = {
        superadmin: '★ Sistem Yöneticisi',
        approver: '★ Onay Yetkilisi (Başkan / Yrd.)',
        admin: '✦ Yönetici Üye'
    };

    approved.forEach(member => {
        const isSelf = member.uid === auth.currentUser?.uid;
        const isSuperManager = currentStaffRole === 'superadmin' && member.role !== 'superadmin' && !isSelf;

        const trimmedNote = (member.note || '').trim();
        const isRedundantRoleNote = ['site yöneticisi', 'sistem yöneticisi', 'topluluk baş yöneticisi'].includes(trimmedNote.toLowerCase());
        const showMemberNote = Boolean(trimmedNote) && member.role !== 'superadmin' && !isRedundantRoleNote;

        const card = document.createElement('div');
        card.className = 'request-item-card';
        card.innerHTML = `
            <div class="request-item-header">
                <div>
                    <strong>${escapeHtml(member.displayName)} ${isSelf ? '(Siz)' : ''}</strong>
                    <div style="font-size:0.82rem; color:var(--text-muted);">${escapeHtml(member.email)}</div>
                    ${showMemberNote ? `<div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">${escapeHtml(trimmedNote)}</div>` : ''}
                </div>
                <span class="badge status-done">${memberBadgeMap[member.role] || '✦ Yönetici'}</span>
            </div>
            ${isSuperManager ? `
                <div class="request-item-actions">
                    ${member.role === 'admin'
                        ? `<button type="button" class="art-btn btn-gold btn-sm" data-promote-uid="${escapeHtml(member.uid)}">★ Onay Yetkisi Ver (Başkan/Yrd.)</button>`
                        : `<button type="button" class="art-btn btn-light btn-sm" data-demote-uid="${escapeHtml(member.uid)}">· Normal Üyeye Çek</button>`
                    }
                    <button type="button" class="art-btn btn-danger btn-sm" data-revoke-uid="${escapeHtml(member.uid)}">✕ Yetkiyi Kaldır</button>
                    <button type="button" class="art-btn btn-light btn-sm" data-erase-uid="${escapeHtml(member.uid)}">Veriyi Sil (KVKK)</button>
                </div>
            ` : ''}
        `;
        approvedList.appendChild(card);
    });

    // Onayla Butonları
    pendingList.querySelectorAll('[data-approve-uid]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const uid = btn.getAttribute('data-approve-uid');
            try {
                await updateDoc(doc(db, 'adminRequests', uid), {
                    role: 'admin',
                    reviewedBy: auth.currentUser.email,
                    reviewedAt: serverTimestamp()
                });
                showToast('✓ Kullanıcı yönetim ekibine onaylandı.');
            } catch (err) {
                showToast(`[!] Onay işlemi başarısız: ${err.message}`);
            }
        });
    });

    // Reddet Butonları
    pendingList.querySelectorAll('[data-reject-uid]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const uid = btn.getAttribute('data-reject-uid');
            if (!confirm('Bu yetki isteğini reddetmek istediğinize emin misiniz?')) return;
            try {
                await updateDoc(doc(db, 'adminRequests', uid), {
                    role: 'rejected',
                    reviewedBy: auth.currentUser.email,
                    reviewedAt: serverTimestamp()
                });
                showToast('✕ Yetki isteği reddedildi.');
            } catch (err) {
                showToast(`[!] İşlem başarısız: ${err.message}`);
            }
        });
    });

    // Onay Yetkisi Verme (Başkan / Başkan Yrd. -> approver)
    approvedList.querySelectorAll('[data-promote-uid]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const uid = btn.getAttribute('data-promote-uid');
            try {
                await updateDoc(doc(db, 'adminRequests', uid), {
                    role: 'approver',
                    reviewedBy: auth.currentUser.email,
                    reviewedAt: serverTimestamp()
                });
                showToast('★ Kullanıcıya Onay Yetkisi (Başkan / Bşk. Yrd.) tanımlandı.');
            } catch (err) {
                showToast(`[!] Yetki güncellenemedi: ${err.message}`);
            }
        });
    });

    // Normal Üyeye Çekme (approver -> admin)
    approvedList.querySelectorAll('[data-demote-uid]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const uid = btn.getAttribute('data-demote-uid');
            try {
                await updateDoc(doc(db, 'adminRequests', uid), {
                    role: 'admin',
                    reviewedBy: auth.currentUser.email,
                    reviewedAt: serverTimestamp()
                });
                showToast('· Kullanıcı normal yönetim üyesi rolüne alındı.');
            } catch (err) {
                showToast(`[!] Yetki güncellenemedi: ${err.message}`);
            }
        });
    });

    // Yetki Kaldır Butonları (Yalnızca SuperAdmin)
    approvedList.querySelectorAll('[data-revoke-uid]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const uid = btn.getAttribute('data-revoke-uid');
            if (!confirm('Bu yöneticinin yönetim paneli yetkisini kaldırmak istediğinize emin misiniz?')) return;
            try {
                await updateDoc(doc(db, 'adminRequests', uid), {
                    role: 'rejected',
                    reviewedBy: auth.currentUser.email,
                    reviewedAt: serverTimestamp()
                });
                showToast('✕ Yönetici yetkisi kaldırıldı.');
            } catch (err) {
                showToast(`[!] İşlem başarısız: ${err.message}`);
            }
        });
    });

    // KVKK Kapsamında Kaydı Kalıcı Silme (Yalnızca SuperAdmin)
    approvedList.querySelectorAll('[data-erase-uid]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const uid = btn.getAttribute('data-erase-uid');
            if (!confirm('Bu kişinin ad-soyad ve e-posta kaydını KVKK kapsamında Firestore veritabanından kalıcı olarak silmek istediğinize emin misiniz?')) return;
            try {
                await deleteDoc(doc(db, 'adminRequests', uid));
                showToast('✓ Kayıt ve kişisel veriler veritabanından silindi.');
            } catch (err) {
                showToast(`[!] Silme işlemi başarısız: ${err.message}`);
            }
        });
    });
}

// ==========================================
// YÖNETİM PANELİ FORM VE İŞLEMLERİ
// ==========================================
function compressImageFile(file, callback, opts = {}) {
    const maxDim = opts.maxDim || 600;
    const primaryQuality = opts.primaryQuality || 0.7;
    const fallbackQuality = opts.fallbackQuality || 0.46;
    const maxChars = opts.maxChars || 220000;

    const reader = new FileReader();
    reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width;
            let h = img.height;
            if (w > maxDim || h > maxDim) {
                if (w > h) {
                    h = Math.round((h * maxDim) / w);
                    w = maxDim;
                } else {
                    w = Math.round((w * maxDim) / h);
                    h = maxDim;
                }
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            let dataUrl = canvas.toDataURL('image/jpeg', primaryQuality);
            if (dataUrl.length > maxChars) {
                dataUrl = canvas.toDataURL('image/jpeg', fallbackQuality);
            }
            callback(dataUrl);
        };
        img.onerror = () => callback(ev.target.result);
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
}

function compressMultipleImages(files, isMulti) {
    const opts = isMulti
        ? { maxDim: 520, primaryQuality: 0.62, fallbackQuality: 0.42, maxChars: 185000 }
        : { maxDim: 650, primaryQuality: 0.72, fallbackQuality: 0.48, maxChars: 340000 };
    return Promise.all(
        files.map(
            file =>
                new Promise(resolve => {
                    compressImageFile(file, resolve, opts);
                })
        )
    );
}

function initAdminAuthControls() {
    const authGate = document.getElementById('adminAuthGate');
    if (!authGate) return;

    if (window.location.protocol === 'file:') {
        document.getElementById('fileProtocolWarning')?.classList.remove('hidden');
    }

    const tabSignIn = document.getElementById('tabSignIn');
    const tabSignUp = document.getElementById('tabSignUp');
    const signInForm = document.getElementById('emailSignInForm');
    const signUpForm = document.getElementById('emailSignUpForm');

    tabSignIn?.addEventListener('click', () => {
        tabSignIn.classList.add('active');
        tabSignUp.classList.remove('active');
        signInForm.classList.remove('hidden');
        signUpForm.classList.add('hidden');
    });

    tabSignUp?.addEventListener('click', () => {
        tabSignUp.classList.add('active');
        tabSignIn.classList.remove('active');
        signUpForm.classList.remove('hidden');
        signInForm.classList.add('hidden');
    });

    // Google ile Giriş
    document.getElementById('googleSignInBtn')?.addEventListener('click', async () => {
        try {
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            await signInWithPopup(auth, provider);
        } catch (err) {
            showToast(getAuthErrorMessage(err));
        }
    });

    // E-posta & Şifre ile Giriş
    signInForm?.addEventListener('submit', async e => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const pass = document.getElementById('loginPassword').value;
        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (err) {
            showToast(getAuthErrorMessage(err));
        }
    });

    // Yeni Kayıt & Yetki Talebi
    signUpForm?.addEventListener('submit', async e => {
        e.preventDefault();
        const kvkkOk = document.getElementById('signupKvkkConsent')?.checked;
        if (!kvkkOk) {
            showToast('[!] Başvuru göndermek için KVKK Aydınlatma Metni onayı vermeniz gerekir.');
            return;
        }
        const name = document.getElementById('signupName').value.trim();
        const note = document.getElementById('signupNote').value.trim();
        const email = document.getElementById('signupEmail').value.trim();
        const pass = document.getElementById('signupPassword').value;

        pendingSignupProfile = { name, note, kvkkAccepted: true };
        try {
            const cred = await createUserWithEmailAndPassword(auth, email, pass);
            await updateProfile(cred.user, { displayName: name });
            if (email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
                await sendEmailVerification(cred.user);
                showToast('✦ Doğrulama e-postası gönderildi.');
            } else {
                showToast('✦ Yetki başvurunuz oluşturuldu ve Sistem Yöneticisine iletildi.');
            }
            await resolveAndHandleAdminUser(cred.user);
        } catch (err) {
            pendingSignupProfile = null;
            showToast(getAuthErrorMessage(err));
        }
    });

    // İlk Kez Google ile Başvuranlar İçin KVKK Açık Rıza Onayı
    document.getElementById('confirmGoogleKvkkBtn')?.addEventListener('click', async () => {
        if (!auth.currentUser) return;
        pendingSignupProfile = { kvkkAccepted: true };
        try {
            await resolveAndHandleAdminUser(auth.currentUser);
            showToast('✦ Başvurunuz KVKK onayınızla birlikte yönetime iletildi.');
        } catch (err) {
            pendingSignupProfile = null;
            showToast(`[!] Başvuru kaydedilemedi: ${err.message}`);
        }
    });

    document.getElementById('cancelGoogleKvkkBtn')?.addEventListener('click', async () => {
        pendingSignupProfile = null;
        await signOut(auth);
        showToast('Başvuru iptal edildi, veri kaydedilmedi.');
    });

    // E-posta Doğrulama Kontrolleri
    document.getElementById('resendVerifyBtn')?.addEventListener('click', async () => {
        if (auth.currentUser) {
            try {
                await sendEmailVerification(auth.currentUser);
                showToast('✦ Doğrulama bağlantısı e-postanıza tekrar gönderildi.');
            } catch (err) {
                showToast(getAuthErrorMessage(err));
            }
        }
    });

    document.getElementById('checkVerifyBtn')?.addEventListener('click', async () => {
        if (auth.currentUser) {
            await auth.currentUser.reload();
            await resolveAndHandleAdminUser(auth.currentUser);
        }
    });

    // Bekleyen Kullanıcının Not Güncellemesi
    document.getElementById('updatePendingNoteForm')?.addEventListener('submit', async e => {
        e.preventDefault();
        const noteVal = document.getElementById('pendingNoteInput').value.trim();
        if (!auth.currentUser || !noteVal) return;
        try {
            await updateDoc(doc(db, 'adminRequests', auth.currentUser.uid), { note: noteVal });
            document.getElementById('pendingUserNote').textContent = noteVal;
            document.getElementById('pendingNoteInput').value = '';
            showToast('✓ Tanıtım notunuz güncellendi.');
        } catch (err) {
            showToast(`[!] Not güncellenemedi: ${err.message}`);
        }
    });

    // Onay Durumu Yenileme
    document.getElementById('refreshStatusBtn')?.addEventListener('click', async () => {
        if (auth.currentUser) {
            await resolveAndHandleAdminUser(auth.currentUser);
            if (currentStaffRole === 'pending') {
                showToast('· Başvurunuz halen onay bekliyor.');
            }
        }
    });

    // Bekleyen Başvuruyu Geri Çekme ve Veriyi Silme (KVKK)
    document.getElementById('withdrawPendingBtn')?.addEventListener('click', async () => {
        if (!auth.currentUser) return;
        if (!confirm('Başvurunuzu geri çekip kayıtlı kişisel verilerinizi silmek istediğinize emin misiniz?')) return;
        try {
            await deleteDoc(doc(db, 'adminRequests', auth.currentUser.uid));
            await signOut(auth);
            showToast('✓ Başvurunuz iptal edildi ve verileriniz silindi.');
        } catch (err) {
            showToast(`[!] İşlem başarısız: ${err.message}`);
        }
    });

    // Çıkış Yap Butonları
    const handleSignOut = async () => {
        await signOut(auth);
        showToast('✓ Güvenli çıkış yapıldı.');
    };
    ['adminSignOutBtn', 'pendingSignOutBtn', 'rejectedSignOutBtn', 'verifySignOutBtn'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', handleSignOut);
    });
}

function parsePhotoUrlsRaw(raw) {
    if (!raw) return [];
    return raw
        .split(/[\n\r]+|,\s*(?=https?:\/\/)/i)
        .map(s => s.trim())
        .filter(Boolean);
}

function getCatPhotosValidationError(finalPhotos) {
    if (finalPhotos.length > 3) {
        return '[!] Bir kedi için en fazla 3 adet görsel saklanabilir.';
    }
    if (finalPhotos.some(p => p.length > 350000)) {
        return '[!] Görsellerden biri çok büyük! Lütfen daha küçük boyutlu görsel veya URL kullanın.';
    }
    const totalDocPhotoChars = (finalPhotos[0]?.length || 0) + finalPhotos.reduce((acc, item) => acc + item.length, 0);
    if (totalDocPhotoChars > 820000) {
        return '[!] Seçilen görsellerin toplam boyutu çok yüksek. Lütfen daha hafif dosyalar veya URL kullanın.';
    }
    return null;
}

function initAdminForms() {
    const adminAddCatForm = document.getElementById('adminAddCatForm');
    if (!adminAddCatForm) return;

    const namedStatusSelect = document.getElementById('adminCatNamedStatus');
    const nameGroup = document.getElementById('adminCatNameGroup');
    const pollGroup = document.getElementById('adminCatPollGroup');

    namedStatusSelect.addEventListener('change', () => {
        if (namedStatusSelect.value === 'unnamed') {
            nameGroup.classList.add('hidden');
            pollGroup.classList.remove('hidden');
        } else {
            nameGroup.classList.remove('hidden');
            pollGroup.classList.add('hidden');
        }
    });

    const photoFileInput = document.getElementById('adminCatPhotoFile');
    const photoUrlInput = document.getElementById('adminCatPhotoUrl');
    const photoHintEl = document.getElementById('adminPhotoSelectionHint');

    const updatePhotoHint = () => {
        if (!photoHintEl) return;
        const filesCount = photoFileInput?.files?.length || 0;
        const urlsCount = parsePhotoUrlsRaw(photoUrlInput?.value || '').length;
        const total = filesCount + urlsCount;
        if (total > 3) {
            photoHintEl.textContent = `[!] Toplam ${total} görsel seçildi — en fazla 3 görsel eklenebilir.`;
            photoHintEl.style.color = 'var(--danger, #e25845)';
        } else if (total > 0) {
            photoHintEl.textContent = `✓ ${total} / 3 görsel seçildi (ilk görsel kapak fotoğrafı olur).`;
            photoHintEl.style.color = 'var(--twilight-teal-text)';
        } else {
            photoHintEl.textContent = 'En fazla 3 görsel seçebilirsiniz. İlk görsel kapak fotoğrafı olur, tamamı tıklandığında galeri olarak açılır.';
            photoHintEl.style.color = 'var(--text-muted)';
        }
    };
    photoFileInput?.addEventListener('change', updatePhotoHint);
    photoUrlInput?.addEventListener('input', updatePhotoHint);

    // Yeni Kedi Ekle (Firestore)
    adminAddCatForm.addEventListener('submit', async e => {
        e.preventDefault();
        const isNamed = namedStatusSelect.value === 'named';
        const nameInput = document.getElementById('adminCatName').value.trim();
        const pollOptionsRaw = document.getElementById('adminCatPollOptions').value.trim();
        const bio = document.getElementById('adminCatBio').value.trim();
        const parsedUrls = parsePhotoUrlsRaw(photoUrlInput?.value.trim() || '');
        const selectedFiles = Array.from(photoFileInput?.files || []);

        if (selectedFiles.length + parsedUrls.length > 3) {
            showToast('[!] Bir kedi için en fazla 3 adet görsel ekleyebilirsiniz.');
            return;
        }

        if (isNamed && !nameInput) {
            showToast('[!] Lütfen kedinin ismini girin veya "İsmi Yok" seçeneğini seçin.');
            return;
        }

        let parsedPolls = [];
        if (!isNamed) {
            const rawList = pollOptionsRaw
                ? pollOptionsRaw.split(',').map(s => s.trim()).filter(Boolean)
                : ['Puding', 'Bulut', 'Tarçın'];
            const uniqueNames = [...new Set(rawList)];
            if (uniqueNames.length < 2) {
                showToast('[!] Oylama başlatmak için virgülle ayrılmış en az 2 farklı aday isim girin.');
                return;
            }
            parsedPolls = uniqueNames.map(name => ({ name, votes: 0 }));
        }

        const saveCatToDb = async rawPhotos => {
            const cleanPhotos = (rawPhotos || []).filter(Boolean).slice(0, 3);
            const fallbackPhoto = 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=700&q=80';
            const finalPhotos = cleanPhotos.length > 0 ? cleanPhotos : [fallbackPhoto];

            const sizeErr = getCatPhotosValidationError(finalPhotos);
            if (sizeErr) {
                showToast(sizeErr);
                return;
            }
            try {
                const newCode = generateNextCatCode();
                const unnamedCount = catsData.filter(c => !c.isNamed).length + 1;

                await addDoc(collection(db, 'cats'), {
                    code: newCode,
                    isNamed,
                    name: isNamed ? nameInput : `İsimsiz Misafir #${unnamedCount}`,
                    bio,
                    photo: finalPhotos[0],
                    photos: finalPhotos,
                    vaccineSummary: 'İlk Muayene: Planlandı [·]',
                    vaccineDue: true,
                    pollOptions: parsedPolls,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });

                await setDoc(doc(db, 'settings', 'club'), {
                    whatsappUrl: clubSettings.whatsappUrl || DEFAULT_WHATSAPP_URL,
                    seeded: true,
                    updatedAt: serverTimestamp()
                }, { merge: true });

                adminAddCatForm.reset();
                namedStatusSelect.dispatchEvent(new Event('change'));
                updatePhotoHint();
                showToast(`✦ ${isNamed ? nameInput : 'Yeni misafir'} (${newCode}, ${finalPhotos.length} görsel) Firestore arşivine eklendi.`);
            } catch (err) {
                showToast(`[!] Kedi eklenemedi: ${err.message}`);
            }
        };

        if (selectedFiles.length > 0) {
            const isMulti = selectedFiles.length + parsedUrls.length > 1;
            const uploadedPhotos = await compressMultipleImages(selectedFiles, isMulti);
            await saveCatToDb([...uploadedPhotos, ...parsedUrls]);
        } else {
            await saveCatToDb(parsedUrls);
        }
    });

    // Yeni Aşı Kaydı Ekle (Firestore)
    document.getElementById('adminAddVaccineForm').addEventListener('submit', async e => {
        e.preventDefault();
        const catId = document.getElementById('adminVaccineCatSelect').value;
        const type = document.getElementById('adminVaccineType').value;
        const date = document.getElementById('adminVaccineDate').value;
        const vet = document.getElementById('adminVaccineVet').value.trim();
        const status = document.getElementById('adminVaccineStatus').value;

        if (!catId) {
            showToast('[!] Lütfen önce arşive bir kedi ekleyin.');
            return;
        }

        try {
            const newVacRef = await addDoc(collection(db, 'vaccines'), {
                catId,
                type,
                date,
                vet,
                status,
                createdAt: serverTimestamp()
            });

            const updatedList = [{ id: newVacRef.id, catId, type, date, vet, status }, ...vaccinesData];
            const vacMeta = computeCatVaccineSummary(catId, updatedList);
            await updateDoc(doc(db, 'cats', catId), {
                vaccineSummary: vacMeta.summary,
                vaccineDue: vacMeta.due,
                updatedAt: serverTimestamp()
            });

            document.getElementById('adminAddVaccineForm').reset();
            showToast('✚ Yeni aşı kaydı bulut takvimine eklendi.');
        } catch (err) {
            showToast(`[!] Aşı kaydı eklenemedi: ${err.message}`);
        }
    });

    // WhatsApp Bağlantısı Güncelle (Firestore)
    document.getElementById('adminWhatsappForm').addEventListener('submit', async e => {
        e.preventDefault();
        const url = document.getElementById('adminWhatsappInput').value.trim();
        if (!url) return;
        try {
            await setDoc(doc(db, 'settings', 'club'), {
                whatsappUrl: url,
                seeded: true,
                updatedAt: serverTimestamp()
            }, { merge: true });
            showToast('→ WhatsApp grup bağlantısı ve karekod tüm ziyaretçiler için güncellendi.');
        } catch (err) {
            showToast(`[!] Bağlantı güncellenemedi: ${err.message}`);
        }
    });
}

function renderAdminAll() {
    renderAdminCatsList();
    renderAdminPolls();
    renderAdminVaccines();
    updateWhatsappUI();
}

let activeManagePhotosCatId = null;

function renderCatPhotosModalContent(catId) {
    const modal = document.getElementById('adminCatPhotosModal');
    const titleEl = document.getElementById('adminCatPhotosTitle');
    const gridEl = document.getElementById('adminCatPhotosPreviewGrid');
    const hintEl = document.getElementById('adminManagePhotosHint');
    const urlInput = document.getElementById('adminManagePhotoUrls');
    const fileInput = document.getElementById('adminManagePhotoFiles');
    const submitBtn = document.getElementById('adminManagePhotosSubmitBtn');
    const cat = catsData.find(c => c.id === catId);
    if (!modal || !cat) return;

    const photos = getCatPhotos(cat);
    const remaining = Math.max(0, 3 - photos.length);
    if (titleEl) titleEl.textContent = `◈ ${cat.code} · ${cat.name} — Görseller (${photos.length} / 3)`;

    if (hintEl) {
        hintEl.textContent = remaining > 0
            ? `Bu kediye en fazla ${remaining} görsel daha ekleyebilirsiniz.`
            : '3 / 3 görsel dolu. Yeni görsel eklemek için mevcutlardan birini kaldırın.';
    }
    if (urlInput) urlInput.disabled = remaining === 0;
    if (fileInput) fileInput.disabled = remaining === 0;
    if (submitBtn) submitBtn.disabled = remaining === 0;

    if (gridEl) {
        gridEl.innerHTML = '';
        photos.forEach((src, idx) => {
            const slot = document.createElement('div');
            slot.className = 'admin-photo-slot';
            slot.innerHTML = `
                <div class="admin-photo-slot-imgwrap">
                    <img src="${escapeHtml(src)}" alt="${escapeHtml(cat.name)} (${idx + 1})">
                    ${idx === 0 ? '<span class="admin-photo-cover-tag">★ Kapak</span>' : ''}
                </div>
                <div class="admin-photo-slot-actions">
                    ${idx > 0
                        ? `<button type="button" class="art-btn btn-light btn-sm" data-set-cover-idx="${idx}">★ Kapak Yap</button>`
                        : '<span style="font-size:0.74rem; color:var(--text-muted); align-self:center;">Ana Görsel</span>'
                    }
                    ${photos.length > 1
                        ? `<button type="button" class="art-btn btn-danger btn-sm" data-remove-photo-idx="${idx}">✕</button>`
                        : ''
                    }
                </div>
            `;
            gridEl.appendChild(slot);
        });
    }
}

function initAdminCatPhotosModal() {
    const modal = document.getElementById('adminCatPhotosModal');
    const form = document.getElementById('adminCatAddPhotosForm');
    if (!modal || modal.dataset.bound === '1') return;
    modal.dataset.bound = '1';

    const closeModal = () => {
        activeManagePhotosCatId = null;
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    };

    const persistCatPhotos = async (catId, nextPhotos, successMessage) => {
        const cleanPhotos = nextPhotos.filter(Boolean).slice(0, 3);
        if (cleanPhotos.length === 0) {
            showToast('[!] Kedinin en az 1 fotoğrafı kalmalıdır.');
            return false;
        }
        const sizeErr = getCatPhotosValidationError(cleanPhotos);
        if (sizeErr) {
            showToast(sizeErr);
            return false;
        }
        try {
            await updateDoc(doc(db, 'cats', catId), {
                photo: cleanPhotos[0],
                photos: cleanPhotos,
                updatedAt: serverTimestamp()
            });
            showToast(successMessage);
            return true;
        } catch (err) {
            showToast(`[!] Görseller güncellenemedi: ${err.message}`);
            return false;
        }
    };

    modal.addEventListener('click', async e => {
        if (e.target.closest('[data-close-cat-photos]') || e.target === modal) {
            closeModal();
            return;
        }
        const cat = catsData.find(c => c.id === activeManagePhotosCatId);
        if (!cat) return;

        const coverBtn = e.target.closest('[data-set-cover-idx]');
        if (coverBtn) {
            const idx = parseInt(coverBtn.getAttribute('data-set-cover-idx'), 10);
            const list = [...getCatPhotos(cat)];
            if (idx > 0 && idx < list.length) {
                const [picked] = list.splice(idx, 1);
                list.unshift(picked);
                await persistCatPhotos(cat.id, list, '★ Seçilen görsel kapak fotoğrafı yapıldı.');
            }
            return;
        }

        const removeBtn = e.target.closest('[data-remove-photo-idx]');
        if (removeBtn) {
            const idx = parseInt(removeBtn.getAttribute('data-remove-photo-idx'), 10);
            const list = [...getCatPhotos(cat)];
            if (list.length <= 1) {
                showToast('[!] Kedinin en az 1 fotoğrafı kalmalıdır.');
                return;
            }
            list.splice(idx, 1);
            await persistCatPhotos(cat.id, list, '✕ Görsel kediden kaldırıldı.');
        }
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeModal();
        }
    });

    form?.addEventListener('submit', async e => {
        e.preventDefault();
        const cat = catsData.find(c => c.id === activeManagePhotosCatId);
        if (!cat) return;

        const currentPhotos = getCatPhotos(cat);
        const remaining = 3 - currentPhotos.length;
        if (remaining <= 0) {
            showToast('[!] Bu kedide zaten 3 görsel bulunuyor.');
            return;
        }

        const urlInput = document.getElementById('adminManagePhotoUrls');
        const fileInput = document.getElementById('adminManagePhotoFiles');
        const parsedUrls = parsePhotoUrlsRaw(urlInput?.value.trim() || '');
        const files = Array.from(fileInput?.files || []);

        if (parsedUrls.length === 0 && files.length === 0) {
            showToast('[!] Eklemek için en az 1 URL veya görsel dosyası seçin.');
            return;
        }
        if (parsedUrls.length + files.length > remaining) {
            showToast(`[!] Bu kediye en fazla ${remaining} görsel daha ekleyebilirsiniz.`);
            return;
        }

        const uploaded = files.length > 0 ? await compressMultipleImages(files, true) : [];
        const nextPhotos = [...currentPhotos, ...uploaded, ...parsedUrls];
        const ok = await persistCatPhotos(cat.id, nextPhotos, `✦ ${cat.name} için görseller güncellendi (${nextPhotos.length}/3).`);
        if (ok) {
            form.reset();
        }
    });
}

function openAdminCatPhotosModal(catId) {
    const modal = document.getElementById('adminCatPhotosModal');
    if (!modal) return;
    initAdminCatPhotosModal();
    activeManagePhotosCatId = catId;
    renderCatPhotosModalContent(catId);
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function renderAdminCatsList() {
    const listEl = document.getElementById('adminCatsList');
    const countEl = document.getElementById('adminCatCount');
    const selectEl = document.getElementById('adminVaccineCatSelect');
    if (!listEl) return;

    countEl.textContent = catsData.length;
    listEl.innerHTML = '';
    selectEl.innerHTML = '';

    catsData.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = `${cat.code} - ${cat.name}`;
        selectEl.appendChild(opt);

        const item = document.createElement('div');
        item.className = 'admin-cat-item';
        const catPhotos = getCatPhotos(cat);
        item.innerHTML = `
            <div class="admin-cat-item-left">
                <img src="${escapeHtml(catPhotos[0] || cat.photo)}" alt="${escapeHtml(cat.name)}">
                <div>
                    <strong>${escapeHtml(cat.code)} · ${escapeHtml(cat.name)}</strong>
                    <div class="admin-cat-meta">${cat.isNamed ? '★ İsimli Kedi' : '◈ İsim Oylamasında'} · ${catPhotos.length}/3 Görsel</div>
                </div>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button type="button" class="art-btn btn-teal btn-sm" data-manage-photos="${escapeHtml(cat.id)}">◈ Görseller</button>
                <button type="button" class="art-btn btn-danger btn-sm" data-delete-cat="${escapeHtml(cat.id)}">✕ Sil</button>
            </div>
        `;
        listEl.appendChild(item);
    });

    if (activeManagePhotosCatId) {
        renderCatPhotosModalContent(activeManagePhotosCatId);
    }

    listEl.querySelectorAll('[data-manage-photos]').forEach(btn => {
        btn.addEventListener('click', () => {
            openAdminCatPhotosModal(btn.getAttribute('data-manage-photos'));
        });
    });

    listEl.querySelectorAll('[data-delete-cat]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const catId = btn.getAttribute('data-delete-cat');
            const target = catsData.find(c => c.id === catId);
            if (!confirm(`"${target ? target.name : 'Bu kedi'}" kaydını ve ilişkili aşı kayıtlarını silmek istediğinize emin misiniz?`)) return;

            try {
                const batch = writeBatch(db);
                batch.delete(doc(db, 'cats', catId));
                vaccinesData.filter(v => v.catId === catId).forEach(v => {
                    batch.delete(doc(db, 'vaccines', v.id));
                });
                pollVotesData.filter(pv => pv.catId === catId).forEach(pv => {
                    batch.delete(doc(db, 'pollVotes', pv.id));
                });
                await batch.commit();
                showToast('✕ Kedi kaydı silindi.');
            } catch (err) {
                showToast(`[!] Silme hatası: ${err.message}`);
            }
        });
    });
}

function renderAdminPolls() {
    const container = document.getElementById('adminPollsContainer');
    if (!container) return;
    container.innerHTML = '';

    const unnamedCats = catsData.filter(c => !c.isNamed);
    if (unnamedCats.length === 0) {
        container.innerHTML = `
            <div class="art-box empty-state">
                <strong>Şu anda açık bir isim oylaması bulunmuyor.</strong>
                <p>Yukarıdaki formdan "İsmi Yok (İsim Oylaması Başlat)" seçeneğiyle yeni bir kedi ekleyebilirsiniz.</p>
            </div>
        `;
        return;
    }

    unnamedCats.forEach(cat => {
        const tallies = getCatPollTallies(cat);
        const card = document.createElement('div');
        card.className = 'poll-card';

        const optionsList = tallies
            .map((opt, idx) => `
                <div class="admin-poll-option-row">
                    <strong>✦ ${escapeHtml(opt.name)} (${opt.totalVotes} Oy)</strong>
                    <button type="button" class="art-btn btn-danger btn-sm" data-del-opt-cat="${escapeHtml(cat.id)}" data-del-opt-idx="${idx}">✕</button>
                </div>
            `)
            .join('');

        card.innerHTML = `
            <div class="poll-cat-header">
                <img src="${escapeHtml(cat.photo)}" alt="${escapeHtml(cat.name)}">
                <div>
                    <h4>${escapeHtml(cat.code)} · ${escapeHtml(cat.name)}</h4>
                    <p>${escapeHtml(cat.bio)}</p>
                </div>
            </div>
            <div class="poll-options-list">${optionsList}</div>
            <form class="poll-suggest-form" data-admin-add-opt="${escapeHtml(cat.id)}">
                <input type="text" placeholder="Yeni aday isim seçeneği ekle..." required>
                <button type="submit" class="art-btn btn-teal btn-sm">+ Şık Ekle</button>
            </form>
            <button type="button" class="art-btn btn-amber poll-finalize-btn" data-admin-finalize="${escapeHtml(cat.id)}">
                ★ En Çok Oy Alan İsmi Resmi İsim Yap
            </button>
        `;
        container.appendChild(card);
    });

    container.querySelectorAll('[data-del-opt-cat]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const catId = btn.getAttribute('data-del-opt-cat');
            const idx = parseInt(btn.getAttribute('data-del-opt-idx'), 10);
            const targetCat = catsData.find(c => c.id === catId);
            if (!targetCat) return;

            const currentOpts = [...(targetCat.pollOptions || [])];
            if (currentOpts.length <= 2) {
                showToast('[!] Bir oylamada en az 2 aday isim seçeneği kalmalıdır.');
                return;
            }
            currentOpts.splice(idx, 1);
            try {
                await updateDoc(doc(db, 'cats', catId), {
                    pollOptions: currentOpts,
                    updatedAt: serverTimestamp()
                });
                showToast('✕ Aday isim seçeneği kaldırıldı.');
            } catch (err) {
                showToast(`[!] Güncellenemedi: ${err.message}`);
            }
        });
    });

    container.querySelectorAll('[data-admin-add-opt]').forEach(form => {
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const catId = form.getAttribute('data-admin-add-opt');
            const input = form.querySelector('input');
            const val = input.value.trim();
            const targetCat = catsData.find(c => c.id === catId);
            if (!targetCat || !val) return;

            const currentOpts = [...(targetCat.pollOptions || [])];
            if (currentOpts.some(o => o.name.toLowerCase() === val.toLowerCase())) {
                showToast('[!] Bu isim zaten aday seçenekler arasında yer alıyor.');
                return;
            }
            currentOpts.push({ name: val, votes: 0 });
            try {
                await updateDoc(doc(db, 'cats', catId), {
                    pollOptions: currentOpts,
                    updatedAt: serverTimestamp()
                });
                showToast(`✦ "${val}" oylama seçeneklerine eklendi.`);
            } catch (err) {
                showToast(`[!] Eklenemedi: ${err.message}`);
            }
        });
    });

    container.querySelectorAll('[data-admin-finalize]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const catId = btn.getAttribute('data-admin-finalize');
            const targetCat = catsData.find(c => c.id === catId);
            if (!targetCat) return;
            const tallies = getCatPollTallies(targetCat);
            if (tallies.length === 0) return;

            const winner = [...tallies].sort((a, b) => b.totalVotes - a.totalVotes)[0];
            try {
                await updateDoc(doc(db, 'cats', catId), {
                    isNamed: true,
                    name: winner.name,
                    updatedAt: serverTimestamp()
                });
                showToast(`★ Oylama tamamlandı: ${targetCat.code} artık resmi olarak "${winner.name}"!`);
            } catch (err) {
                showToast(`[!] Oylama sonlandırılamadı: ${err.message}`);
            }
        });
    });
}

function renderAdminVaccines() {
    const tbody = document.getElementById('adminVaccineTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    vaccinesData.forEach(vac => {
        const cat = catsData.find(c => c.id === vac.catId) || { name: 'Silinmiş Kedi' };
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="Kedi"><strong>${escapeHtml(cat.name)}</strong></td>
            <td data-label="Aşı Türü">${escapeHtml(vac.type)}</td>
            <td data-label="Tarih">${escapeHtml(vac.date)}</td>
            <td data-label="Durum">
                <select class="art-select" data-change-vac-status="${escapeHtml(vac.id)}" style="padding:4px 8px; font-size:0.85rem;">
                    <option value="upcoming" ${vac.status === 'upcoming' ? 'selected' : ''}>· Planlandı</option>
                    <option value="urgent" ${vac.status === 'urgent' ? 'selected' : ''}>! Günü Geldi</option>
                    <option value="done" ${vac.status === 'done' ? 'selected' : ''}>✓ Tamamlandı</option>
                </select>
            </td>
            <td data-label="Sil">
                <button type="button" class="art-btn btn-danger btn-sm" data-del-vac="${escapeHtml(vac.id)}">✕</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('[data-change-vac-status]').forEach(select => {
        select.addEventListener('change', async () => {
            const vacId = select.getAttribute('data-change-vac-status');
            const targetVac = vaccinesData.find(v => v.id === vacId);
            if (!targetVac) return;
            const newStatus = select.value;
            try {
                await updateDoc(doc(db, 'vaccines', vacId), { status: newStatus });
                const updatedVacs = vaccinesData.map(v => v.id === vacId ? { ...v, status: newStatus } : v);
                const meta = computeCatVaccineSummary(targetVac.catId, updatedVacs);
                await updateDoc(doc(db, 'cats', targetVac.catId), {
                    vaccineSummary: meta.summary,
                    vaccineDue: meta.due,
                    updatedAt: serverTimestamp()
                });
                showToast('✚ Aşı durumu güncellendi.');
            } catch (err) {
                showToast(`[!] Güncellenemedi: ${err.message}`);
            }
        });
    });

    tbody.querySelectorAll('[data-del-vac]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const vacId = btn.getAttribute('data-del-vac');
            const targetVac = vaccinesData.find(v => v.id === vacId);
            try {
                await deleteDoc(doc(db, 'vaccines', vacId));
                if (targetVac) {
                    const remainingVacs = vaccinesData.filter(v => v.id !== vacId);
                    const meta = computeCatVaccineSummary(targetVac.catId, remainingVacs);
                    await updateDoc(doc(db, 'cats', targetVac.catId), {
                        vaccineSummary: meta.summary,
                        vaccineDue: meta.due,
                        updatedAt: serverTimestamp()
                    });
                }
                showToast('✕ Aşı kaydı silindi.');
            } catch (err) {
                showToast(`[!] Silinemedi: ${err.message}`);
            }
        });
    });
}

function initPhotoLightbox() {
    const modal = document.getElementById('photoLightboxModal');
    if (!modal || modal.dataset.lightboxBound === '1') return;
    modal.dataset.lightboxBound = '1';

    const imgEl = document.getElementById('photoLightboxImg');
    const titleEl = document.getElementById('photoLightboxTitle');
    const nameEl = document.getElementById('photoLightboxName');
    const bioEl = document.getElementById('photoLightboxBio');
    const prevBtn = document.getElementById('photoLightboxPrevBtn');
    const nextBtn = document.getElementById('photoLightboxNextBtn');
    const counterEl = document.getElementById('photoLightboxCounter');
    const thumbsEl = document.getElementById('photoLightboxThumbs');

    let currentPhotos = [];
    let currentIndex = 0;
    let currentName = 'Kampüs Kedisi';

    const renderGalleryFrame = () => {
        if (!imgEl || currentPhotos.length === 0) return;
        const safeIdx = ((currentIndex % currentPhotos.length) + currentPhotos.length) % currentPhotos.length;
        currentIndex = safeIdx;
        imgEl.src = currentPhotos[safeIdx];
        imgEl.alt = `${currentName} (${safeIdx + 1}/${currentPhotos.length})`;

        const hasMulti = currentPhotos.length > 1;
        prevBtn?.classList.toggle('hidden', !hasMulti);
        nextBtn?.classList.toggle('hidden', !hasMulti);
        counterEl?.classList.toggle('hidden', !hasMulti);
        thumbsEl?.classList.toggle('hidden', !hasMulti);

        if (counterEl && hasMulti) {
            counterEl.textContent = `${safeIdx + 1} / ${currentPhotos.length}`;
        }
        if (thumbsEl) {
            thumbsEl.querySelectorAll('.photo-lightbox-thumb').forEach((thumbBtn, idx) => {
                thumbBtn.classList.toggle('active', idx === safeIdx);
            });
        }
    };

    const closeModal = () => {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    };

    const openFromTrigger = trigger => {
        const listAttr = trigger.getAttribute('data-photo-list') || '';
        const fallbackSrc = trigger.getAttribute('data-photo-src') || '';
        let photos = [];
        try {
            const parsed = JSON.parse(listAttr);
            if (Array.isArray(parsed)) photos = parsed.filter(Boolean).slice(0, 3);
        } catch (e) { /* fallback to single src */ }
        if (photos.length === 0 && fallbackSrc) photos = [fallbackSrc];
        if (photos.length === 0 || !imgEl) return;

        currentPhotos = photos;
        currentIndex = 0;
        currentName = trigger.getAttribute('data-photo-name') || 'Kampüs Kedisi';
        const code = trigger.getAttribute('data-photo-code') || '';
        const bio = trigger.getAttribute('data-photo-bio') || '';

        if (titleEl) titleEl.textContent = code ? `✦ ${code} · ${currentName}` : `✦ ${currentName}`;
        if (nameEl) nameEl.textContent = currentName;
        if (bioEl) bioEl.textContent = bio;

        if (thumbsEl) {
            thumbsEl.innerHTML = '';
            if (currentPhotos.length > 1) {
                currentPhotos.forEach((url, idx) => {
                    const thumbBtn = document.createElement('button');
                    thumbBtn.type = 'button';
                    thumbBtn.className = `photo-lightbox-thumb${idx === 0 ? ' active' : ''}`;
                    thumbBtn.setAttribute('aria-label', `${idx + 1}. fotoğrafa geç`);
                    thumbBtn.innerHTML = `<img src="${escapeHtml(url)}" alt="">`;
                    thumbBtn.addEventListener('click', () => {
                        currentIndex = idx;
                        renderGalleryFrame();
                    });
                    thumbsEl.appendChild(thumbBtn);
                });
            }
        }

        renderGalleryFrame();
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    };

    prevBtn?.addEventListener('click', () => {
        if (currentPhotos.length <= 1) return;
        currentIndex -= 1;
        renderGalleryFrame();
    });

    nextBtn?.addEventListener('click', () => {
        if (currentPhotos.length <= 1) return;
        currentIndex += 1;
        renderGalleryFrame();
    });

    const stageEl = modal.querySelector('.photo-lightbox-stage');
    if (stageEl) {
        let touchStartX = 0;
        let touchStartY = 0;
        stageEl.addEventListener('touchstart', e => {
            if (currentPhotos.length <= 1 || !e.touches[0]) return;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
        stageEl.addEventListener('touchend', e => {
            if (currentPhotos.length <= 1 || !e.changedTouches[0]) return;
            const dx = e.changedTouches[0].clientX - touchStartX;
            const dy = e.changedTouches[0].clientY - touchStartY;
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
                currentIndex += dx < 0 ? 1 : -1;
                renderGalleryFrame();
            }
        }, { passive: true });
    }

    document.addEventListener('click', e => {
        if (e.target.closest('[data-close-lightbox]') || e.target === modal) {
            closeModal();
            return;
        }
        const trigger = e.target.closest('[data-lightbox-open]');
        if (trigger) {
            openFromTrigger(trigger);
        }
    });

    document.addEventListener('keydown', e => {
        if (!modal.classList.contains('hidden')) {
            if (e.key === 'Escape') {
                closeModal();
                return;
            }
            if (e.key === 'ArrowLeft' && currentPhotos.length > 1) {
                e.preventDefault();
                currentIndex -= 1;
                renderGalleryFrame();
                return;
            }
            if (e.key === 'ArrowRight' && currentPhotos.length > 1) {
                e.preventDefault();
                currentIndex += 1;
                renderGalleryFrame();
                return;
            }
        }
        if ((e.key === 'Enter' || e.key === ' ') && e.target?.hasAttribute?.('data-lightbox-open')) {
            e.preventDefault();
            openFromTrigger(e.target);
        }
    });
}

// ==========================================
// UYGULAMA BAŞLATMA
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Ana Sayfa Filtre ve Arama Eventleri
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter');
            renderCatArchive();
        });
    });

    const searchInput = document.getElementById('catSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', e => {
            searchQuery = e.target.value;
            renderCatArchive();
        });
    }

    const vacFilter = document.getElementById('vaccineStatusFilter');
    if (vacFilter) {
        vacFilter.addEventListener('change', () => {
            renderPublicVaccineTable();
        });
    }

    const isAdminPage = Boolean(document.getElementById('adminAuthGate'));

    // Sayfanın en üstüne akıcı kaydırma (footer ikon/başlık tıklaması)
    document.getElementById('backToTopLink')?.addEventListener('click', e => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    if (isAdminPage) {
        initAdminAuthControls();
        initAdminForms();
    } else {
        // İlk yüklemede kutu boş kalmasın diye hemen önizleme arayüzünü çiz
        initPhotoLightbox();
        refreshPublicUI();
    }

    // Gerçek Zamanlı Firestore Dinleyicilerini Başlat
    startPublicRealtimeListeners();

    // Firebase Auth Durumunu Takip Et
    let authResolved = false;
    onAuthStateChanged(auth, async user => {
        authResolved = true;
        if (isAdminPage) {
            try {
                await resolveAndHandleAdminUser(user);
            } catch (err) {
                console.error('Auth resolution error:', err);
                showToast(`[!] Yetki kontrolü sırasında hata oluştu: ${err.message}`);
                setAuthGateScreen('authLoginBox');
            }
        } else {
            // Ana sayfada giriş ekranı yok — ziyaretçi oylaması için sessiz anonim oturum aç
            if (!user) {
                try {
                    await signInAnonymously(auth);
                } catch (err) {
                    console.warn('Silent anonymous auth failed:', err.code || err.message);
                }
            }
            renderPublicPolls();
        }
    });

    if (isAdminPage) {
        setTimeout(() => {
            if (!authResolved && window.location.protocol !== 'file:') {
                setAuthGateScreen('authLoginBox');
            }
        }, 4000);
    }
});
