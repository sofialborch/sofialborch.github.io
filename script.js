const TR = {
    nb: {
        title: "Tilgjengelighet", printBtn: "Skriv ut", today: "I dag", quickOutlook: "Hurtigoversikt",
        selectWeek: "Velg uke", wk: "Uke", ledig: "Ledig", opptatt: "Opptatt", delvis: "Delvis",
        lookup: "Søk", start: "Fra dato", end: "Til dato", searchBtn: "Søk i periode",
        fra: "Fra", til: "Til",
        printSettings: "Utskrift", certaintyLabel: "Bekreftet status til",
        generatePdf: "Generer PDF", loading: "Laster...", online: "Tilkoblet", local: "Lokal økt",
        noPlans: "Ingen planer registrert.", week: "Uke", monthLocale: 'nb-NO',
        days: ['M', 'T', 'O', 'T', 'F', 'L', 'S'],
        reqTitle: "Send Forespørsel"
    },
    en: {
        title: "Availability", printBtn: "Print Schedule", today: "Today", quickOutlook: "Quick Outlook",
        selectWeek: "Select Week", wk: "Wk", ledig: "Available", opptatt: "Busy", delvis: "Partial",
        lookup: "Lookup", start: "Start Date", end: "End Date", searchBtn: "Search Range",
        fra: "From", til: "To",
        printSettings: "Print Settings", certaintyLabel: "Status Secured Until",
        generatePdf: "Generate PDF", loading: "Loading...", online: "Online", local: "Local Session",
        noPlans: "No specific plans logged.", week: "Week", monthLocale: 'en-GB',
        days: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
        reqTitle: "Send Request"
    }
};

const DYNAMIC_TR = {
    "studying": "studerer",
    "working": "jobber",
    "norønna": "norønna",
    "weekend": "helg",
    "vacation": "ferie",
    "traveling": "reiser",
    "at home": "hjemme",
    "busy": "opptatt",
    "available": "tilgjengelig"
};

let CURRENT_LANG = 'nb';
let DATA_STORE = { overrides: {}, settings: { certainUntil: '', phone: '' } };
let currentViewDate = new Date();

// Edit State Variables
let currentEditDate = null;
let currentEditStatus = 'available';
let currentBadge = null;

// Request State
let selectedRequestDates = new Set();

const getLocalDateString = (date) => date.toLocaleDateString('en-CA');
const t = (key) => TR[CURRENT_LANG][key] || key;

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-mode');
    const icon = document.getElementById('theme-icon');
    icon.className = isLight ? 'fas fa-sun text-base lg:text-lg' : 'fas fa-moon text-base lg:text-lg';
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
}

function translateNote(note) {
    if (!note || CURRENT_LANG === 'en') return note;
    let translated = note.toLowerCase();
    Object.keys(DYNAMIC_TR).forEach(key => {
        translated = translated.replace(new RegExp(key, 'g'), DYNAMIC_TR[key]);
    });
    return translated.charAt(0).toUpperCase() + translated.slice(1);
}

function toggleLanguage() {
    CURRENT_LANG = CURRENT_LANG === 'nb' ? 'en' : 'nb';
    localStorage.setItem('lang', CURRENT_LANG); 
    updateLanguageUI();
    init();
}

function updateLanguageUI() {
    document.getElementById('lang-flag').innerText = CURRENT_LANG === 'nb' ? '🇳🇴' : '🇬🇧';
    document.getElementById('lang-label').innerText = CURRENT_LANG.toUpperCase();
    document.querySelectorAll('[data-tr]').forEach(el => el.innerText = t(el.dataset.tr));
}

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getDateFromWeek(week, year) {
    const d = new Date(year, 0, 1);
    const dayNum = d.getDay();
    const diff = (dayNum <= 4 ? 1 - dayNum : 8 - dayNum);
    d.setDate(d.getDate() + diff + (week - 1) * 7);
    return d;
}

// MODIFIED: Fetches from Firestore
async function loadData() {
    // Explicitly handle Theme Loading
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        document.getElementById('theme-icon').className = 'fas fa-sun text-base lg:text-lg';
    } else {
        document.body.classList.remove('light-mode');
        document.getElementById('theme-icon').className = 'fas fa-moon text-base lg:text-lg';
    }
    
    // Load language
    const savedLang = localStorage.getItem('lang');
    if (savedLang && (savedLang === 'nb' || savedLang === 'en')) {
        CURRENT_LANG = savedLang;
        updateLanguageUI();
    }

    // Database Fetch
    try {
        updateStatus(t('loading'), "blue");
        
        // Wait for Firestore to be ready in window
        let attempts = 0;
        while (!window.dbFormat && attempts < 10) {
            await new Promise(r => setTimeout(r, 200));
            attempts++;
        }

        if (window.dbFormat) {
            const querySnapshot = await window.dbFormat.getDocs(window.dbFormat.collection(window.db, "availability"));
            
            // Only overwrite if we actually got data, otherwise keep empty to allow manual upload
            if(!querySnapshot.empty) {
                DATA_STORE.overrides = {};
                querySnapshot.forEach((doc) => {
                    DATA_STORE.overrides[doc.id] = doc.data();
                });
                updateStatus(t('online'), "emerald");
            } else {
                console.log("Firestore empty, ready for migration.");
                updateStatus("Waiting for Data", "gray");
            }
            
            // Using placeholder settings for now
            DATA_STORE.settings = { certainUntil: '', phone: '' };
        } else {
            throw new Error("Firestore not initialized");
        }
    } catch (e) {
        console.error("Cloud fetch failed, using fallback:", e);
        // Fallback to local JSON
        try {
            const response = await fetch('availability.json');
            if (response.ok) {
                const data = await response.json();
                DATA_STORE.overrides = data.overrides || data;
                DATA_STORE.settings = data.settings || { certainUntil: '', phone: '' };
            }
        } catch(err) {}
        updateStatus(t('local'), "gray");
    }
    init();
}

// Function to trigger migration from script.js
function triggerMigration() {
    if(window.uploadLocalDataToFirestore && DATA_STORE.overrides) {
        window.uploadLocalDataToFirestore(DATA_STORE.overrides);
    } else {
        alert("Migration tool not ready or no data loaded.");
    }
}
window.triggerMigration = triggerMigration;

function updateStatus(text, color) {
    const el = document.getElementById('sync-status');
    if(!el) return;
    
    // Safety check for Tailwind colors to prevent breaking classes if "blue" isn't standard
    const safeColors = {
        emerald: 'text-emerald-500',
        gray: 'text-gray-500',
        blue: 'text-blue-500',
        busy: 'text-red-500'
    };
    
    // Remove old colors
    el.classList.remove('text-emerald-500', 'text-gray-500', 'text-blue-500', 'text-red-500');
    
    // Add new color and text
    if (safeColors[color]) el.classList.add(safeColors[color]);
    el.innerText = text;
    el.classList.remove('hidden');
    el.classList.add('inline-block'); // Ensure it shows
}

function handleManualUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    updateStatus("Reading...", "blue");
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const json = JSON.parse(e.target.result);
            DATA_STORE.overrides = json.overrides || json;
            DATA_STORE.settings = json.settings || { certainUntil: '', phone: '' };
            updateStatus("Ready to Sync", "emerald");
            init();
        } catch (err) { alert("Invalid JSON file."); }
    };
    reader.readAsText(file);
}

function getInfo(dateStr) {
    const date = new Date(dateStr + "T00:00:00");
    const day = date.getDay();
    if (day === 0 || day === 6) return { status: 'weekend', note: translateNote('Weekend'), badge: '' };
    const entry = DATA_STORE.overrides[dateStr];
    let status = 'available', note = '', badge = '';
    if (typeof entry === 'object' && entry !== null) {
        status = entry.status || 'available';
        note = translateNote(entry.note) || '';
        badge = entry.badge || '';
    } else if (entry) { status = entry; }
    
    // Auto-detect legacy badges if not explicitly set in DB
    if (!badge) {
        const ln = note.toLowerCase();
        if (ln.includes('norønna')) badge = 'NR';
        else if (ln.includes('polarmåsen')) badge = 'PM';
        else if (ln.includes('studer')) badge = 'ST';
    }
    return { status, note, badge };
}

function init() {
    const today = new Date();
    const todayStr = getLocalDateString(today);
    
    const existingVal = document.getElementById('week-selector').value;
    const initialWeek = existingVal ? parseInt(existingVal) : getWeekNumber(today);

    populateWeekDropdown(initialWeek);
    renderHero(todayStr);
    renderWeekSummary(initialWeek);
    renderCalendar(todayStr);
    
    if(!document.getElementById('lookup-start').value) {
        document.getElementById('lookup-start').value = todayStr;
    }

    if (DATA_STORE.settings.certainUntil) {
        const cDate = new Date(DATA_STORE.settings.certainUntil + "T00:00:00");
        document.getElementById('certainty-date-label').innerText = cDate.toLocaleDateString(t('monthLocale'), { day:'2-digit', month:'long', year:'numeric' });
        document.getElementById('print-end-month').value = cDate.toISOString().slice(0, 7);
        document.getElementById('certainty-notice').classList.remove('hidden');
    } else { document.getElementById('certainty-notice').classList.add('hidden'); }
    
    if(!document.getElementById('print-start-month').value) {
        document.getElementById('print-start-month').value = today.toISOString().slice(0, 7);
    }
    
    // Clear selection on re-init
    updateRequestSidebar(); 
}

function populateWeekDropdown(currentWeek) {
    const selector = document.getElementById('week-selector');
    if(selector.options.length > 0) return;

    selector.innerHTML = '';
    for (let i = 1; i <= 52; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.innerText = `${t('week')} ${i}`;
        if (i === currentWeek) opt.selected = true;
        selector.appendChild(opt);
    }
}

function onWeekChange(week) { 
    renderWeekSummary(parseInt(week)); 
}

function renderHero(todayStr) {
    const info = getInfo(todayStr);
    document.getElementById('hero-date').innerText = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }).replace('/', '.');
    document.getElementById('hero-note').innerText = info.note || t('noPlans');
    document.getElementById('hero-label').innerText = translateNote(t(info.status));
    
    const statusColor = getComputedStyle(document.documentElement).getPropertyValue(`--${info.status}`).trim();
    document.getElementById('hero-dot').style.backgroundColor = statusColor || '#333';
}

function renderWeekSummary(weekNumber) {
    const container = document.getElementById('week-summary-grid');
    container.innerHTML = '';
    const monday = getDateFromWeek(weekNumber, new Date().getFullYear());
    const todayStr = getLocalDateString(new Date());
    for (let i = 0; i < 5; i++) {
        const curr = new Date(monday); curr.setDate(monday.getDate() + i);
        const ds = getLocalDateString(curr); const info = getInfo(ds);
        const div = document.createElement('div');
        div.className = `summary-card status-${info.status}-card cursor-pointer ${ds === todayStr ? 'is-today' : ''} ${selectedRequestDates.has(ds) ? 'request-selected' : ''}`;
        
        div.onclick = () => { 
            if (window.isAdmin) {
                openEditModal(ds, info);
            } else {
                toggleRequestDate(ds);
            }
        };

        div.innerHTML = `
            <div class="flex flex-col gap-0.5 mb-1 lg:mb-2">
                <span class="text-[14px] lg:text-[16px] font-black opacity-90 tracking-tighter">${String(curr.getDate()).padStart(2, '0')}.${String(curr.getMonth() + 1).padStart(2, '0')}</span>
                <span class="text-[9px] lg:text-xs font-black uppercase opacity-60 tracking-widest">${curr.toLocaleDateString(t('monthLocale'), {weekday: 'short'})}</span>
            </div>
            <div class="py-2 lg:py-4 flex flex-col items-center">
                ${info.badge ? `<span class="badge badge-${info.badge.toLowerCase()} text-lg lg:text-2xl font-black">${info.badge}</span>` : `<i class="fas ${info.status === 'available' ? 'fa-check text-[var(--available)]' : 'fa-minus text-[var(--busy)]'} text-lg lg:text-2xl opacity-40"></i>`}
            </div>
            <span class="text-[10px] lg:text-sm font-bold opacity-90 line-clamp-2 leading-tight">${info.note || translateNote(t(info.status))}</span>`;
        container.appendChild(div);
    }
}

function renderCalendar(todayStr) {
    const headerEl = document.getElementById('calendar-header');
    headerEl.innerHTML = '';
    
    const weekLabel = document.createElement('div');
    weekLabel.className = "opacity-60";
    weekLabel.innerText = t('wk');
    headerEl.appendChild(weekLabel);
    
    const daysArr = t('days');
    daysArr.forEach((day, index) => {
        const d = document.createElement('div');
        d.innerText = day;
        if (index >= 5) d.className = "text-pink-500/80";
        headerEl.appendChild(d);
    });

    const daysEl = document.getElementById('calendar-days');
    daysEl.innerHTML = '';
    const year = currentViewDate.getFullYear(); const month = currentViewDate.getMonth();
    document.getElementById('calendar-month').innerText = new Intl.DateTimeFormat(t('monthLocale'), { month: 'short' }).format(currentViewDate);
    let firstDay = new Date(year, month, 1).getDay();
    let padding = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayObj = new Date(); todayObj.setHours(0,0,0,0);
    let currentDay = 1;
    for (let r = 0; r < 6; r++) {
        if (currentDay > daysInMonth && r > 0) break;
        const wkCell = document.createElement('div'); wkCell.className = 'week-num-cell';
        wkCell.innerText = getWeekNumber(new Date(year, month, currentDay === 1 ? 1 : currentDay));
        daysEl.appendChild(wkCell);
        for (let c = 0; c < 7; c++) {
            const pos = r * 7 + c;
            if (pos < padding || currentDay > daysInMonth) {
                daysEl.appendChild(document.createElement('div')).className = 'day-cell opacity-0 pointer-events-none';
            } else {
                const date = new Date(year, month, currentDay); const ds = getLocalDateString(date); const info = getInfo(ds);
                const isSelected = selectedRequestDates.has(ds);
                const div = document.createElement('div');
                div.className = `day-cell status-${info.status} ${date < todayObj ? 'day-past' : ''} ${ds === todayStr ? 'today-focus' : ''} ${isSelected ? 'request-selected' : ''}`;
                
                div.onclick = () => { 
                    if (window.isAdmin) {
                        openEditModal(ds, info);
                    } else {
                        // Toggle Request Mode
                        toggleRequestDate(ds);
                    }
                };

                div.innerHTML = info.badge ? `<span class=\"badge badge-${info.badge.toLowerCase()}\">${info.badge}</span>` : `<span class=\"font-bold\">${currentDay}</span>`;
                if (info.note) {
                    const tip = document.createElement('span'); tip.className = 'tooltip'; tip.innerText = info.note; div.appendChild(tip);
                }
                daysEl.appendChild(div); currentDay++;
            }
        }
    }
}

// --- REQUEST FEATURE LOGIC ---

function toggleRequestDate(dateStr) {
    if(selectedRequestDates.has(dateStr)) {
        selectedRequestDates.delete(dateStr);
    } else {
        selectedRequestDates.add(dateStr);
    }
    
    // Refresh UI
    renderCalendar(getLocalDateString(new Date()));
    // If current week view contains this date, refresh it too
    const weekSel = document.getElementById('week-selector').value;
    if(weekSel) renderWeekSummary(parseInt(weekSel));
    
    updateRequestSidebar();
}

function updateRequestSidebar() {
    const panel = document.getElementById('request-panel');
    const lookupPanel = document.getElementById('lookup-panel');
    const list = document.getElementById('request-list');
    const count = document.getElementById('request-count');
    
    if (selectedRequestDates.size > 0) {
        panel.classList.remove('hidden');
        lookupPanel.classList.add('hidden'); // Swap panels
        count.innerText = selectedRequestDates.size;
        
        list.innerHTML = '';
        Array.from(selectedRequestDates).sort().forEach(ds => {
            const d = new Date(ds);
            const info = getInfo(ds);
            const item = document.createElement('div');
            item.className = "flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10";
            item.innerHTML = `
                <div class="flex items-center gap-3">
                    <span class="text-[10px] font-black uppercase text-pink-500">${d.getDate()}.${d.getMonth()+1}</span>
                    <span class="text-xs font-bold opacity-80">${t(info.status)}</span>
                </div>
                <button onclick="toggleRequestDate('${ds}')" class="text-white/40 hover:text-white transition"><i class="fas fa-times"></i></button>
            `;
            list.appendChild(item);
        });
        
        // Mobile scroll to action
        if(window.innerWidth < 1024) {
            panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    } else {
        panel.classList.add('hidden');
        lookupPanel.classList.remove('hidden'); // Show lookup again
    }
}

function openRequestModal() {
    document.getElementById('req-subtitle').innerText = `For ${selectedRequestDates.size} dager`;
    document.getElementById('request-modal').classList.remove('hidden');
}

window.closeRequestModal = function() {
    document.getElementById('request-modal').classList.add('hidden');
}

window.submitRequest = async function() {
    const name = document.getElementById('req-name').value;
    const msg = document.getElementById('req-msg').value;
    
    if(!name) { alert("Vennligst skriv inn navn"); return; }
    
    const reqData = {
        name,
        message: msg,
        dates: Array.from(selectedRequestDates),
        submittedAt: new Date().toISOString()
    };
    
    try {
        await window.dbFormat.addDoc(window.dbFormat.collection(window.db, "requests"), reqData);
        alert("Forespørsel sendt!");
        selectedRequestDates.clear();
        document.getElementById('req-name').value = '';
        document.getElementById('req-msg').value = '';
        closeRequestModal();
        init(); // Resets UI
    } catch(e) {
        if(e.code === 'permission-denied') {
            alert("Kunne ikke sende: Mangler tillatelser (Prøv å laste siden på nytt)");
        } else {
            alert("Kunne ikke sende: " + e.message);
        }
    }
}

// Global exposure
window.toggleRequestDate = toggleRequestDate;
window.openRequestModal = openRequestModal;


function changeMonth(offset) { currentViewDate.setMonth(currentViewDate.getMonth() + offset); renderCalendar(getLocalDateString(new Date())); }

function runLookup() {
    const startStr = document.getElementById('lookup-start').value;
    const endStr = document.getElementById('lookup-end').value;
    const resultsEl = document.getElementById('lookup-results');
    if (!startStr) return;
    document.getElementById('lookup-container').classList.remove('hidden');
    resultsEl.innerHTML = '';
    let current = new Date(startStr + "T00:00:00");
    const end = endStr ? new Date(endStr + "T00:00:00") : new Date(startStr + "T00:00:00");
    let currentWeek = -1;
    while (current <= end) {
        const ds = getLocalDateString(current); const info = getInfo(ds); const wk = getWeekNumber(current);
        if (info.status !== 'weekend') {
            if (wk !== currentWeek) {
                currentWeek = wk;
                resultsEl.appendChild(Object.assign(document.createElement('div'), {
                    className: 'flex items-center gap-3 mb-4 lg:mb-6',
                    innerHTML: `<span class="text-[10px] lg:text-sm font-black uppercase tracking-widest bg-pink-500/10 text-pink-500 px-4 py-1.5 lg:px-5 lg:py-2 rounded-full">${t('week')} ${wk}</span>`
                }));
                var weekGroup = resultsEl.appendChild(Object.assign(document.createElement('div'), { className: 'lookup-week-group space-y-4' }));
            }
            weekGroup.appendChild(Object.assign(document.createElement('div'), {
                className: 'flex items-center justify-between p-4 lg:p-6 rounded-xl lg:rounded-2xl bg-white/10 border border-white/20 hover:bg-white/30 transition-all group',
                innerHTML: `
                    <div class="flex flex-col">
                        <span class="text-[10px] lg:text-sm font-black uppercase opacity-60 group-hover:opacity-100 transition-opacity">${current.toLocaleDateString(t('monthLocale'), {weekday: 'short'})} ${current.getDate()}.${String(current.getMonth()+1).padStart(2,'0')}</span>
                        <span class="text-sm lg:text-base font-bold mt-1">${info.note || t('noPlans')}</span>
                    </div>
                    <div class="flex items-center gap-4 lg:gap-6">
                        ${info.badge ? `<span class="badge badge-${info.badge.toLowerCase()} opacity-60">${info.badge}</span>` : ''}
                        <span class="text-[9px] lg:text-xs font-black uppercase tracking-widest ${info.status === 'available' ? 'text-[var(--available)]' : 'text-[var(--busy)]'}">${t(info.status)}</span>
                    </div>`
            }));
        }
        current.setDate(current.getDate() + 1);
    }
}

function togglePrintModal() { document.getElementById('print-modal').classList.toggle('hidden'); }

// --- ADMIN FUNCTIONS ---

function openEditModal(dateStr, info) {
    currentEditDate = dateStr;
    const dateObj = new Date(dateStr + "T00:00:00");
    document.getElementById('edit-date-display').innerText = dateObj.toLocaleDateString(t('monthLocale'), { weekday: 'long', day: 'numeric', month: 'long' });
    document.getElementById('edit-modal').classList.remove('hidden');
    
    // Set current values
    setEditStatus(info.status === 'weekend' ? 'available' : info.status);
    document.getElementById('edit-note').value = info.note || '';
    
    // Reset badges
    ['NR', 'PM', 'ST'].forEach(b => document.getElementById(`badge-${b.toLowerCase()}`).style.opacity = '0.5');
    currentBadge = null;
    
    if (info.badge) toggleBadge(info.badge);
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

function setEditStatus(status) {
    currentEditStatus = status;
    document.querySelectorAll('.edit-status-btn').forEach(btn => {
        if(btn.dataset.val === status) {
            btn.classList.add('bg-white', 'text-black');
            btn.classList.remove('text-white');
        } else {
            btn.classList.remove('bg-white', 'text-black');
            btn.classList.add('text-white');
        }
    });
}

function toggleBadge(badge) {
    const el = document.getElementById(`badge-${badge.toLowerCase()}`);
    if (currentBadge === badge) {
        // Toggle off
        currentBadge = null;
        el.style.opacity = '0.5';
    } else {
        // Toggle on (and others off)
        ['NR', 'PM', 'ST'].forEach(b => document.getElementById(`badge-${b.toLowerCase()}`).style.opacity = '0.5');
        currentBadge = badge;
        el.style.opacity = '1';
    }
}

async function saveDay() {
    if (!currentEditDate || !window.isAdmin) return;
    
    const note = document.getElementById('edit-note').value;
    const data = {
        status: currentEditStatus,
        note: note,
        badge: currentBadge || null
    };

    try {
        await window.dbFormat.setDoc(window.dbFormat.doc(window.db, "availability", currentEditDate), data);
        
        // Optimistic UI Update (Update local store instantly)
        DATA_STORE.overrides[currentEditDate] = data;
        init(); // Re-render calendar
        closeEditModal();
    } catch (e) {
        alert("Save failed: " + e.message);
    }
}

async function deleteDay() {
    if (!currentEditDate || !confirm("Clear this day?")) return;
    try {
        await window.dbFormat.deleteDoc(window.dbFormat.doc(window.db, "availability", currentEditDate));
        delete DATA_STORE.overrides[currentEditDate];
        init();
        closeEditModal();
    } catch(e) {
        alert("Delete failed: " + e.message);
    }
}

// Expose functions globally for HTML
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.setEditStatus = setEditStatus;
window.toggleBadge = toggleBadge;
window.saveDay = saveDay;
window.deleteDay = deleteDay;


function executePrint() {
    const sm = document.getElementById('print-start-month').value;
    const em = document.getElementById('print-end-month').value;
    if(!sm || !em) return;
    const start = new Date(sm + "-01T00:00:00"); const end = new Date(em + "-01T00:00:00");
    end.setMonth(end.getMonth() + 1); end.setDate(0);
    generatePrintSummary(start, end); togglePrintModal();
}

function generatePrintSummary(start, end) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent("sofialborch.github.io")}`;
    const printWindow = window.open('', '_blank');
    let html = `<html><head><title>${t('title')}</title><style>
        @page { margin: 0.5cm; size: A4; }
        body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; color: #000; -webkit-print-color-adjust: exact; }
        header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #000; padding: 10px 0; margin-bottom: 15px; }
        h1 { margin: 0; font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: -1px; }
        .meta { font-weight: bold; color: #666; font-size: 9px; text-transform: uppercase; }
        .month-title { font-size: 15px; font-weight: 900; text-transform: uppercase; border-left: 10px solid #000; padding: 4px 12px; margin: 25px 0 10px 0; display: inline-block; break-after: avoid; }
        .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); border: 2px solid #000; margin-bottom: 20px; page-break-inside: avoid; }
        .day-header { background: #000; color: #fff; padding: 5px; font-weight: 900; font-size: 9px; text-transform: uppercase; text-align: center; border: 1px solid #000; }
        .day-cell { background: #fff; min-height: 55px; padding: 5px; border: 1px solid #000; position: relative; overflow: hidden; }
        .day-top { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
        .day-num { font-weight: 900; font-size: 12px; line-height: 1; }
        .status-badge { font-size: 7.5px; font-weight: 900; text-transform: uppercase; background: #000; color: #fff; padding: 2px 6px; border-radius: 99px; white-space: nowrap; }
        .note-text { font-size: 10px; line-height: 1.1; color: #000; font-weight: 700; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .busy-cell { background: #fee2e2 !important; } .available-cell { background: #f0fdf4 !important; } .partial-cell { background: #fef3c7 !important; } .weekend-cell { background: #f8fafc !important; }
        .footer { display: flex; justify-content: space-between; align-items: flex-end; page-break-inside: avoid; }
        .qr-box img { width: 80px; height: 80px; border: 1px solid #000; }
        .trademark { font-weight: 900; font-size: 11px; letter-spacing: 2px; }
        @media print { .no-print { display: none; } }
    </style></head><body>
    <div class="no-print" style=\"padding: 10px; text-align: center; background: #eee; position: sticky; top: 0;\"><button onclick=\"window.print()\" style=\"padding: 10px 40px; font-weight: 900; cursor: pointer; background: #000; color: #fff; border: none; border-radius: 6px;\">PRINT PDF</button></div>
    <div style=\"padding: 20px;\">
    <header><div><h1>${t('title')}</h1><div class=\"meta\">${start.toLocaleDateString(t('monthLocale'), {month:'long', year:'numeric'})} - ${end.toLocaleDateString(t('monthLocale'), {month:'long', year:'numeric'})}</div></div><div class=\"trademark\">Z03Y &trade;</div></header>`;
    const dayNames = CURRENT_LANG === 'nb' ? ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let iter = new Date(start); let curM = -1; let mRend = 0;
    while (iter <= end) {
        if (iter.getMonth() !== curM) {
            if (curM !== -1) html += `</div>`;
            if (mRend > 0 && mRend % 2 === 0) html += `<div style=\"page-break-after: always;\"></div>`;
            curM = iter.getMonth(); mRend++;
            html += `<div class=\"month-title\">${iter.toLocaleString(t('monthLocale'), { month: 'long', year: 'numeric' })}</div><div class=\"calendar-grid\">`;
            dayNames.forEach(d => html += `<div class=\"day-header\">${d}</div>`);
            let padding = new Date(iter.getFullYear(), iter.getMonth(), 1).getDay(); padding = padding === 0 ? 6 : padding - 1;
            for(let p=0; p<padding; p++) html += `<div class=\"day-cell empty\"></div>`;
        }
        const ds = getLocalDateString(iter); const info = getInfo(ds);
        const isW = iter.getDay() === 0 || iter.getDay() === 6; const st = info.status === 'weekend' ? 'weekend' : info.status;
        let bText = info.badge || (st !== 'available' && st !== 'weekend' ? (st === 'partial' ? t('delvis') : t('opptatt')) : '');
        html += `<div class=\"day-cell ${st}-cell ${isW ? 'weekend-cell' : ''}\">
            <div class=\"day-top\"><span class=\"day-num\">${iter.getDate()}</span>${bText ? `<span class=\"status-badge\">${bText}</span>` : ''}</div>
            <div class=\"note-text\">${info.note || ''}</div>
        </div>`;
        let next = new Date(iter); next.setDate(iter.getDate() + 1);
        if (next.getMonth() !== curM || next > end) {
            let last = iter.getDay(); let endP = last === 0 ? 0 : 7 - last;
            for(let ep=0; ep<endP; ep++) html += `<div class=\"day-cell empty\"></div>`;
        }
        iter = next;
    }
    html += `</div><div class=\"footer\"><div><div class=\"trademark\">PROJECT BY Z03Y</div>${DATA_STORE.settings.phone ? `<div style=\"font-size: 14px; font-weight: 900; margin-top: 8px; background: #000; color: #fff; padding: 4px 12px; border-radius: 6px; display: inline-block;\">${DATA_STORE.settings.phone}</div>` : ''}</div><div class=\"qr-box\"><img src=\"${qrUrl}\"><div style=\"font-size: 8px; font-weight: 900; margin-top: 5px; text-align: center;\">LIVE UPDATES</div></div></div></div></body></html>`;
    printWindow.document.write(html); printWindow.document.close();
}
window.onload = loadData;