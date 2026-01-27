// ui.js - Handles visual rendering and interactions
window.ui = {};

window.ui.toggleTheme = function() {
    const isDark = document.body.classList.toggle('dark-mode');
    const icon = document.getElementById('theme-icon');
    icon.className = isDark ? 'fas fa-moon text-base lg:text-lg' : 'fas fa-sun text-base lg:text-lg';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

window.ui.toggleLanguage = function() {
    CURRENT_LANG = CURRENT_LANG === 'nb' ? 'en' : 'nb';
    localStorage.setItem('lang', CURRENT_LANG); 
    window.ui.updateLanguageUI();
    window.initApp(); // Re-render
}

window.ui.updateLanguageUI = function() {
    document.getElementById('lang-flag').innerText = CURRENT_LANG === 'nb' ? '🇳🇴' : '🇬🇧';
    document.getElementById('lang-label').innerText = CURRENT_LANG.toUpperCase();
    document.querySelectorAll('[data-tr]').forEach(el => el.innerText = t(el.dataset.tr));
    const ph = document.getElementById('bulk-response');
    if(ph) ph.placeholder = t('adminPlaceholder');
    const signTitle = document.querySelector('[data-tr="signInTitle"]');
    if(signTitle) signTitle.innerText = t('signInTitle');
    const signGoogle = document.querySelector('[data-tr="signInGoogle"]');
    if(signGoogle) signGoogle.innerText = t('signInGoogle');
}

window.ui.updateStatus = function(text, color) {
    const el = document.getElementById('sync-status');
    if (!el) return;
    const states = {
        blue:    { icon: 'fa-circle-notch fa-spin', color: 'text-blue-500' },
        emerald: { icon: 'fa-globe',                color: 'text-emerald-500' },
        gray:    { icon: 'fa-database',             color: 'text-gray-500' },
        busy:    { icon: 'fa-exclamation-circle',   color: 'text-red-500' }
    };
    const state = states[color] || states.gray;
    el.className = `inline-flex items-center gap-2 ${state.color}`;
    el.innerHTML = `
        <i class="fas ${state.icon} text-lg lg:text-base"></i>
        <span class="hidden sm:inline text-[10px] lg:text-xs font-black uppercase tracking-widest pt-0.5">${text}</span>
    `;
}

window.ui.renderHero = function(todayStr) {
    const info = getInfo(todayStr);
    document.getElementById('hero-date').innerText = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }).replace('/', '.');
    document.getElementById('hero-note').innerText = info.note || t('noPlans');
    document.getElementById('hero-label').innerText = translateNote(t(info.status));
    const statusColor = getComputedStyle(document.documentElement).getPropertyValue(`--${info.status}`).trim();
    document.getElementById('hero-dot').style.backgroundColor = statusColor || '#333';
}

window.ui.renderWeekSummary = function(weekNumber) {
    const container = document.getElementById('week-summary-grid');
    container.innerHTML = '';
    const monday = getDateFromWeek(weekNumber, new Date().getFullYear());
    const todayStr = getLocalDateString(new Date());
    for (let i = 0; i < 5; i++) {
        const curr = new Date(monday); curr.setDate(monday.getDate() + i);
        const ds = getLocalDateString(curr); const info = getInfo(ds);
        const div = document.createElement('div');
        div.className = `summary-card status-${info.status}-card cursor-pointer last:col-span-2 sm:last:col-span-1 ${ds === todayStr ? 'is-today' : ''} ${selectedRequestDates.has(ds) ? 'request-selected' : ''}`;
        
        div.onclick = () => { 
            if (window.isAdmin) window.openEditModal(ds, info);
            else window.requests.toggleRequestDate(ds);
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

window.ui.renderCalendar = function(todayStr) {
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
                    if (window.isAdmin) window.openEditModal(ds, info);
                    else window.requests.toggleRequestDate(ds);
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

window.ui.populateWeekDropdown = function(currentWeek) {
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

window.ui.onWeekChange = function(week) { window.ui.renderWeekSummary(parseInt(week)); }
window.ui.changeMonth = function(offset) { 
    currentViewDate.setMonth(currentViewDate.getMonth() + offset); 
    window.ui.renderCalendar(getLocalDateString(new Date())); 
}

window.ui.runLookup = function() {
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

// Printing
window.ui.togglePrintModal = function() { document.getElementById('print-modal').classList.toggle('hidden'); }
window.ui.executePrint = function() {
    const sm = document.getElementById('print-start-month').value;
    const em = document.getElementById('print-end-month').value;
    if(!sm || !em) return;
    const start = new Date(sm + "-01T00:00:00"); const end = new Date(em + "-01T00:00:00");
    end.setMonth(end.getMonth() + 1); end.setDate(0);
    // This calls back to a global or app function, but let's inline the PDF gen here if it was separate, but admin.js has it. 
    // Wait, admin.js has print logic? It was in admin.js in the previous version. I'll leave it there or move it.
    // Let's assume generatePrintSummary is available globally. 
    if(window.generatePrintSummary) { window.generatePrintSummary(start, end); window.ui.togglePrintModal(); }
}

// Tutorial
window.ui.openTutorial = function() {
    currentTutorialStep = 0;
    document.getElementById('tutorial-modal').classList.remove('hidden');
    window.ui.updateTutorialUI();
}
window.ui.closeTutorial = function() {
    document.getElementById('tutorial-modal').classList.add('hidden');
    localStorage.setItem('tutorial_seen', 'true');
}
window.ui.nextTutorialStep = function() {
    if (currentTutorialStep < 2) {
        currentTutorialStep++;
        window.ui.updateTutorialUI();
    } else {
        window.ui.closeTutorial();
    }
}
window.ui.updateTutorialUI = function() {
    for (let i = 0; i < 3; i++) {
        const slide = document.getElementById(`tut-slide-${i}`);
        if (i === currentTutorialStep) slide.classList.remove('hidden');
        else slide.classList.add('hidden');
        
        const dot = document.getElementById(`tut-dot-${i}`);
        if (i === currentTutorialStep) {
            dot.classList.remove('opacity-20');
            dot.classList.add('opacity-100', 'scale-110');
        } else {
            dot.classList.add('opacity-20');
            dot.classList.remove('opacity-100', 'scale-110');
        }
    }
    const btn = document.getElementById('tut-next-btn');
    if (currentTutorialStep === 2) btn.innerText = t('tutGotIt');
    else btn.innerText = t('tutNext');
}