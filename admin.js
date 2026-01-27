// admin.js - Admin Tools & Logic

function triggerMigration() {
    if(window.uploadLocalDataToFirestore && DATA_STORE.overrides) {
        window.uploadLocalDataToFirestore(DATA_STORE.overrides);
    } else {
        alert("Migration tool not ready.");
    }
}
window.triggerMigration = triggerMigration;

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
            if (data.status !== 'archived' && data.status !== 'rejected') { 
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

        const el = document.createElement('div');
        el.className = "p-5 rounded-2xl bg-dynamic border border-dynamic hover:border-pink-500/30 transition group relative";
        
        const warningHTML = conflictCount > 0 
            ? `<div class="mt-3 flex items-center gap-2 text-yellow-500 text-[10px] font-black uppercase tracking-widest bg-yellow-500/10 px-3 py-2 rounded-lg border border-yellow-500/20">
                 <i class="fas fa-exclamation-triangle"></i> ${t('conflictsFound')} (${conflictCount})
               </div>` : '';

        // Handle detailed messages nicely
        let displayMsg = req.message || '';
        // Bold the "Details:" header if present
        displayMsg = displayMsg.replace('Detaljer:', '<strong>Detaljer:</strong>');

        el.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="font-black text-sm uppercase tracking-wide flex items-center gap-2">
                        ${req.name || 'Ukjent Navn'}
                        ${req.uid ? '<i class="fas fa-user-check text-blue-400 text-xs" title="Registered User"></i>' : ''}
                    </h4>
                    <span class="text-[10px] font-bold opacity-50 uppercase tracking-widest">${dateStr}</span>
                </div>
                <div class="flex gap-2">
                    <button onclick="openBulkAction('${req.id}')" class="bg-pink-500 hover:bg-pink-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition shadow-lg shadow-pink-500/20">
                        ${t('approve')}
                    </button>
                    <button onclick="deleteRequest('${req.id}')" class="bg-dynamic hover:bg-red-500/20 text-muted-dynamic hover:text-red-400 px-3 py-1.5 rounded-lg transition"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            
            <div class="mb-4">
                <div class="text-sm font-medium opacity-80 leading-relaxed bg-black/5 dark:bg-black/20 p-3 rounded-lg border border-dynamic whitespace-pre-wrap">${displayMsg}</div>
                ${warningHTML}
            </div>
            <div class="flex flex-wrap gap-2">${datePills}</div>
        `;
        list.appendChild(el);
    });
}

// Bulk Actions
function openBulkAction(reqId) {
    const req = loadedRequestsCache[reqId];
    if(!req) return;
    currentBulkRequest = req; 
    
    document.getElementById('bulk-title').innerText = `${t('bulkEditTitle')}: ${req.name}`;
    document.getElementById('bulk-subtitle').innerText = `${req.dates ? req.dates.length : 0} dager`;
    document.getElementById('bulk-note').value = `${req.name}: ${req.message}`; 
    document.getElementById('bulk-response').value = ''; 
    
    const dateList = document.getElementById('bulk-date-list');
    dateList.innerHTML = '';
    
    if (req.dates) {
        req.dates.forEach(d => {
            const info = getInfo(d);
            const dobj = new Date(d);
            const niceDate = dobj.getDate() + '.' + (dobj.getMonth()+1);
            const isConflict = info.status !== 'available' && info.status !== 'weekend';
            const color = isConflict ? 'text-red-500' : 'text-emerald-500';
            dateList.innerHTML += `<div class="flex justify-between items-center text-xs font-bold border-b border-dynamic py-1 last:border-0">
                <span>${niceDate}</span>
                <span class="${color}">${t(info.status)}</span>
            </div>`;
        });
    }

    document.getElementById('bulk-modal').classList.remove('hidden');
    document.getElementById('admin-requests-modal').classList.add('hidden');
    window.setBulkStatus('busy'); 
    window.toggleBulkBadge(null);
}

// Common Admin Functions
window.deleteRequest = async function(id) {
    if(!confirm(t('delete') + "?")) return;
    try {
        await window.dbFormat.deleteDoc(window.dbFormat.doc(window.db, "requests", id));
        openAdminRequests(); 
    } catch(e) { alert("Error: " + e.message); }
}

window.saveBulkAction = async function() {
    if(!currentBulkRequest || !window.isAdmin) return;
    const note = document.getElementById('bulk-note').value;
    const responseMsg = document.getElementById('bulk-response').value;
    const batch = window.dbFormat.writeBatch(window.db);
    
    if(currentBulkRequest.dates) {
        currentBulkRequest.dates.forEach(dateStr => {
            const ref = window.dbFormat.doc(window.db, "availability", dateStr);
            const data = { status: currentEditStatus, note: note, badge: currentBadge || null };
            batch.set(ref, data);
            DATA_STORE.overrides[dateStr] = data;
        });
    }
    const reqRef = window.dbFormat.doc(window.db, "requests", currentBulkRequest.id);
    batch.update(reqRef, { status: 'approved', adminResponse: responseMsg });

    try {
        await batch.commit();
        alert(`Oppdatert og godkjent!`);
        window.closeBulkModal();
        window.initApp(); 
        openAdminRequests(); 
    } catch(e) { alert("Bulk update failed: " + e.message); }
}

window.archiveBulkRequest = async function() {
    if(!currentBulkRequest) return;
    const responseMsg = document.getElementById('bulk-response').value; 
    if(confirm("Avvis og arkiver denne forespørselen?")) {
        try {
             await window.dbFormat.updateDoc(window.dbFormat.doc(window.db, "requests", currentBulkRequest.id), { status: 'rejected', adminResponse: responseMsg });
             window.closeBulkModal();
             openAdminRequests();
        } catch(e) { alert(e.message); }
    }
}

// Single Day Edit
window.openEditModal = function(dateStr, info) {
    currentEditDate = dateStr;
    const dateObj = new Date(dateStr + "T00:00:00");
    document.getElementById('edit-date-display').innerText = dateObj.toLocaleDateString(t('monthLocale'), { weekday: 'long', day: 'numeric', month: 'long' });
    document.getElementById('edit-modal').classList.remove('hidden');
    window.setEditStatus(info.status === 'weekend' ? 'available' : info.status);
    document.getElementById('edit-note').value = info.note || '';
    ['NR', 'PM', 'ST'].forEach(b => {
        const el = document.getElementById(`badge-${b.toLowerCase()}`);
        if(el) el.style.opacity = '0.5';
    });
    currentBadge = null;
    if (info.badge) window.toggleBadge(info.badge);
}

window.saveDay = async function() {
    if (!currentEditDate || !window.isAdmin) return;
    const note = document.getElementById('edit-note').value;
    const data = { status: currentEditStatus, note: note, badge: currentBadge || null };
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
window.setBulkStatus = function(status) {
    currentEditStatus = status;
    document.querySelectorAll('.bulk-status-btn').forEach(btn => {
        if(btn.dataset.val === status) {
            btn.classList.add('bg-white', 'text-black', 'border-black');
            btn.classList.remove('text-white', 'text-muted-dynamic');
            btn.classList.add('border-black');
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
window.toggleBulkBadge = function(badge) {
    ['NR', 'PM', 'ST'].forEach(b => {
        const el = document.getElementById(`bulk-badge-${b.toLowerCase()}`);
        if(el) el.style.opacity = '0.5';
    });
    if (currentBadge === badge) {
        currentBadge = null;
    } else {
        currentBadge = badge;
        if(badge) {
            const el = document.getElementById(`bulk-badge-${badge.toLowerCase()}`);
            if(el) el.style.opacity = '1';
        }
    }
}
window.closeAdminRequests = () => document.getElementById('admin-requests-modal').classList.add('hidden');
window.closeBulkModal = () => {
    document.getElementById('bulk-modal').classList.add('hidden');
    document.getElementById('admin-requests-modal').classList.remove('hidden'); 
}
window.closeEditModal = () => document.getElementById('edit-modal').classList.add('hidden');
window.openAdminRequests = openAdminRequests;

// Print Logic (Moved here as it's often admin-triggered)
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