// requests.js - Handles request logic, sidebar, modal, and tracking
window.requests = {};

let userRequestsUnsub = null;

window.requests.toggleRequestDate = function(dateStr) {
    if(selectedRequestDates.has(dateStr)) selectedRequestDates.delete(dateStr);
    else selectedRequestDates.add(dateStr);
    
    // Refresh UI to show selection rings
    window.ui.renderCalendar(getLocalDateString(new Date()));
    const weekSel = document.getElementById('week-selector').value;
    if(weekSel) window.ui.renderWeekSummary(parseInt(weekSel));
    
    window.requests.updateRequestSidebar();
}

window.requests.updateRequestSidebar = function() {
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
            item.className = "flex items-center justify-between p-3 rounded-xl bg-dynamic border border-dynamic";
            item.innerHTML = `
                <div class="flex items-center gap-3">
                    <span class="text-[10px] font-black uppercase text-pink-500">${d.getDate()}.${d.getMonth()+1}</span>
                    <span class="text-xs font-bold opacity-80">${t(info.status)}</span>
                </div>
                <button onclick="window.requests.toggleRequestDate('${ds}')" class="text-muted-dynamic hover:text-[var(--text-color)] transition"><i class="fas fa-times"></i></button>
            `;
            list.appendChild(item);
        });
        
        if(window.innerWidth < 1024) panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        panel.classList.add('hidden');
        lookupPanel.classList.remove('hidden');
    }
}

window.requests.openRequestModal = function() {
    const subtitle = document.getElementById('req-subtitle');
    const listContainer = document.getElementById('req-date-list');
    
    subtitle.innerText = `For ${selectedRequestDates.size} dager`;
    document.getElementById('request-modal').classList.remove('hidden');
    
    // NEW: Render Inputs Per Date
    listContainer.innerHTML = '';
    const dates = Array.from(selectedRequestDates).sort();
    
    if (dates.length === 0) {
        listContainer.innerHTML = '<p class="text-xs opacity-50 italic">Ingen datoer valgt</p>';
    } else {
        dates.forEach(ds => {
            const d = new Date(ds);
            const niceDate = d.toLocaleDateString(t('monthLocale'), { weekday: 'short', day: 'numeric', month: 'short' });
            
            const row = document.createElement('div');
            row.className = "flex items-center gap-2 group";
            row.innerHTML = `
                <div class="flex-shrink-0 w-16 text-[10px] font-black uppercase tracking-widest opacity-60 leading-tight">${niceDate}</div>
                <input type="text" data-date="${ds}" class="req-date-input flex-1 bg-dynamic border border-dynamic rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:border-pink-500/50 transition placeholder-opacity-40" placeholder="${t('optional')}">
                <button onclick="window.requests.removeDateFromModal('${ds}')" class="w-6 h-6 flex items-center justify-center rounded-md text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition"><i class="fas fa-times text-xs"></i></button>
            `;
            listContainer.appendChild(row);
        });
    }

    // Auto-fill Name if Logged In
    const user = window.auth.currentUser;
    if (user && !user.isAnonymous && user.displayName) {
        document.getElementById('req-name').value = user.displayName;
    }
    
    // Inject Phone / Auth Tip
    const footer = document.getElementById('req-modal-footer');
    if(footer) {
        let footerHtml = '';
        if(DATA_STORE.settings.phone) {
             footerHtml += `<p class="text-[11px] font-black uppercase tracking-widest opacity-60 mt-4 text-center">
                ${t('callMe')} <span class="text-[var(--text-color)] select-all">${DATA_STORE.settings.phone}</span>
             </p>`;
        }
        if(!user || user.isAnonymous) {
             footerHtml += `<p class="text-[11px] font-medium text-pink-400/80 mt-2 text-center italic cursor-pointer hover:text-pink-400" onclick="window.authModule.toggleAuthModal()">
                ${t('loginTip')}
             </p>`;
        }
        footer.innerHTML = footerHtml;
    }
}

// Allows removing a date directly from the modal if user changes mind
window.requests.removeDateFromModal = function(ds) {
    if(selectedRequestDates.has(ds)) {
        selectedRequestDates.delete(ds);
        // Re-render the modal list
        window.requests.openRequestModal();
        // Update background UI so it stays in sync
        window.ui.renderCalendar(getLocalDateString(new Date()));
        window.requests.updateRequestSidebar();
    }
}

window.requests.closeRequestModal = function() {
    document.getElementById('request-modal').classList.add('hidden');
}

window.requests.submitRequest = async function() {
    const name = document.getElementById('req-name').value;
    const globalMsg = document.getElementById('req-msg').value;
    
    if(!name) { alert("Vennligst skriv inn navn"); return; }
    if(selectedRequestDates.size === 0) { alert("Ingen datoer valgt"); return; }

    // Gather Specific Notes
    let specificNotes = [];
    document.querySelectorAll('.req-date-input').forEach(input => {
        if(input.value.trim()) {
            const ds = input.dataset.date;
            specificNotes.push(`- ${ds}: ${input.value.trim()}`);
        }
    });
    
    // Construct Final Message
    let finalMsg = globalMsg;
    if(specificNotes.length > 0) {
        if(finalMsg) finalMsg += "\n\n";
        finalMsg += "Detaljer:\n" + specificNotes.join("\n");
    }
    
    const reqId = "req_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    const user = window.auth.currentUser;
    const isAnon = !user || user.isAnonymous;
    
    const reqData = {
        id: reqId,
        name, 
        message: finalMsg, 
        dates: Array.from(selectedRequestDates), 
        submittedAt: new Date().toISOString(),
        status: 'pending',
        uid: !isAnon ? user.uid : null 
    };
    
    try {
        await window.dbFormat.setDoc(window.dbFormat.doc(window.db, "requests", reqId), reqData);
        
        // Backup to LocalStorage
        let localTracks = JSON.parse(localStorage.getItem('my_requests') || '[]');
        localTracks.push(reqId);
        localStorage.setItem('my_requests', JSON.stringify(localTracks));
        
        selectedRequestDates.clear();
        document.getElementById('req-name').value = '';
        document.getElementById('req-msg').value = '';
        window.requests.closeRequestModal();
        
        document.getElementById('request-sent-modal').classList.remove('hidden');
        
        window.initApp(); 
        if(window.requests.checkRequestStatus) window.requests.checkRequestStatus(); 
    } catch(e) {
        alert("Kunne ikke sende: " + e.message);
    }
}

window.requests.closeRequestSentModal = function() {
    document.getElementById('request-sent-modal').classList.add('hidden');
}

window.requests.subscribeToMyRequests = function(user) {
    if(userRequestsUnsub) userRequestsUnsub();

    const container = document.getElementById('my-requests-container');
    if(!container) return;

    const q = window.dbFormat.query(
        window.dbFormat.collection(window.db, "requests"),
        window.dbFormat.where("uid", "==", user.uid)
    );

    userRequestsUnsub = window.dbFormat.onSnapshot(q, (snapshot) => {
        let allRequests = [];
        snapshot.forEach(doc => allRequests.push(doc.data()));
        allRequests.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
        window.requests.renderRequestTracker(allRequests.slice(0, 5));
    });
}

window.requests.checkRequestStatus = async function() {
    const user = window.auth.currentUser;
    if(user && !user.isAnonymous) return; 

    const container = document.getElementById('my-requests-container');
    if(!container) return; 

    let trackIds = JSON.parse(localStorage.getItem('my_requests') || '[]');
    if (trackIds.length === 0) {
        container.classList.add('hidden');
        return;
    }

    try {
        const recentIds = trackIds.slice(-5).reverse();
        let requests = [];
        for (const rid of recentIds) {
            const docRef = await window.dbFormat.getDoc(window.dbFormat.doc(window.db, "requests", rid));
            if (docRef.exists()) requests.push(docRef.data());
        }
        window.requests.renderRequestTracker(requests);
    } catch(e) { console.log("Guest polling error", e); }
}

window.requests.renderRequestTracker = function(dataList) {
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
        const seenKey = `req_status_${data.id}`;
        const seenStatus = localStorage.getItem(seenKey);
        
        if (data.status !== 'pending' && seenStatus !== data.status) {
            window.requests.openNotificationModal(data.status, data.adminResponse);
            localStorage.setItem(seenKey, data.status); 
        }

        const statusColors = {
            'pending': 'bg-yellow-500/20 text-yellow-500 border-yellow-500/20',
            'approved': 'bg-emerald-500/20 text-emerald-500 border-emerald-500/20',
            'rejected': 'bg-red-500/20 text-red-500 border-red-500/20',
            'archived': 'bg-gray-500/20 text-gray-500 border-gray-500/20'
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
                    ${data.status}
                </span>
            </div>
            ${responseHtml}
        `;
        container.appendChild(div);
    }
}

window.requests.openNotificationModal = function(status, message) {
    const modal = document.getElementById('notification-modal');
    if(!modal) return;
    const textEl = document.getElementById('notification-text');
    if(status === 'approved') textEl.innerText = t('updateApproved');
    else if(status === 'rejected') textEl.innerText = t('updateRejected');
    else textEl.innerText = t('updateCheck');
    
    const msgEl = document.getElementById('notification-message');
    if(message) {
        msgEl.innerText = `"${message}"`;
        msgEl.classList.remove('hidden');
    } else {
        msgEl.classList.add('hidden');
    }
    modal.classList.remove('hidden');
}

window.requests.closeNotificationModal = function() {
    document.getElementById('notification-modal').classList.add('hidden');
}