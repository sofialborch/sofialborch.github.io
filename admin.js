// Migration Utility
function triggerMigration() {
    if(window.uploadLocalDataToFirestore && DATA_STORE.overrides) {
        window.uploadLocalDataToFirestore(DATA_STORE.overrides);
    } else {
        alert("Migration tool not ready or no data loaded.");
    }
}
window.triggerMigration = triggerMigration;

// Inbox Logic
async function openAdminRequests() {
    if(!window.isAdmin) return;
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
        snapshot.forEach(doc => reqs.push({ id: doc.id, ...doc.data() }));
        reqs.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
        renderAdminRequestList(reqs);
    } catch (e) {
        console.error(e);
        list.innerHTML = `<p class="text-center text-red-400 font-bold">Error loading requests</p>`;
    }
}

function renderAdminRequestList(reqs) {
    const list = document.getElementById('admin-requests-list');
    list.innerHTML = '';

    reqs.forEach(req => {
        const dateStr = new Date(req.submittedAt).toLocaleDateString(t('monthLocale'), { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' });
        const el = document.createElement('div');
        el.className = "p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-pink-500/30 transition group relative";
        el.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="font-black text-sm uppercase tracking-wide text-white">${req.name}</h4>
                    <span class="text-[10px] font-bold opacity-50 uppercase tracking-widest">${dateStr}</span>
                </div>
                <button onclick="deleteRequest('${req.id}')" class="text-white/20 hover:text-red-400 transition p-2"><i class="fas fa-trash"></i></button>
            </div>
            <div class="mb-4">
                <p class="text-sm font-medium opacity-80 leading-relaxed bg-black/20 p-3 rounded-lg border border-white/5 italic">"${req.message}"</p>
            </div>
            <div class="flex flex-wrap gap-2">
                ${req.dates ? req.dates.map(d => {
                    const dobj = new Date(d);
                    const niceDate = dobj.getDate() + '.' + (dobj.getMonth()+1);
                    return `<span class="px-2 py-1 rounded bg-pink-500/20 text-pink-300 text-[10px] font-black border border-pink-500/20">${niceDate}</span>`;
                }).join('') : ''}
            </div>
        `;
        list.appendChild(el);
    });
}

async function deleteRequest(id) {
    if(!confirm(t('delete') + "?")) return;
    try {
        await window.dbFormat.deleteDoc(window.dbFormat.doc(window.db, "requests", id));
        openAdminRequests(); 
    } catch(e) { alert("Error: " + e.message); }
}

window.openAdminRequests = openAdminRequests;
window.deleteRequest = deleteRequest;
window.closeAdminRequests = function() {
    document.getElementById('admin-requests-modal').classList.add('hidden');
}

// Edit Modal Functions
function openEditModal(dateStr, info) {
    currentEditDate = dateStr;
    const dateObj = new Date(dateStr + "T00:00:00");
    document.getElementById('edit-date-display').innerText = dateObj.toLocaleDateString(t('monthLocale'), { weekday: 'long', day: 'numeric', month: 'long' });
    document.getElementById('edit-modal').classList.remove('hidden');
    
    setEditStatus(info.status === 'weekend' ? 'available' : info.status);
    document.getElementById('edit-note').value = info.note || '';
    
    ['NR', 'PM', 'ST'].forEach(b => document.getElementById(`badge-${b.toLowerCase()}`).style.opacity = '0.5');
    currentBadge = null;
    if (info.badge) toggleBadge(info.badge);
}

function closeEditModal() { document.getElementById('edit-modal').classList.add('hidden'); }

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
        currentBadge = null;
        el.style.opacity = '0.5';
    } else {
        ['NR', 'PM', 'ST'].forEach(b => document.getElementById(`badge-${b.toLowerCase()}`).style.opacity = '0.5');
        currentBadge = badge;
        el.style.opacity = '1';
    }
}

async function saveDay() {
    if (!currentEditDate || !window.isAdmin) return;
    const note = document.getElementById('edit-note').value;
    const data = { status: currentEditStatus, note: note, badge: currentBadge || null };

    try {
        await window.dbFormat.setDoc(window.dbFormat.doc(window.db, "availability", currentEditDate), data);
        DATA_STORE.overrides[currentEditDate] = data;
        init(); 
        closeEditModal();
    } catch (e) { alert("Save failed: " + e.message); }
}

async function deleteDay() {
    if (!currentEditDate || !confirm("Clear this day?")) return;
    try {
        await window.dbFormat.deleteDoc(window.dbFormat.doc(window.db, "availability", currentEditDate));
        delete DATA_STORE.overrides[currentEditDate];
        init();
        closeEditModal();
    } catch(e) { alert("Delete failed: " + e.message); }
}

window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.setEditStatus = setEditStatus;
window.toggleBadge = toggleBadge;
window.saveDay = saveDay;
window.deleteDay = deleteDay;

// Printing Logic
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