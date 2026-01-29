// app.js - Main Application Logic
const getLocalDateString = (date) => date.toLocaleDateString('en-CA');
const t = (key) => TR[CURRENT_LANG][key] || key;

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

function translateNote(note) {
    if (!note || CURRENT_LANG === 'en') return note;
    let translated = note.toLowerCase();
    Object.keys(DYNAMIC_TR).forEach(key => {
        translated = translated.replace(new RegExp(key, 'g'), DYNAMIC_TR[key]);
    });
    return translated.charAt(0).toUpperCase() + translated.slice(1);
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

async function loadData() {
    // Theme Init
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        document.getElementById('theme-icon').className = 'fas fa-moon text-base lg:text-lg';
    } else {
        document.body.classList.remove('dark-mode');
        document.getElementById('theme-icon').className = 'fas fa-sun text-base lg:text-lg';
    }
    
    // Lang Init
    const savedLang = localStorage.getItem('lang');
    if (savedLang && (savedLang === 'nb' || savedLang === 'en')) {
        CURRENT_LANG = savedLang;
        window.ui.updateLanguageUI();
    }

    try {
        window.ui.updateStatus(t('loading'), "blue");
        let attempts = 0;
        // Wait for auth.js to set window.db
        while ((!window.dbFormat || !window.db) && attempts < 20) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        if (window.dbFormat) {
            const querySnapshot = await window.dbFormat.getDocs(window.dbFormat.collection(window.db, "availability"));
            if(!querySnapshot.empty) {
                DATA_STORE.overrides = {};
                querySnapshot.forEach((doc) => {
                    DATA_STORE.overrides[doc.id] = doc.data();
                });
                window.ui.updateStatus(t('online'), "emerald");
            } else {
                window.ui.updateStatus("Waiting for Data", "gray");
            }
            // Fetch Global Settings
            try {
                 const settingsDoc = await window.dbFormat.getDoc(window.dbFormat.doc(window.db, "config", "main"));
                 if(settingsDoc.exists()) DATA_STORE.settings = { ...DATA_STORE.settings, ...settingsDoc.data() };
            } catch(e) { console.log("No config doc found"); }

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
        window.ui.updateStatus(t('local'), "gray");
    }
    
    initApp();
    
    const preloader = document.getElementById('preloader');
    if (preloader) {
        setTimeout(() => {
            preloader.style.opacity = '0';
            preloader.style.visibility = 'hidden';
        }, 500);
    }
}

// Global Init Function
window.initApp = function() {
    const today = new Date();
    const todayStr = getLocalDateString(today);
    
    const existingVal = document.getElementById('week-selector').value;
    const initialWeek = existingVal ? parseInt(existingVal) : getWeekNumber(today);

    window.ui.populateWeekDropdown(initialWeek);
    window.ui.renderHero(todayStr);
    window.ui.renderWeekSummary(initialWeek);
    window.ui.renderCalendar(todayStr);
    
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
    
    // Init Sidebar & Tutorial
    window.requests.updateRequestSidebar();
    
    const tutorialSeen = localStorage.getItem('tutorial_seen');
    if (!tutorialSeen) setTimeout(window.ui.openTutorial, 1000);
}

window.handleManualUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    window.ui.updateStatus("Reading...", "blue");
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const json = JSON.parse(e.target.result);
            DATA_STORE.overrides = json.overrides || json;
            DATA_STORE.settings = json.settings || { certainUntil: '', phone: '' };
            window.ui.updateStatus("Ready to Sync", "emerald");
            initApp();
        } catch (err) { alert("Invalid JSON file."); }
    };
    reader.readAsText(file);
}

// Start
window.onload = loadData;

// Polling for guests
document.addEventListener("visibilitychange", () => {
   if (document.visibilityState === 'visible' && window.requests.checkRequestStatus) {
       window.requests.checkRequestStatus();
   }
});