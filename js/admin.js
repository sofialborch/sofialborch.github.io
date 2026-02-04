// admin.js - Admin Tools & Logic

// --- VIEW SWITCHER (New Tab Logic) ---
window.switchView = function(viewName) {
    const dashboard = document.getElementById('view-dashboard');
    const roster = document.getElementById('view-roster');
    
    if (viewName === 'roster') {
        dashboard.classList.add('hidden');
        roster.classList.remove('hidden');
    } else {
        roster.classList.add('hidden');
        dashboard.classList.remove('hidden');
    }
}

// -------------------------------------

let inboxUnsub = null;

async function openAdminRequests() {
    if(!window.isAdmin) return;
    if (!window.dbFormat || !window.db) {
        alert("Database connection not ready.");
        return;
    }

    const modal = document.getElementById('admin-requests-modal');
    const list = document.getElementById('admin-requests-list');
    
    modal.classList.remove('hidden');
    list.innerHTML = `<div class="text-center py-10"><i class="fas fa-circle-notch fa-spin text-2xl text-pink-500"></i></div>`; 

    try {
        const q = window.dbFormat.collection(window.db, "requests");
        const snapshot = await window.dbFormat.getDocs(q);
        
        if (snapshot.empty) {
            list.innerHTML = `<p class="text-center opacity-50 py-10 font-bold uppercase tracking-widest text-xs">${t('noReq')}</p>`;
            return;
        }

        let reqs = [];
        loadedRequestsCache = {}; 
        
        snapshot.forEach(doc => {
            const data = doc.data();
            // SHOW ALL (Including rejected/archived) to prevent them vanishing
            if (data.status !== 'archived') { 
                loadedRequestsCache[doc.id] = { id: doc.id, ...data };
                reqs.push(loadedRequestsCache[doc.id]);
            }
        });
        
        reqs.sort((a, b) => {
            const dateA = a.submittedAt ? new Date(a.submittedAt) : new Date(0);
            const dateB = b.submittedAt ? new Date(b.submittedAt) : new Date(0);
            return dateB - dateA;
        });
        
        if(reqs.length === 0) list.innerHTML = `<p class="text-center opacity-50 py-10 font-bold uppercase tracking-widest text-xs">Ingen aktive forespørsler</p>`;
        else renderAdminRequestList(reqs);
        
    } catch (e) {
        list.innerHTML = `<p class="text-center text-red-400 font-bold text-xs mt-10">Feil.<br>${e.message}</p>`;
    }
}

function subscribeToInbox() {
    if(!window.isAdmin || !window.dbFormat) return;
    if (inboxUnsub) inboxUnsub(); 

    const q = window.dbFormat.query(
        window.dbFormat.collection(window.db, "requests"),
        window.dbFormat.where("status", "==", "pending")
    );
    
    inboxUnsub = window.dbFormat.onSnapshot(q, (snapshot) => {
        const dot = document.getElementById('admin-inbox-dot');
        if(!dot) return;
        if(!snapshot.empty) dot.classList.remove('hidden');
        else dot.classList.add('hidden');
    });
}
window.subscribeToInbox = subscribeToInbox;

function renderAdminRequestList(reqs) {
    const list = document.getElementById('admin-requests-list');
    list.innerHTML = '';

    reqs.forEach(req => {
        const dateStr = req.submittedAt 
            ? new Date(req.submittedAt).toLocaleDateString(t('monthLocale'), { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' })
            : 'Ukjent dato';
        
        let conflictCount = 0;
        const datesToRender = req.dates || [];
        
        const datePills = datesToRender.map(d => {
            const info = getInfo(d);
            const dobj = new Date(d);
            const niceDate = dobj.getDate() + '.' + (dobj.getMonth()+1);
            
            let colorClass = "bg-white/10 text-white border-white/10";
            if (info.status === 'busy') {
                colorClass = "bg-red-500/20 text-red-400 border-red-500/30 line-through opacity-75";
                conflictCount++;
            } else if (info.status === 'partial') {
                colorClass = "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
                conflictCount++;
            } else if (info.status === 'available' || info.status === 'weekend') {
                colorClass = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
            } else {
                colorClass = "bg-dynamic text-muted-dynamic border-dynamic"; 
            }
            return `<span class="px-2 py-1 rounded text-[10px] font-black border ${colorClass}" title="${t(info.status)}">${niceDate}</span>`;
        }).join('');

        const isRejected = req.status === 'rejected';
        const isApproved = req.status === 'approved';
        
        const el = document.createElement('div');
        // Visually fade processed requests
        el.className = (isRejected || isApproved)
            ? "p-5 rounded-2xl bg-dynamic border border-dynamic transition group relative opacity-60 hover:opacity-100"
            : "p-5 rounded-2xl bg-dynamic border border-dynamic hover:border-pink-500/30 transition group relative";
        
        const warningHTML = (conflictCount > 0 && !isRejected && !isApproved)
            ? `<div class="mt-3 flex items-center gap-2 text-yellow-500 text-[10px] font-black uppercase tracking-widest bg-yellow-500/10 px-3 py-2 rounded-lg border border-yellow-500/20">
                 <i class="fas fa-exclamation-triangle"></i> ${t('conflictsFound')} (${conflictCount})
               </div>` : '';
        
        let statusBadge = '';
        if(isRejected) statusBadge = `<span class="px-2 py-1 bg-red-500 text-white text-[9px] font-black uppercase tracking-widest rounded ml-2">AVVIST</span>`;
        if(isApproved) statusBadge = `<span class="px-2 py-1 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest rounded ml-2">GODKJENT</span>`;

        let displayMsg = req.message || '';
        displayMsg = displayMsg.replace('Detaljer:', '<strong>Detaljer:</strong>');

        el.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="font-black text-sm uppercase tracking-wide flex items-center gap-2">
                        ${req.name || 'Ukjent Navn'}
                        ${req.uid ? '<i class="fas fa-user-check text-blue-400 text-xs" title="Registered User"></i>' : ''}
                        ${statusBadge}
                    </h4>
                    <span class="text-[10px] font-bold opacity-50 uppercase tracking-widest">${dateStr}</span>
                </div>
                <div class="flex gap-2">
                    <button onclick="openBulkAction('${req.id}')" class="bg-pink-500 hover:bg-pink-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition shadow-lg shadow-pink-500/20">
                        ${isApproved || isRejected ? 'Rediger' : t('approve')}
                    </button>
                    <button onclick="deleteRequest('${req.id}')" class="bg-dynamic hover:bg-red-500/20 text-muted-dynamic hover:text-red-400 px-3 py-1.5 rounded-lg transition"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            
            <div class="mb-4">
                <div class="text-sm font-medium opacity-80 leading-relaxed bg-black/5 dark:bg-black/20 p-3 rounded-lg border border-dynamic whitespace-pre-wrap">${displayMsg}</div>
                ${warningHTML}
                ${req.adminResponse ? `<div class="mt-2 pl-3 border-l-2 border-pink-500 text-xs text-pink-500 font-bold italic">"${req.adminResponse}"</div>` : ''}
            </div>
            <div class="flex flex-wrap gap-2">${datePills}</div>
        `;
        list.appendChild(el);
    });
}

// ----------------------------------------------------
// TIME CALCULATION HELPERS
// ----------------------------------------------------
function autoCalculateEndTime(startTime) {
    if(!startTime) return '';
    const [h, m] = startTime.split(':').map(Number);
    
    // Add 7.5 hours (450 minutes)
    let totalMins = (h * 60) + m + 450;
    
    // Wrap around 24h
    totalMins = totalMins % 1440;
    
    const newH = Math.floor(totalMins / 60);
    const newM = totalMins % 60;
    
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}
window.autoCalculateEndTime = autoCalculateEndTime; // Export for UI.js

// ----------------------------------------------------
// NEW WIZARD LOGIC (Multi-step + Summary)
// ----------------------------------------------------

function openBulkAction(reqId) {
    const req = loadedRequestsCache[reqId];
    if(!req) return;
    currentBulkRequest = req; 
    
    document.getElementById('bulk-wizard-title').innerText = `${req.name}`;
    
    // Parse User Notes from Message
    // Regex finds "- YYYY-MM-DD: Note"
    const notesMap = {};
    const noteRegex = /-\s+(\d{4}-\d{2}-\d{2}):\s+(.*)/g;
    let match;
    while ((match = noteRegex.exec(req.message)) !== null) {
        notesMap[match[1]] = match[2];
    }
    
    // Init Wizard Data
    bulkWizardData = [];
    if(req.dates) {
        req.dates.forEach(d => {
            const existing = DATA_STORE.overrides[d];
            // Default logic: If user asks for a day, they probably want it to be 'busy' (shift assigned)
            // unless it's already set.
            
            let initialStatus = 'busy'; 
            if(existing && existing.status) initialStatus = existing.status;
            
            // Note logic: Prefer existing DB note, otherwise use user's request note
            let initialNote = notesMap[d] || '';
            if(existing && existing.note) initialNote = existing.note; 

            let initialBadge = null;
            if(existing && existing.badge) initialBadge = existing.badge;

            // Times
            let initialStart = '';
            let initialEnd = '';
            if(existing && existing.startTime) initialStart = existing.startTime;
            if(existing && existing.endTime) initialEnd = existing.endTime;

            bulkWizardData.push({
                date: d,
                status: initialStatus,
                note: initialNote,
                badge: initialBadge,
                startTime: initialStart,
                endTime: initialEnd
            });
        });
    }
    
    bulkWizardData.sort((a,b) => new Date(a.date) - new Date(b.date));
    bulkWizardIndex = 0;
    
    // Clear previous summary input
    document.getElementById('bulk-response-text').value = req.adminResponse || '';
    
    renderBulkStep();
    
    document.getElementById('bulk-modal').classList.remove('hidden');
    document.getElementById('admin-requests-modal').classList.add('hidden');
}

function renderBulkStep() {
    // Logic: 
    // If index < length: Show Date Editor
    // If index == length: Show Summary/Response Editor
    
    const isSummaryStep = bulkWizardIndex === bulkWizardData.length;
    
    const dateView = document.getElementById('bulk-date-view');
    const summaryView = document.getElementById('bulk-summary-view');
    const prevBtn = document.getElementById('bulk-prev-btn');
    const nextBtn = document.getElementById('bulk-next-btn');
    const indicator = document.getElementById('bulk-step-indicator');

    if (isSummaryStep) {
        // SUMMARY VIEW
        dateView.classList.add('hidden');
        summaryView.classList.remove('hidden');
        
        indicator.innerText = "Final Review";
        nextBtn.style.visibility = 'hidden'; 
        prevBtn.style.visibility = 'visible';
        
        // Update summary text
        const total = bulkWizardData.length;
        const busyCount = bulkWizardData.filter(d => d.status === 'busy').length;
        const availCount = bulkWizardData.filter(d => d.status === 'available').length;
        
        document.getElementById('bulk-summary-stats').innerHTML = `
            <span class="text-emerald-500">${availCount} Ledige</span> / 
            <span class="text-red-500">${busyCount} Opptatt</span>
        `;
        
    } else {
        // DATE VIEW
        dateView.classList.remove('hidden');
        summaryView.classList.add('hidden');
        
        const data = bulkWizardData[bulkWizardIndex];
        const dobj = new Date(data.date);
        
        indicator.innerText = `${bulkWizardIndex + 1} / ${bulkWizardData.length}`;
        
        document.getElementById('bulk-current-date').innerText = dobj.getDate();
        document.getElementById('bulk-current-day').innerText = dobj.toLocaleDateString(t('monthLocale'), { weekday: 'long', month: 'long' });
        
        // Buttons
        document.querySelectorAll('.bulk-step-btn').forEach(btn => {
            if(btn.dataset.val === data.status) {
                btn.classList.add('bg-white', 'text-black', 'border-black');
                btn.classList.remove('text-muted-dynamic');
            } else {
                btn.classList.remove('bg-white', 'text-black', 'border-black');
                btn.classList.add('text-muted-dynamic');
            }
        });

        // Badges
        ['NR', 'PM', 'ST'].forEach(b => {
            const el = document.getElementById(`bulk-step-badge-${b.toLowerCase()}`);
            if(el) el.style.opacity = (data.badge === b) ? '1' : '0.5';
        });
        
        document.getElementById('bulk-step-note').value = data.note || '';
        
        // Update Time Inputs & Buttons
        document.getElementById('bulk-start-time').value = data.startTime || '';
        document.getElementById('bulk-start-time-btn').innerText = data.startTime || '08:00';
        
        document.getElementById('bulk-end-time').value = data.endTime || '';
        document.getElementById('bulk-end-time-btn').innerText = data.endTime || '15:30';
        
        prevBtn.style.visibility = bulkWizardIndex > 0 ? 'visible' : 'hidden';
        nextBtn.style.visibility = 'visible';
    }
}

window.nextBulkStep = function() {
    if(bulkWizardIndex < bulkWizardData.length) {
        bulkWizardIndex++;
        renderBulkStep();
    }
}

window.prevBulkStep = function() {
    if(bulkWizardIndex > 0) {
        bulkWizardIndex--;
        renderBulkStep();
    }
}

window.setBulkStepStatus = function(status) {
    bulkWizardData[bulkWizardIndex].status = status;
    renderBulkStep();
}

window.toggleBulkStepBadge = function(badge) {
    if (bulkWizardData[bulkWizardIndex].badge === badge) {
        bulkWizardData[bulkWizardIndex].badge = null;
    } else {
        bulkWizardData[bulkWizardIndex].badge = badge;
    }
    renderBulkStep();
}

window.updateBulkStepNote = function(val) {
    bulkWizardData[bulkWizardIndex].note = val;
}

// Bulk Time Updates with Auto-Calc
window.updateBulkStepStartTime = function(val) {
    bulkWizardData[bulkWizardIndex].startTime = val;
    // Note: End time is auto-updated via UI.js -> confirmTimeSelector -> autoCalculateEndTime
    // But we need to capture the value if it was updated automatically
    const autoEnd = document.getElementById('bulk-end-time').value;
    bulkWizardData[bulkWizardIndex].endTime = autoEnd;
}

window.updateBulkStepEndTime = function(val) {
    bulkWizardData[bulkWizardIndex].endTime = val;
}

window.saveBulkWizard = async function() {
    if(!currentBulkRequest || !window.isAdmin) return;
    
    // Disable button to prevent double click
    const saveBtn = document.getElementById('bulk-save-btn');
    const originalText = saveBtn.innerText;
    saveBtn.innerText = "Lagrer...";
    saveBtn.disabled = true;

    const responseMsg = document.getElementById('bulk-response-text').value;

    const batch = window.dbFormat.writeBatch(window.db);
    
    // 1. Commit Calendar Changes
    bulkWizardData.forEach(item => {
        const ref = window.dbFormat.doc(window.db, "availability", item.date);
        const data = { 
            status: item.status, 
            note: item.note, 
            badge: item.badge || null,
            startTime: item.startTime || null,
            endTime: item.endTime || null
        };
        batch.set(ref, data);
        DATA_STORE.overrides[item.date] = data; // Optimistic update
    });

    // 2. Update Request Status & Response
    const reqRef = window.dbFormat.doc(window.db, "requests", currentBulkRequest.id);
    batch.update(reqRef, { 
        status: 'approved', // "Approved" implies processed/handled in this context
        adminResponse: responseMsg 
    });

    try {
        await batch.commit();
        
        // UI Updates
        alert("Kalender oppdatert og svar sendt!");
        window.closeBulkModal();
        
        // Immediate Re-render of Calendar
        window.initApp(); 
        
        // Re-open list to show updated status
        openAdminRequests(); 

    } catch(e) { 
        alert("Save failed: " + e.message); 
        saveBtn.innerText = originalText;
        saveBtn.disabled = false;
    }
}

// ----------------------------------------------------

// Common Admin Functions
window.deleteRequest = async function(id) {
    if(!confirm(t('delete') + "?")) return;
    try {
        await window.dbFormat.deleteDoc(window.dbFormat.doc(window.db, "requests", id));
        openAdminRequests(); 
    } catch(e) { alert("Error: " + e.message); }
}

// Single Day Edit (Legacy / Calendar Direct Click)
window.openEditModal = function(dateStr, info) {
    currentEditDate = dateStr;
    const dateObj = new Date(dateStr + "T00:00:00");
    document.getElementById('edit-date-display').innerText = dateObj.toLocaleDateString(t('monthLocale'), { weekday: 'long', day: 'numeric', month: 'long' });
    document.getElementById('edit-modal').classList.remove('hidden');
    window.setEditStatus(info.status === 'weekend' ? 'available' : info.status);
    
    // Load Data
    document.getElementById('edit-note').value = info.note || '';
    
    // Load Times (Need to look up raw data from STORE since info might be simplified)
    const rawData = DATA_STORE.overrides[dateStr] || {};
    
    document.getElementById('edit-start-time').value = rawData.startTime || '';
    document.getElementById('edit-start-time-btn').innerText = rawData.startTime || '08:00';
    
    document.getElementById('edit-end-time').value = rawData.endTime || '';
    document.getElementById('edit-end-time-btn').innerText = rawData.endTime || '15:30';

    ['NR', 'PM', 'ST'].forEach(b => {
        const el = document.getElementById(`badge-${b.toLowerCase()}`);
        if(el) el.style.opacity = '0.5';
    });
    currentBadge = null;
    if (info.badge) window.toggleBadge(info.badge);
}

// Auto-Calc for Single Edit handled via UI.js + linkedInput

window.saveDay = async function() {
    if (!currentEditDate || !window.isAdmin) return;
    const note = document.getElementById('edit-note').value;
    const sTime = document.getElementById('edit-start-time').value;
    const eTime = document.getElementById('edit-end-time').value;
    
    const data = { 
        status: currentEditStatus, 
        note: note, 
        badge: currentBadge || null,
        startTime: sTime || null,
        endTime: eTime || null
    };
    
    try {
        await window.dbFormat.setDoc(window.dbFormat.doc(window.db, "availability", currentEditDate), data);
        DATA_STORE.overrides[currentEditDate] = data;
        window.initApp(); 
        window.closeEditModal();
    } catch (e) { alert("Save failed: " + e.message); }
}

window.deleteDay = async function() {
    if (!currentEditDate || !confirm("Clear this day?")) return;
    try {
        await window.dbFormat.deleteDoc(window.dbFormat.doc(window.db, "availability", currentEditDate));
        delete DATA_STORE.overrides[currentEditDate];
        window.initApp();
        window.closeEditModal();
    } catch(e) { alert("Delete failed: " + e.message); }
}

// Helpers
window.setEditStatus = function(status) {
    currentEditStatus = status;
    document.querySelectorAll('.edit-status-btn').forEach(btn => {
        if(btn.dataset.val === status) {
            btn.classList.add('bg-white', 'text-black', 'border-black');
            btn.classList.remove('text-muted-dynamic');
        } else {
            btn.classList.remove('bg-white', 'text-black', 'border-black');
            btn.classList.add('text-muted-dynamic');
        }
    });
}
window.toggleBadge = function(badge) {
    const el = document.getElementById(`badge-${badge.toLowerCase()}`);
    if(!el) return;
    if (currentBadge === badge) {
        currentBadge = null;
        el.style.opacity = '0.5';
    } else {
        ['NR', 'PM', 'ST'].forEach(b => {
            const e = document.getElementById(`badge-${b.toLowerCase()}`);
            if(e) e.style.opacity = '0.5';
        });
        currentBadge = badge;
        el.style.opacity = '1';
    }
}
window.closeAdminRequests = () => document.getElementById('admin-requests-modal').classList.add('hidden');
window.closeBulkModal = () => {
    document.getElementById('bulk-modal').classList.add('hidden');
    document.getElementById('admin-requests-modal').classList.remove('hidden'); 
}
window.closeEditModal = () => document.getElementById('edit-modal').classList.add('hidden');
window.openAdminRequests = openAdminRequests;

// ----------------------------------------------------
// SETTINGS MODAL LOGIC (UPDATED)
// ----------------------------------------------------

window.openAdminSettings = function() {
    if(!window.isAdmin) return;
    const modal = document.getElementById('admin-settings-modal');
    modal.classList.remove('hidden');
    
    // Load current values
    document.getElementById('admin-certain-date').value = DATA_STORE.settings.certainUntil || '';
    document.getElementById('admin-phone').value = DATA_STORE.settings.phone || '';
    
    // Load New Toggles (Default to true if undefined)
    document.getElementById('admin-public-schedule').checked = DATA_STORE.settings.publicSchedule !== false;
    document.getElementById('admin-allow-requests').checked = DATA_STORE.settings.allowRequests !== false;
}

window.closeAdminSettings = function() {
    document.getElementById('admin-settings-modal').classList.add('hidden');
}

window.saveAdminSettings = async function() {
    const certainDate = document.getElementById('admin-certain-date').value;
    const phone = document.getElementById('admin-phone').value;
    const publicSchedule = document.getElementById('admin-public-schedule').checked;
    const allowRequests = document.getElementById('admin-allow-requests').checked;
    
    const newSettings = {
        certainUntil: certainDate,
        phone: phone,
        publicSchedule: publicSchedule,
        allowRequests: allowRequests
    };
    
    try {
        await window.dbFormat.setDoc(window.dbFormat.doc(window.db, "config", "main"), newSettings, { merge: true });
        
        // Update Local Store
        DATA_STORE.settings = { ...DATA_STORE.settings, ...newSettings };
        
        // Refresh UI Elements that use these settings
        if (certainDate) {
            const cDate = new Date(certainDate + "T00:00:00");
            document.getElementById('certainty-date-label').innerText = cDate.toLocaleDateString(t('monthLocale'), { day:'2-digit', month:'long', year:'numeric' });
            document.getElementById('certainty-notice').classList.remove('hidden');
        } else {
            document.getElementById('certainty-notice').classList.add('hidden');
        }
        
        // Refresh Phone in Footer
        const phoneEl = document.getElementById('footer-phone');
        if(phone) {
            phoneEl.innerText = t('callMe') + ' ' + phone;
            phoneEl.classList.remove('hidden');
        } else {
            phoneEl.classList.add('hidden');
        }

        window.closeAdminSettings();
        
    } catch(e) {
        alert("Failed to save settings: " + e.message);
    }
}

// Print Logic
window.generatePrintSummary = function(start, end) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent("sofialborch.github.io")}`;
    const printWindow = window.open('', '_blank');
    const genDate = new Date().toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });

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
        .footer { display: flex; justify-content: space-between; align-items: flex-end; page-break-inside: avoid; padding-top: 10px; }
        .qr-box img { width: 80px; height: 80px; border: 1px solid #000; }
        .trademark { font-weight: 900; font-size: 11px; letter-spacing: 2px; }
        .footer-text { font-size: 10px; font-weight: 600; line-height: 1.3; text-align: right; }
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
    
    html += `</div>
    <div class="footer">
        <div>
            <div class="trademark">PROJECT BY Z03Y</div>
            ${DATA_STORE.settings.phone ? `<div style="font-size: 14px; font-weight: 900; margin-top: 8px; background: #000; color: #fff; padding: 4px 12px; border-radius: 6px; display: inline-block;">${DATA_STORE.settings.phone}</div>` : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 15px;">
             <div class="footer-text">
                Denne PDF-en ble laget ${genDate}.<br>
                For oppdatert informasjon, og hvis du enkelt<br>vil be om dager, sjekk nettsiden!
            </div>
            <div class="qr-box">
                <img src="${qrUrl}">
            </div>
        </div>
    </div>
    </div></body></html>`;
    
    printWindow.document.write(html); printWindow.document.close();
}