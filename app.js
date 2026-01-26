const getLocalDateString = (date) => date.toLocaleDateString('en-CA');
const t = (key) => TR[CURRENT_LANG][key] || key;

function toggleTheme() {
    // New logic: Default is Light. Toggle 'dark-mode' class.
    const isDark = document.body.classList.toggle('dark-mode');
    const icon = document.getElementById('theme-icon');
    icon.className = isDark ? 'fas fa-moon text-base lg:text-lg' : 'fas fa-sun text-base lg:text-lg';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
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
    // Update inputs placeholders if needed
    const ph = document.getElementById('bulk-response');
    if(ph) ph.placeholder = t('adminPlaceholder');
    
    // Auth Modal Translations
    const signTitle = document.querySelector('[data-tr="signInTitle"]');
    if(signTitle) signTitle.innerText = t('signInTitle');
    const signGoogle = document.querySelector('[data-tr="signInGoogle"]');
    if(signGoogle) signGoogle.innerText = t('signInGoogle');
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

async function loadData() {
    // Theme Loading: Default to Light (No class) if not set or set to 'light'
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        document.getElementById('theme-icon').className = 'fas fa-moon text-base lg:text-lg';
    } else {
        document.body.classList.remove('dark-mode');
        document.getElementById('theme-icon').className = 'fas fa-sun text-base lg:text-lg';
    }
    
    const savedLang = localStorage.getItem('lang');
    if (savedLang && (savedLang === 'nb' || savedLang === 'en')) {
        CURRENT_LANG = savedLang;
        updateLanguageUI();
    }

    try {
        updateStatus(t('loading'), "blue");
        let attempts = 0;
        while (!window.dbFormat && attempts < 10) {
            await new Promise(r => setTimeout(r, 200));
            attempts++;
        }

        if (window.dbFormat) {
            const querySnapshot = await window.dbFormat.getDocs(window.dbFormat.collection(window.db, "availability"));
            
            if(!querySnapshot.empty) {
                DATA_STORE.overrides = {};
                querySnapshot.forEach((doc) => {
                    DATA_STORE.overrides[doc.id] = doc.data();
                });
                updateStatus(t('online'), "emerald", true);
            } else {
                updateStatus("Waiting for Data", "gray");
            }
            
            // Fetch Global Settings (Phone etc) if stored in a 'config' doc, else defaults
            DATA_STORE.settings = { certainUntil: '', phone: '' }; 
            try {
                 const settingsDoc = await window.dbFormat.getDoc(window.dbFormat.doc(window.db, "config", "main"));
                 if(settingsDoc.exists()) DATA_STORE.settings = { ...DATA_STORE.settings, ...settingsDoc.data() };
            } catch(e) { console.log("No config doc found, using defaults"); }

        } else {
            throw new Error("Firestore not initialized");
        }
    } catch (e) {
        console.error("Cloud fetch failed:", e);
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
    
    // Smooth Preloader Exit
    const preloader = document.getElementById('preloader');
    if (preloader) {
        setTimeout(() => {
            preloader.style.opacity = '0';
            preloader.style.visibility = 'hidden';
        }, 500);
    }
}

function updateStatus(text, color, onlineStatusIndicatorSuccess = false) {
    const el = document.getElementById('sync-status');
    if (!el) return;

    // Configuration for different states
    // Icons: Loading (spin), Success (globe), Local/Offline (database), Error (exclamation)
    const states = {
        blue:    { icon: 'fa-circle-notch fa-spin', color: 'text-blue-500' },
        emerald: { icon: 'fa-globe',                color: 'text-emerald-500' },
        gray:    { icon: 'fa-database',             color: 'text-gray-500' },
        busy:    { icon: 'fa-exclamation-circle',   color: 'text-red-500' }
    };

    const state = states[color] || states.gray;

    // Reset and apply base classes + color
    el.className = `inline-flex items-center gap-2 ${state.color}`;
    
    // Render: Icon always visible, text hidden on small screens (like print button)
    el.innerHTML = `
        <i class="fas ${state.icon} text-lg lg:text-base"></i>
        <span class="hidden sm:inline text-[10px] lg:text-xs font-black uppercase tracking-widest pt-0.5">${text}</span>
    `;
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
    
    if (!badge) {
        const ln = note.toLowerCase();
        if (ln.includes('norønna')) badge = 'NR';
        else if (ln.includes('polarmåsen')) badge = 'PM';
        else if (ln.includes('studer')) badge = 'ST';
        else if (ln.includes('studying')) badge = 'ST';
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
    updateRequestSidebar();
    
    // Tutorial Check
    const tutorialSeen = localStorage.getItem('tutorial_seen');
    if (!tutorialSeen) {
        setTimeout(openTutorial, 1000); // Slight delay for nice entry
    }
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

function onWeekChange(week) { renderWeekSummary(parseInt(week)); }

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
        // Added last:col-span-2 sm:last:col-span-1 to fix mobile grid symmetry for the 5th item
        div.className = `summary-card status-${info.status}-card cursor-pointer last:col-span-2 sm:last:col-span-1 ${ds === todayStr ? 'is-today' : ''} ${selectedRequestDates.has(ds) ? 'request-selected' : ''}`;
        
        div.onclick = () => { 
            if (window.isAdmin) openEditModal(ds, info);
            else toggleRequestDate(ds);
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
    
    t('days').forEach((day, index) => {
        const d = document.createElement('div');
        d.innerText = day;
        if (index >= 5) d.className = "text-pink-500/80";
        headerEl.appendChild(d);
    });

    const daysEl = document.getElementById('calendar-days');
    daysEl.innerHTML = '';
    const year = currentViewDate.getFullYear(); const month = currentViewDate.getMonth();
    document.getElementById('calendar-month').innerText = new Intl.DateTimeFormat(t('monthLocale'), { month: 'short' }).format(currentViewDate);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayObj = new Date(); todayObj.setHours(0,0,0,0);
    let currentDay = 1;
    let padding = new Date(year, month, 1).getDay();
    padding = padding === 0 ? 6 : padding - 1;

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
                    if (window.isAdmin) openEditModal(ds, info);
                    else toggleRequestDate(ds);
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

function toggleRequestDate(dateStr) {
    if(selectedRequestDates.has(dateStr)) selectedRequestDates.delete(dateStr);
    else selectedRequestDates.add(dateStr);
    
    renderCalendar(getLocalDateString(new Date()));
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
        lookupPanel.classList.add('hidden'); 
        count.innerText = selectedRequestDates.size;
        
        list.innerHTML = '';
        Array.from(selectedRequestDates).sort().forEach(ds => {
            const d = new Date(ds);
            const info = getInfo(ds);
            const item = document.createElement('div');
            // Updated: Use dynamic classes for border/bg visibility in light mode
            item.className = "flex items-center justify-between p-3 rounded-xl bg-dynamic border border-dynamic";
            item.innerHTML = `
                <div class="flex items-center gap-3">
                    <span class="text-[10px] font-black uppercase text-pink-500">${d.getDate()}.${d.getMonth()+1}</span>
                    <span class="text-xs font-bold opacity-80">${t(info.status)}</span>
                </div>
                <!-- Updated: Use text-muted-dynamic so it's visible in light mode -->
                <button onclick="toggleRequestDate('${ds}')" class="text-muted-dynamic hover:text-[var(--text-color)] transition"><i class="fas fa-times"></i></button>
            `;
            list.appendChild(item);
        });
        
        if(window.innerWidth < 1024) panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        panel.classList.add('hidden');
        lookupPanel.classList.remove('hidden');
    }
}

function openRequestModal() {
    document.getElementById('req-subtitle').innerText = `For ${selectedRequestDates.size} dager`;
    document.getElementById('request-modal').classList.remove('hidden');
    
    // NEW: Auto-fill Name if Logged In
    const user = window.auth.currentUser;
    if (user && !user.isAnonymous && user.displayName) {
        const nameInput = document.getElementById('req-name');
        nameInput.value = user.displayName;
    }
    
    // NEW: Inject Phone Number / Login Tip dynamically
    const footer = document.getElementById('req-modal-footer');
    if(footer) {
        let footerHtml = '';
        if(DATA_STORE.settings.phone) {
             footerHtml += `<p class="text-[11px] font-black uppercase tracking-widest opacity-60 mt-4 text-center">
                ${t('callMe')} <span class="text-[var(--text-color)] select-all">${DATA_STORE.settings.phone}</span>
             </p>`;
        }
        if(!user || user.isAnonymous) {
             footerHtml += `<p class="text-[11px] font-medium text-pink-400/80 mt-2 text-center italic cursor-pointer hover:text-pink-400" onclick="toggleAuthModal()">
                ${t('loginTip')}
             </p>`;
        }
        footer.innerHTML = footerHtml;
    }
}

window.closeRequestModal = function() {
    document.getElementById('request-modal').classList.add('hidden');
}

window.submitRequest = async function() {
    const name = document.getElementById('req-name').value;
    const msg = document.getElementById('req-msg').value;
    if(!name) { alert("Vennligst skriv inn navn"); return; }
    
    // NEW: ID Generation & UID linking
    const reqId = "req_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    const user = window.auth.currentUser;
    const isAnon = !user || user.isAnonymous;
    
    const reqData = {
        id: reqId,
        name, message: msg, 
        dates: Array.from(selectedRequestDates), 
        submittedAt: new Date().toISOString(),
        status: 'pending', // pending, approved, rejected
        uid: !isAnon ? user.uid : null // Link to user if logged in
    };
    
    try {
        await window.dbFormat.setDoc(window.dbFormat.doc(window.db, "requests", reqId), reqData); // Use setDoc with ID
        
        // NEW: Local Storage Tracking (Backup for everyone)
        let localTracks = JSON.parse(localStorage.getItem('my_requests') || '[]');
        localTracks.push(reqId);
        localStorage.setItem('my_requests', JSON.stringify(localTracks));
        
        selectedRequestDates.clear();
        document.getElementById('req-name').value = '';
        document.getElementById('req-msg').value = '';
        closeRequestModal();
        
        // Show New Confirmation Modal
        document.getElementById('request-sent-modal').classList.remove('hidden');
        
        init();
        if(window.checkRequestStatus) window.checkRequestStatus(); // Refresh tracker
    } catch(e) {
        alert("Kunne ikke sende: " + e.message);
    }
}

window.closeRequestSentModal = function() {
    document.getElementById('request-sent-modal').classList.add('hidden');
}

// ==========================================
// NEW: HYBRID TRACKING (POLLING vs LISTENER)
// ==========================================

let userRequestsUnsub = null;

// Called by checkRequestStatus (Polling for Guest) or onAuth (Listener for User)
window.subscribeToMyRequests = function(user) {
    if(userRequestsUnsub) userRequestsUnsub(); // Clear old listener

    const container = document.getElementById('my-requests-container');
    if(!container) return;

    const q = window.dbFormat.query(
        window.dbFormat.collection(window.db, "requests"),
        window.dbFormat.where("uid", "==", user.uid)
    );

    userRequestsUnsub = window.dbFormat.onSnapshot(q, (snapshot) => {
        let allRequests = [];
        snapshot.forEach(doc => allRequests.push(doc.data()));
        
        // Sort and Render
        allRequests.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
        renderRequestTracker(allRequests.slice(0, 5));
    });
}

window.checkRequestStatus = async function() {
    const user = window.auth.currentUser;
    
    // If logged in real user, we rely on the LISTENER created in index.html -> subscribeToMyRequests
    // So we just return here to stop the "Guest Polling" logic from overwriting it.
    if(user && !user.isAnonymous) return; 

    // GUEST / ANONYMOUS: Poll LocalStorage IDs
    const container = document.getElementById('my-requests-container');
    if(!container) return; 

    let trackIds = JSON.parse(localStorage.getItem('my_requests') || '[]');
    if (trackIds.length === 0) {
        container.classList.add('hidden');
        return;
    }

    try {
        // Limit to 5
        const recentIds = trackIds.slice(-5).reverse();
        let requests = [];

        for (const rid of recentIds) {
            const docRef = await window.dbFormat.getDoc(window.dbFormat.doc(window.db, "requests", rid));
            if (docRef.exists()) {
                requests.push(docRef.data());
            }
        }
        renderRequestTracker(requests);

    } catch(e) { console.log("Guest polling error", e); }
}

function renderRequestTracker(dataList) {
    const container = document.getElementById('my-requests-container');
    
    if(!dataList || dataList.length === 0) {
        container.classList.add('hidden');
        return;
    }

    container.innerHTML = `<h4 class="text-[9px] font-black uppercase tracking-widest opacity-50 mb-2 pl-1 flex justify-between">
        <span>${t('myRequests')}</span>
        <span class="opacity-50 text-[8px] animate-pulse">LIVE</span>
    </h4>`;
    container.classList.remove('hidden');

    for (const data of dataList) {
        // NOTIFICATION LOGIC
        const seenKey = `req_status_${data.id}`;
        const seenStatus = localStorage.getItem(seenKey);
        
        if (data.status !== 'pending' && seenStatus !== data.status) {
            openNotificationModal(data.status, data.adminResponse);
            localStorage.setItem(seenKey, data.status); 
        }

        const statusColors = {
            'pending': 'bg-yellow-500/20 text-yellow-500 border-yellow-500/20',
            'approved': 'bg-emerald-500/20 text-emerald-500 border-emerald-500/20',
            'rejected': 'bg-red-500/20 text-red-500 border-red-500/20',
            'archived': 'bg-gray-500/20 text-gray-500 border-gray-500/20'
        };
        
        const statusTr = {
            'pending': t('statusPending'), 'approved': t('statusApproved'),
            'rejected': t('statusRejected'), 'archived': t('statusRejected')
        };

        const div = document.createElement('div');
        div.className = "mb-2 p-3 rounded-lg bg-dynamic border border-dynamic";
        
        let responseHtml = '';
        if(data.adminResponse) {
            responseHtml = `
                <div class="mt-2 pt-2 border-t border-dynamic/50 text-xs">
                    <span class="text-[9px] font-black uppercase tracking-widest opacity-50 block mb-1">${t('adminResponseTitle')}</span>
                    <span class="opacity-90 italic">"${data.adminResponse}"</span>
                </div>
            `;
        }

        div.innerHTML = `
            <div class="flex justify-between items-center mb-1">
                 <div class="flex flex-col">
                    <span class="text-[10px] font-bold opacity-80">${data.dates.length} dager</span>
                    <span class="text-[9px] opacity-50">${new Date(data.submittedAt).toLocaleDateString()}</span>
                </div>
                <span class="px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider border ${statusColors[data.status] || statusColors['pending']}">
                    ${statusTr[data.status] || data.status}
                </span>
            </div>
            ${responseHtml}
        `;
        container.appendChild(div);
    }
}


// Notification Modal Functions
window.openNotificationModal = function(status, message) {
    const modal = document.getElementById('notification-modal');
    if(!modal) return;
    
    // Set Text based on status
    const textEl = document.getElementById('notification-text');
    if(status === 'approved') textEl.innerText = t('updateApproved');
    else if(status === 'rejected') textEl.innerText = t('updateRejected');
    else textEl.innerText = t('updateCheck');
    
    // Show Admin Message if exists
    const msgEl = document.getElementById('notification-message');
    if(message) {
        msgEl.innerText = `"${message}"`;
        msgEl.classList.remove('hidden');
    } else {
        msgEl.classList.add('hidden');
    }
    
    modal.classList.remove('hidden');
}

window.closeNotificationModal = function() {
    document.getElementById('notification-modal').classList.add('hidden');
}

// Auto-Refresh Logic (Only needed for Guests now)
document.addEventListener("visibilitychange", () => {
   if (document.visibilityState === 'visible' && window.checkRequestStatus) {
       // Only run polling check if not logged in (handled inside function)
       window.checkRequestStatus();
   }
});

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
    let weekGroup;

    while (current <= end) {
        const ds = getLocalDateString(current); const info = getInfo(ds); const wk = getWeekNumber(current);
        if (info.status !== 'weekend') {
            if (wk !== currentWeek) {
                currentWeek = wk;
                resultsEl.appendChild(Object.assign(document.createElement('div'), {
                    className: 'flex items-center gap-3 mb-4 lg:mb-6',
                    innerHTML: `<span class="text-[10px] lg:text-sm font-black uppercase tracking-widest bg-pink-500/10 text-pink-500 px-4 py-1.5 lg:px-5 lg:py-2 rounded-full">${t('week')} ${wk}</span>`
                }));
                weekGroup = resultsEl.appendChild(Object.assign(document.createElement('div'), { className: 'lookup-week-group space-y-4' }));
            }
            weekGroup.appendChild(Object.assign(document.createElement('div'), {
                className: 'flex items-center justify-between p-4 lg:p-6 rounded-xl lg:rounded-2xl bg-dynamic border border-dynamic hover-bg-dynamic transition-all group',
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

// --- TUTORIAL LOGIC ---
function openTutorial() {
    currentTutorialStep = 0;
    document.getElementById('tutorial-modal').classList.remove('hidden');
    updateTutorialUI();
}

function closeTutorial() {
    document.getElementById('tutorial-modal').classList.add('hidden');
    localStorage.setItem('tutorial_seen', 'true');
}

function nextTutorialStep() {
    if (currentTutorialStep < 2) {
        currentTutorialStep++;
        updateTutorialUI();
    } else {
        closeTutorial();
    }
}

function updateTutorialUI() {
    // 1. Manage Slides
    for (let i = 0; i < 3; i++) {
        const slide = document.getElementById(`tut-slide-${i}`);
        if (i === currentTutorialStep) {
            slide.classList.remove('hidden');
        } else {
            slide.classList.add('hidden');
        }
        
        // 2. Manage Dots
        const dot = document.getElementById(`tut-dot-${i}`);
        if (i === currentTutorialStep) {
            dot.classList.remove('opacity-20');
            dot.classList.add('opacity-100', 'scale-110');
        } else {
            dot.classList.add('opacity-20');
            dot.classList.remove('opacity-100', 'scale-110');
        }
    }
    
    // 3. Update Button Text
    const btn = document.getElementById('tut-next-btn');
    if (currentTutorialStep === 2) {
        btn.innerText = t('tutGotIt');
    } else {
        btn.innerText = t('tutNext');
    }
}

window.openTutorial = openTutorial;
window.closeTutorial = closeTutorial;
window.nextTutorialStep = nextTutorialStep;

window.onload = loadData;