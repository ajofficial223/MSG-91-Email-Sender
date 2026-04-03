/* =============================================
   MSG91 Email Sender — Complete Application Logic
   ============================================= */

// ── Config ─────────────────────────────────────
const PROXY_API_URL  = 'http://localhost:3091/api/v5/email/send';
const SMTP_PROXY_URL = 'http://localhost:3091/api/smtp/send';

// ── State ───────────────────────────────────────
let recipients      = [];
let sendLogs        = [];
let emailTemplates  = [];
let templateVars    = [];  // string[]  — clean names only
let sendMode        = 'api'; // 'api' | 'smtp'
let isSending       = false;
let seqAbort        = false;

// ── Init ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadAll();
    updateAllUI();
    applyModeLabels();
});

function loadAll() {
    loadApiSettings();
    loadSmtpSettings();
    loadRecipients();
    loadLogs();
    loadTemplates();
    // Builder state
    const bs = safeParse(localStorage.getItem('msg91_builder'));
    if (bs) {
        setVal('emailSubject', bs.subject || '');
        setVal('htmlEditor', bs.html || '');
        refreshPreview();
        detectVars();
    }
}

// ── Navigation ──────────────────────────────────
const PAGE_META = {
    'api-settings':  { title: 'API Settings',    sub: 'Configure your MSG91 API credentials and sender details' },
    'smtp-settings': { title: 'SMTP Settings',   sub: 'Configure SMTP connection for direct email sending' },
    'builder':       { title: 'HTML Builder',     sub: 'Design your email template with live preview' },
    'templates':     { title: 'Saved Templates',  sub: 'Manage your saved email templates' },
    'recipients':    { title: 'Recipients',       sub: 'Manage email recipients and import lists' },
    'send':          { title: 'Send Emails',      sub: 'Send emails via API or SMTP to your recipients' },
    'logs':          { title: 'Send Logs',        sub: 'Track and review all email sending activity' },
};

function switchTab(tab) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.tab === tab);
    });
    // Update panels
    document.querySelectorAll('.tab-panel').forEach(el => el.classList.remove('active'));
    const panel = document.getElementById('panel-' + tab);
    if (panel) panel.classList.add('active');

    // Update page title
    const meta = PAGE_META[tab] || {};
    setTxt('pageTitle',    meta.title || tab);
    setTxt('pageSubtitle', meta.sub   || '');

    // Refresh data on tab change
    if (tab === 'send')      refreshSendTab();
    if (tab === 'templates') renderTemplates();
    if (tab === 'recipients') renderRecipVarFields();
    if (tab === 'logs')      renderLogs();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ── Toast ───────────────────────────────────────
function toast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icons = { success: '✓', error: '✕', warning: '!', info: 'i' };
    t.innerHTML = `<strong>${icons[type] || 'i'}</strong><span>${escHtml(msg)}</span>`;
    c.appendChild(t);
    setTimeout(() => {
        t.classList.add('fade-out');
        setTimeout(() => t.remove(), 280);
    }, 3800);
}

// ── API Settings ────────────────────────────────
function saveApiSettings() {
    const s = {
        authKey:     getVal('authKey'),
        domain:      getVal('domain'),
        templateId:  getVal('templateId'),
        senderName:  getVal('senderName'),
        senderEmail: getVal('senderEmail'),
    };
    if (!s.authKey || !s.domain || !s.senderName || !s.senderEmail || !s.templateId) {
        toast('Please fill all required fields.', 'error');
        return;
    }
    localStorage.setItem('msg91_api_settings', JSON.stringify(s));
    updateConnectionStatus();
    refreshSendTab();
    toast('API settings saved!', 'success');
}

function loadApiSettings() {
    const s = safeParse(localStorage.getItem('msg91_api_settings'));
    if (!s) {
        // Apply defaults
        const def = {
            authKey: '469819AdD4pDVwf6O6965ff88P1',
            domain: 'gignut.com',
            templateId: 'support_gignut_v1',
            senderName: 'Gignut Team',
            senderEmail: 'support@gignut.com',
        };
        setVal('authKey',     def.authKey);
        setVal('domain',      def.domain);
        setVal('templateId',  def.templateId);
        setVal('senderName',  def.senderName);
        setVal('senderEmail', def.senderEmail);
        localStorage.setItem('msg91_api_settings', JSON.stringify(def));
    } else {
        setVal('authKey',     s.authKey     || '');
        setVal('domain',      s.domain      || '');
        setVal('templateId',  s.templateId  || '');
        setVal('senderName',  s.senderName  || '');
        setVal('senderEmail', s.senderEmail || '');
    }
    updateConnectionStatus();
}

function clearApiSettings() {
    if (!confirm('Clear all API settings?')) return;
    localStorage.removeItem('msg91_api_settings');
    ['authKey','domain','templateId','senderName','senderEmail'].forEach(id => setVal(id, ''));
    updateConnectionStatus();
    toast('API settings cleared.', 'info');
}

function getApiSettings() { return safeParse(localStorage.getItem('msg91_api_settings')); }

// ── SMTP Settings ────────────────────────────────
function saveSmtpSettings() {
    const s = {
        host:      getVal('smtpHost'),
        port:      parseInt(getVal('smtpPort')) || 587,
        user:      getVal('smtpUser'),
        pass:      getVal('smtpPass'),
        secure:    document.getElementById('smtpSecure').checked,
        fromName:  getVal('smtpFromName'),
        fromEmail: getVal('smtpFromEmail'),
    };
    if (!s.host || !s.user || !s.pass) {
        toast('Please fill Host, Username, and Password.', 'error');
        return;
    }
    localStorage.setItem('msg91_smtp_settings', JSON.stringify(s));
    toast('SMTP settings saved!', 'success');
}

function loadSmtpSettings() {
    const s = safeParse(localStorage.getItem('msg91_smtp_settings'));
    if (!s) return;
    setVal('smtpHost', s.host || '');
    setVal('smtpPort', s.port || 587);
    setVal('smtpUser', s.user || '');
    setVal('smtpPass', s.pass || '');
    document.getElementById('smtpSecure').checked = !!s.secure;
    setVal('smtpFromName',  s.fromName  || '');
    setVal('smtpFromEmail', s.fromEmail || '');
}

function clearSmtpSettings() {
    if (!confirm('Clear SMTP settings?')) return;
    localStorage.removeItem('msg91_smtp_settings');
    ['smtpHost','smtpPort','smtpUser','smtpPass','smtpFromName','smtpFromEmail'].forEach(id => setVal(id, ''));
    document.getElementById('smtpSecure').checked = false;
    toast('SMTP settings cleared.', 'info');
}

function getSmtpSettings() { return safeParse(localStorage.getItem('msg91_smtp_settings')); }

async function testSmtpConnection() {
    const s = getSmtpSettings();
    if (!s) { toast('Save SMTP settings first.', 'error'); return; }
    toast('Testing SMTP connection…', 'info');
    const apiS = getApiSettings();
    const fromName  = s.fromName  || apiS?.senderName  || 'Test';
    const fromEmail = s.fromEmail || apiS?.senderEmail  || s.user;
    try {
        const res = await fetch(SMTP_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                smtp: { host: s.host, port: s.port, user: s.user, pass: s.pass, secure: s.secure },
                email: {
                    from: `"${fromName}" <${fromEmail}>`,
                    to: s.user,
                    subject: 'MSG91 Sender – SMTP Connection Test',
                    html: '<p>✅ SMTP connection test successful!</p>'
                }
            })
        });
        const data = await res.json();
        if (res.ok) toast('SMTP connection successful! Test email sent.', 'success');
        else toast(`SMTP test failed: ${data.message || 'Unknown error'}`, 'error');
    } catch (e) {
        toast(`SMTP test error: ${e.message}`, 'error');
    }
}

// ── Connection Status ────────────────────────────
function updateConnectionStatus() {
    const s = getApiSettings();
    const el = document.getElementById('connectionStatus');
    if (s && s.authKey && s.domain) {
        el.classList.add('ok');
        el.querySelector('.status-label').textContent = 'Configured';
    } else {
        el.classList.remove('ok');
        el.querySelector('.status-label').textContent = 'Not Configured';
    }
}

// ── Send Mode Toggle ─────────────────────────────
function toggleSendMode() {
    sendMode = document.getElementById('sendModeToggle').checked ? 'smtp' : 'api';
    applyModeLabels();
    refreshSendTab();
}

function applyModeLabels() {
    const isSmtp = sendMode === 'smtp';
    document.getElementById('apiLabel') .classList.toggle('active', !isSmtp);
    document.getElementById('smtpLabel').classList.toggle('active',  isSmtp);
    const d = document.getElementById('sendModeDisplay');
    if (d) d.textContent = isSmtp ? 'SMTP' : 'MSG91 API';
}

// ── Eye toggle ───────────────────────────────────
function toggleEye(id, btn) {
    const inp = document.getElementById(id);
    if (!inp) return;
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    btn.innerHTML = show
        ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
}

// ── Builder ──────────────────────────────────────
function onBuilderInput() {
    refreshPreview();
    detectVars();
    saveBuilderState();
}

function refreshPreview() {
    const html = getVal('htmlEditor');
    const frame = document.getElementById('previewFrame');
    const ph    = document.getElementById('previewPlaceholder');
    if (!html.trim()) {
        if (ph) ph.style.display = 'flex';
        return;
    }
    if (ph) ph.style.display = 'none';
    if (frame) {
        const doc = frame.contentDocument || frame.contentWindow.document;
        doc.open(); doc.write(html); doc.close();
    }
}

function detectVars() {
    const subject = getVal('emailSubject');
    const html    = getVal('htmlEditor');
    const combined = subject + ' ' + html;
    const found = new Set();
    const rx = /{{(\s*[\w\d_]+\s*)}}/g;
    let m;
    while ((m = rx.exec(combined)) !== null) {
        found.add(m[1].trim());
    }
    const newVars = Array.from(found);
    const sortedNew = [...newVars].sort().join('|');
    const sortedOld = [...templateVars].sort().join('|');

    if (sortedNew !== sortedOld) {
        templateVars = newVars;
        renderDetectedVarsBar();
        renderRecipVarFields();
    }
}

function renderDetectedVarsBar() {
    const bar  = document.getElementById('detectedVarsBar');
    const tags = document.getElementById('detectedVarTags');
    if (!bar || !tags) return;
    if (templateVars.length === 0) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    tags.innerHTML = templateVars.map(v =>
        `<span class="det-var-tag">{{${escHtml(v)}}}</span>`
    ).join('');
}

function clearHtmlEditor() {
    if (!confirm('Clear the HTML editor?')) return;
    setVal('htmlEditor', '');
    const frame = document.getElementById('previewFrame');
    if (frame) { const d = frame.contentDocument || frame.contentWindow.document; d.open(); d.write(''); d.close(); }
    const ph = document.getElementById('previewPlaceholder');
    if (ph) ph.style.display = 'flex';
    detectVars();
    saveBuilderState();
}

function saveBuilderState() {
    localStorage.setItem('msg91_builder', JSON.stringify({
        subject: getVal('emailSubject'),
        html:    getVal('htmlEditor')
    }));
}

// ── Templates ────────────────────────────────────
function loadTemplates() {
    emailTemplates = safeParse(localStorage.getItem('msg91_templates')) || [];
    updateTemplateCount();
}

function saveTemplatesStore() {
    localStorage.setItem('msg91_templates', JSON.stringify(emailTemplates));
    updateTemplateCount();
}

function updateTemplateCount() {
    setTxt('templateCount', emailTemplates.length);
}

function saveCurrentTemplate() {
    const html = getVal('htmlEditor');
    const subject = getVal('emailSubject');
    if (!html.trim() && !subject.trim()) {
        toast('Nothing to save — add HTML content or a subject first.', 'warning');
        return;
    }
    openModal('saveTemplateModal');
}

function confirmSaveTemplate() {
    const name = getVal('templateName').trim();
    if (!name) { toast('Please enter a template name.', 'error'); return; }
    const desc = getVal('templateDescription').trim();
    const tpl = {
        id:      genId(),
        name,
        description: desc,
        subject: getVal('emailSubject'),
        html:    getVal('htmlEditor'),
        vars:    [...templateVars],
        savedAt: new Date().toISOString()
    };
    emailTemplates.unshift(tpl);
    saveTemplatesStore();
    renderTemplates();
    closeModal('saveTemplateModal');
    setVal('templateName', '');
    setVal('templateDescription', '');
    toast(`Template "${name}" saved!`, 'success');
}

function deleteTemplate(id) {
    if (!confirm('Delete this template?')) return;
    emailTemplates = emailTemplates.filter(t => t.id !== id);
    saveTemplatesStore();
    renderTemplates();
    toast('Template deleted.', 'info');
}

function loadTemplateIntoBuilder(id) {
    const tpl = emailTemplates.find(t => t.id === id);
    if (!tpl) return;
    setVal('emailSubject', tpl.subject || '');
    setVal('htmlEditor',   tpl.html    || '');
    templateVars = tpl.vars || [];
    refreshPreview();
    detectVars();
    saveBuilderState();
    switchTab('builder');
    toast(`Loaded: ${tpl.name}`, 'success');
    closeModal('loadTemplateModal');
}

function renderTemplates(filter = '') {
    const grid   = document.getElementById('templateGrid');
    const empty  = document.getElementById('noTemplates');
    const search = filter.toLowerCase();
    const list   = emailTemplates.filter(t =>
        t.name.toLowerCase().includes(search) ||
        (t.description && t.description.toLowerCase().includes(search))
    );

    if (list.length === 0) {
        if (grid)  grid.innerHTML = '';
        if (empty) empty.style.display = 'flex';
        return;
    }
    if (empty) empty.style.display = 'none';
    grid.innerHTML = list.map(t => `
        <div class="template-card">
            <div class="template-preview">
                <iframe srcdoc="${escAttr(t.html || '<p style=padding:16px;color:#94a3b8;>No HTML</p>')}" sandbox="allow-same-origin" title="${escAttr(t.name)}"></iframe>
            </div>
            <div class="template-card-body">
                <div class="template-card-name" title="${escAttr(t.name)}">${escHtml(t.name)}</div>
                <div class="template-card-desc">${escHtml(t.description || t.subject || 'No description')}</div>
                <div class="template-card-meta">
                    <span class="template-card-date">${fmtDate(t.savedAt)}</span>
                    <div class="template-card-actions">
                        <button class="btn btn-outline btn-sm" onclick="loadTemplateIntoBuilder('${t.id}')">Load</button>
                        <button class="btn btn-ghost btn-sm danger" onclick="deleteTemplate('${t.id}')">Delete</button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function filterTemplates(q) { renderTemplates(q); }

function loadTemplateToBuilder() {
    if (emailTemplates.length === 0) {
        toast('No templates saved yet. Save one from the HTML Builder.', 'warning');
        return;
    }
    const list = document.getElementById('loadTemplateList');
    const noTpl = document.getElementById('noLoadTemplates');
    if (emailTemplates.length === 0) {
        list.innerHTML = '';
        noTpl.style.display = 'block';
    } else {
        noTpl.style.display = 'none';
        list.innerHTML = emailTemplates.map(t => `
            <div class="tpl-select-item" onclick="loadTemplateIntoBuilder('${t.id}')">
                <div class="tpl-select-info">
                    <h5>${escHtml(t.name)}</h5>
                    <p>${escHtml(t.description || t.subject || 'No description')} · ${fmtDate(t.savedAt)}</p>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
        `).join('');
    }
    openModal('loadTemplateModal');
}

// ── Recipients ───────────────────────────────────
function addRecipient() {
    const name  = getVal('recipName').trim();
    const email = getVal('recipEmail').trim();
    if (!email) { toast('Email is required.', 'error'); return; }
    if (!isEmail(email)) { toast('Invalid email address.', 'error'); return; }
    if (recipients.some(r => r.email.toLowerCase() === email.toLowerCase())) {
        toast('This email is already in the list.', 'warning'); return;
    }
    const vars = {};
    templateVars.forEach((v, i) => {
        const el = document.getElementById(`rv_${i}`);
        if (v) vars[v] = el ? el.value.trim() : '';
    });
    recipients.push({ id: genId(), name, email, vars });
    saveRecipients();
    updateAllUI();
    setVal('recipName', '');
    setVal('recipEmail', '');
    document.querySelectorAll('[id^="rv_"]').forEach(el => el.value = '');
    toast(`Added: ${name || email}`, 'success');
}

function removeRecipient(id) {
    recipients = recipients.filter(r => r.id !== id);
    saveRecipients();
    updateAllUI();
}

function clearAllRecipients() {
    if (!confirm(`Remove all ${recipients.length} recipients?`)) return;
    recipients = [];
    saveRecipients();
    updateAllUI();
    toast('All recipients cleared.', 'info');
}

function toggleSelectAll(cb) {
    document.querySelectorAll('#recipientTableBody input[type="checkbox"]').forEach(c => c.checked = cb.checked);
}

function saveRecipients() { localStorage.setItem('msg91_recipients', JSON.stringify(recipients)); }
function loadRecipients() {
    recipients = safeParse(localStorage.getItem('msg91_recipients')) || [];
    // Clean legacy variable keys
    recipients.forEach(r => {
        if (r.variables && !r.vars) { r.vars = r.variables; delete r.variables; }
    });
}

function renderRecipVarFields() {
    const c = document.getElementById('recipVarFields');
    if (!c) return;
    const active = templateVars.filter(v => v);
    if (active.length === 0) { c.innerHTML = ''; return; }
    c.innerHTML = `<div class="field-row two-col" style="margin-top:4px;">${active.map((v, i) => `
        <div class="field-group">
            <label for="rv_${i}">{{${escHtml(v)}}}</label>
            <input type="text" id="rv_${i}" placeholder="Value for ${escHtml(v)}">
        </div>
    `).join('')}</div>`;
}

// ── CSV Handling ─────────────────────────────────
function handleCSVUpload(e) {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => { parseCSV(ev.target.result); e.target.value = ''; };
    reader.readAsText(f);
}

function parseCsvPaste() {
    const txt = getVal('csvPaste').trim();
    if (!txt) { toast('Paste CSV data first.', 'error'); return; }
    parseCSV(txt);
    setVal('csvPaste', '');
}

function parseCSV(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) { toast('No data found.', 'error'); return; }
    let added = 0, skipped = 0;
    // Detect if first line is header
    const firstParts = lines[0].split(',').map(p => p.trim());
    const isHeader = firstParts.some(p => !isEmail(p) && p.toLowerCase() !== 'name');
    const startIdx = isHeader ? 1 : 0;
    const headerParts = isHeader ? firstParts : null;

    lines.slice(startIdx).forEach(line => {
        const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
        if (parts.length < 2) return;
        const name  = parts[0];
        const email = parts[1];
        if (!isEmail(email)) { skipped++; return; }
        if (recipients.some(r => r.email.toLowerCase() === email.toLowerCase())) { skipped++; return; }
        const vars = {};
        templateVars.forEach((v, i) => {
            if (v && parts[i + 2] !== undefined) vars[v] = parts[i + 2];
        });
        recipients.push({ id: genId(), name, email, vars });
        added++;
    });
    saveRecipients();
    updateAllUI();
    toast(`Imported ${added} recipients${skipped > 0 ? `, skipped ${skipped}` : ''}.`, added > 0 ? 'success' : 'warning');
}

// ── UI Rendering ─────────────────────────────────
function updateAllUI() {
    renderRecipientTable();
    updateRecipientCount();
    renderRecipVarFields();
    renderLogs();
    updateStatusStats();
}

function renderRecipientTable() {
    const tbody   = document.getElementById('recipientTableBody');
    const empty   = document.getElementById('noRecipients');
    const table   = document.getElementById('recipientTable');
    const clearB  = document.getElementById('clearAllBtn');
    const total   = document.getElementById('totalRecipients');

    if (total) total.textContent = recipients.length;
    if (clearB) clearB.style.display = recipients.length > 0 ? '' : 'none';

    if (recipients.length === 0) {
        if (tbody) tbody.innerHTML = '';
        if (empty) empty.style.display = 'flex';
        if (table) table.style.display = 'none';
        return;
    }
    if (empty) empty.style.display = 'none';
    if (table) table.style.display = '';

    tbody.innerHTML = recipients.map(r => {
        const varTags = Object.entries(r.vars || {})
            .filter(([k, v]) => k && v)
            .map(([k, v]) => `<span class="var-tag">${escHtml(k)}: ${escHtml(v)}</span>`)
            .join('');
        return `
            <tr>
                <td><input type="checkbox" value="${r.id}"></td>
                <td>${escHtml(r.name || '—')}</td>
                <td style="color:var(--indigo-600);font-weight:500;">${escHtml(r.email)}</td>
                <td><div class="var-tags">${varTags || '<span style="color:var(--text-muted);">—</span>'}</div></td>
                <td>
                    <div class="action-btns">
                        <button class="act-btn send" onclick="quickSend('${r.id}')" title="Quick Send">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        </button>
                        <button class="act-btn" onclick="removeRecipient('${r.id}')" title="Remove">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </td>
            </tr>`;
    }).join('');
}

function updateRecipientCount() {
    setTxt('recipientCount', recipients.length);
}

function refreshSendTab() {
    const settings = getApiSettings();
    const bs = safeParse(localStorage.getItem('msg91_builder'));

    setTxt('sendTotalRecipients', recipients.length);
    setTxt('sendModeDisplay', sendMode === 'smtp' ? 'SMTP' : 'MSG91 API');

    const tplLabel = sendMode === 'smtp'
        ? (bs?.subject || '— No subject set —')
        : (settings?.templateId || '—');
    setTxt('sendTemplateId', tplLabel);

    // Individual select
    const sel = document.getElementById('individualSelect');
    if (sel) {
        sel.innerHTML = '<option value="">— Choose recipient —</option>' +
            recipients.map(r => `<option value="${r.id}">${escHtml(r.name || r.email)} (${escHtml(r.email)})</option>`).join('');
    }
    updateApiPreview();
}

function updateApiPreview() {
    const el = document.getElementById('apiPreview');
    if (!el) return;
    const settings = getApiSettings();
    if (!settings || recipients.length === 0) {
        el.innerHTML = '<code>Configure settings and add recipients to see the request preview.</code>';
        return;
    }
    if (sendMode === 'smtp') {
        const smtp = getSmtpSettings();
        const bs = safeParse(localStorage.getItem('msg91_builder'));
        const preview = {
            mode: 'SMTP',
            smtp_host: smtp?.host || '—',
            smtp_port: smtp?.port || 587,
            to: recipients.slice(0, 3).map(r => r.email),
            subject: bs?.subject || '—',
            html_preview: (bs?.html || '').slice(0, 100) + (bs?.html?.length > 100 ? '…' : ''),
        };
        if (recipients.length > 3) preview.note = `Showing 3 of ${recipients.length}`;
        el.innerHTML = `<code>${syntaxHL(JSON.stringify(preview, null, 2))}</code>`;
    } else {
        const payload = buildApiPayload(recipients.slice(0, 3));
        const preview = {
            url: 'POST https://control.msg91.com/api/v5/email/send',
            authkey: (settings.authKey || '').slice(0, 8) + '...',
            body: payload
        };
        if (recipients.length > 3) preview.note = `Showing 3 of ${recipients.length}`;
        el.innerHTML = `<code>${syntaxHL(JSON.stringify(preview, null, 2))}</code>`;
    }
}

// ── Send Functions ────────────────────────────────
function buildApiPayload(subset) {
    const s = getApiSettings();
    if (!s) return null;
    return {
        recipients: subset.map(r => ({
            to: [{ name: r.name || '', email: r.email }],
            variables: r.vars || {}
        })),
        from: { name: s.senderName, email: s.senderEmail },
        domain: s.domain,
        template_id: s.templateId
    };
}

function buildSmtpPayload(recipient) {
    const apiS  = getApiSettings() || {};
    const smtpS = getSmtpSettings() || {};
    const bs    = safeParse(localStorage.getItem('msg91_builder')) || {};

    const fromName  = smtpS.fromName  || apiS.senderName  || 'Sender';
    const fromEmail = smtpS.fromEmail || apiS.senderEmail || smtpS.user;
    const vars = recipient.vars || {};

    return {
        smtp: {
            host:   smtpS.host   || '',
            port:   smtpS.port   || 587,
            user:   smtpS.user   || '',
            pass:   smtpS.pass   || '',
            secure: smtpS.secure || false
        },
        email: {
            from:    `"${fromName}" <${fromEmail}>`,
            to:      recipient.email,
            subject: injectVars(bs.subject || '', vars),
            html:    injectVars(bs.html    || '', vars)
        }
    };
}

async function callApiSend(payload, authKey) {
    const res = await fetch(PROXY_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'authkey': authKey },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    return { ok: res.ok, data };
}

async function callSmtpSend(payload) {
    const res = await fetch(SMTP_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    return { ok: res.ok, data };
}

async function sendOneRecipient(r) {
    const logId = genId();
    addLog(logId, r.name, r.email, sendMode, 'pending', 'Sending…');
    try {
        let result;
        if (sendMode === 'smtp') {
            const smtp = getSmtpSettings();
            if (!smtp) throw new Error('SMTP not configured. Go to SMTP Settings first.');
            result = await callSmtpSend(buildSmtpPayload(r));
        } else {
            const api = getApiSettings();
            if (!api) throw new Error('API not configured. Go to API Settings first.');
            result = await callApiSend(buildApiPayload([r]), api.authKey);
        }
        const status = result.ok ? 'success' : 'failed';
        updateLog(logId, status, JSON.stringify(result.data));
        return result.ok;
    } catch (e) {
        updateLog(logId, 'failed', e.message);
        return false;
    }
}

// BULK
async function sendBulk() {
    if (recipients.length === 0) { toast('No recipients.', 'error'); return; }
    if (isSending) { toast('Already sending.', 'warning'); return; }

    // Validate config
    if (sendMode === 'smtp' && !getSmtpSettings()) { toast('Set up SMTP settings first.', 'error'); switchTab('smtp-settings'); return; }
    if (sendMode === 'api'  && !getApiSettings())  { toast('Set up API settings first.', 'error');  switchTab('api-settings'); return; }

    isSending = true;
    setBtnState('btnSendBulk', true, 'Sending…');

    if (sendMode === 'smtp') {
        // SMTP: send individually in parallel
        const results = await Promise.all(recipients.map(r => sendOneRecipient(r)));
        const ok = results.filter(Boolean).length;
        toast(`Sent ${ok}/${recipients.length} via SMTP.`, ok === recipients.length ? 'success' : 'warning');
    } else {
        // API: single batch call
        const api = getApiSettings();
        const logIds = recipients.map(r => {
            const lId = genId();
            addLog(lId, r.name, r.email, 'api', 'pending', 'Sending…');
            return lId;
        });
        try {
            const result = await callApiSend(buildApiPayload(recipients), api.authKey);
            const status = result.ok ? 'success' : 'failed';
            logIds.forEach(id => updateLog(id, status, JSON.stringify(result.data)));
            toast(result.ok ? `Bulk sent to ${recipients.length} recipients!` : `Failed: ${result.data?.message || 'Unknown'}`, result.ok ? 'success' : 'error');
        } catch (e) {
            logIds.forEach(id => updateLog(id, 'failed', e.message));
            toast(`Error: ${e.message}`, 'error');
        }
    }

    isSending = false;
    setBtnState('btnSendBulk', false, 'Send Bulk Email');
    updateStatusStats();
}

// SEQUENTIAL
async function sendSequential() {
    if (recipients.length === 0) { toast('No recipients.', 'error'); return; }
    if (isSending) { toast('Already sending.', 'warning'); return; }
    if (sendMode === 'smtp' && !getSmtpSettings()) { toast('Set up SMTP settings first.', 'error'); switchTab('smtp-settings'); return; }
    if (sendMode === 'api'  && !getApiSettings())  { toast('Set up API settings first.', 'error');  switchTab('api-settings'); return; }

    const delay = (parseInt(getVal('sendDelay')) || 2) * 1000;
    isSending = true;
    seqAbort  = false;
    setBtnState('btnSendSeq', true, 'Sending…');

    const prog  = document.getElementById('seqProgress');
    const fill  = document.getElementById('progressFill');
    const txt   = document.getElementById('progressText');
    if (prog) prog.classList.remove('hidden');

    for (let i = 0; i < recipients.length; i++) {
        if (seqAbort) { toast('Sequential send stopped.', 'warning'); break; }
        const pct = Math.round(((i + 1) / recipients.length) * 100);
        if (fill) fill.style.width = pct + '%';
        if (txt)  txt.textContent  = `${i + 1} / ${recipients.length}`;
        await sendOneRecipient(recipients[i]);
        updateStatusStats();
        if (i < recipients.length - 1 && !seqAbort) await sleep(delay);
    }

    isSending = false;
    seqAbort  = false;
    setBtnState('btnSendSeq', false, 'Start Sequential');
    if (prog) prog.classList.add('hidden');
    if (!seqAbort) toast('Sequential send completed!', 'success');
}

function stopSequential() { seqAbort = true; }

// INDIVIDUAL
async function sendIndividual() {
    const sel = document.getElementById('individualSelect');
    if (!sel || !sel.value) { toast('Select a recipient first.', 'error'); return; }
    const r = recipients.find(r => r.id === sel.value);
    if (!r) { toast('Recipient not found.', 'error'); return; }
    if (isSending) { toast('Already sending.', 'warning'); return; }
    if (sendMode === 'smtp' && !getSmtpSettings()) { toast('Set up SMTP settings first.', 'error'); switchTab('smtp-settings'); return; }
    if (sendMode === 'api'  && !getApiSettings())  { toast('Set up API settings first.', 'error');  switchTab('api-settings'); return; }

    isSending = true;
    setBtnState('btnSendIndividual', true, 'Sending…');
    const ok = await sendOneRecipient(r);
    isSending = false;
    setBtnState('btnSendIndividual', false, 'Send to Selected');
    toast(ok ? `Email sent to ${r.name || r.email}!` : `Failed to send to ${r.email}.`, ok ? 'success' : 'error');
    updateStatusStats();
}

// Quick send from recipient table
async function quickSend(id) {
    const r = recipients.find(x => x.id === id);
    if (!r) return;
    if (isSending) { toast('Already sending.', 'warning'); return; }
    if (sendMode === 'smtp' && !getSmtpSettings()) { 
        toast('Set up SMTP settings first.', 'error'); switchTab('smtp-settings'); return; 
    }
    if (sendMode === 'api' && !getApiSettings()) { 
        toast('Set up API settings first.', 'error'); switchTab('api-settings'); return; 
    }
    isSending = true;
    const ok = await sendOneRecipient(r);
    isSending = false;
    toast(ok ? `Sent to ${r.email}!` : `Failed: ${r.email}`, ok ? 'success' : 'error');
    updateStatusStats();
}

function copyPreview() {
    const pre = document.getElementById('apiPreview');
    if (!pre) return;
    navigator.clipboard.writeText(pre.innerText || pre.textContent).then(() => toast('Copied!', 'success'));
}

// ── Logs ─────────────────────────────────────────
function addLog(id, name, email, mode, status, response) {
    sendLogs.unshift({ id, time: new Date().toLocaleString(), name, email, mode, status, response });
    saveLogs();
    renderLogs();
    updateStatusStats();
}

function updateLog(id, status, response) {
    const l = sendLogs.find(x => x.id === id);
    if (l) { l.status = status; l.response = response; saveLogs(); renderLogs(); updateStatusStats(); }
}

function renderLogs(filter) {
    const tbody = document.getElementById('logsTableBody');
    const empty = document.getElementById('noLogs');
    const table = document.getElementById('logsTable');
    if (!tbody) return;

    const f = filter !== undefined ? filter : (document.getElementById('logFilter')?.value || 'all');
    const list = f === 'all' ? sendLogs : sendLogs.filter(l => l.status === f);

    if (list.length === 0) {
        tbody.innerHTML = '';
        if (empty) empty.style.display = 'flex';
        if (table) table.style.display = 'none';
        return;
    }
    if (empty) empty.style.display = 'none';
    if (table) table.style.display = '';

    tbody.innerHTML = list.map(l => `
        <tr>
            <td style="white-space:nowrap;font-size:0.75rem;">${l.time}</td>
            <td>${escHtml(l.name || '—')}</td>
            <td style="color:var(--indigo-600);font-weight:500;">${escHtml(l.email)}</td>
            <td><span class="mode-badge ${l.mode || 'api'}">${(l.mode || 'API').toUpperCase()}</span></td>
            <td><span class="status-badge ${l.status}">${cap(l.status)}</span></td>
            <td><span class="response-detail" title="${escAttr(l.response)}">${escHtml(l.response)}</span></td>
        </tr>
    `).join('');
}

function filterLogs(val) {
    const sel = document.getElementById('logFilter');
    if (sel) sel.value = val;
    renderLogs(val);
    if (!document.getElementById('panel-logs').classList.contains('active')) switchTab('logs');
}

function clearLogs() {
    if (!confirm('Clear all logs?')) return;
    sendLogs = [];
    saveLogs();
    renderLogs();
    updateStatusStats();
    toast('Logs cleared.', 'info');
}

function exportLogs() {
    if (sendLogs.length === 0) { toast('No logs to export.', 'warning'); return; }
    const rows = [
        ['Time','Name','Email','Mode','Status','Response'],
        ...sendLogs.map(l => [l.time, l.name, l.email, l.mode, l.status, `"${l.response}"`])
    ];
    downloadCSV(rows, `msg91_logs_${new Date().toISOString().slice(0,10)}.csv`);
    toast('Logs exported.', 'success');
}

function saveLogs()  { localStorage.setItem('msg91_logs',       JSON.stringify(sendLogs)); }
function loadLogs()  { sendLogs = safeParse(localStorage.getItem('msg91_logs')) || []; }

function updateStatusStats() {
    const total   = sendLogs.length;
    const success = sendLogs.filter(l => l.status === 'success').length;
    const failed  = sendLogs.filter(l => l.status === 'failed').length;
    const pending = sendLogs.filter(l => l.status === 'pending').length;
    setTxt('statTotal',   total);
    setTxt('statSuccess', success);
    setTxt('statFailed',  failed);
    setTxt('statPending', pending);
    const badge = document.getElementById('failedBadge');
    if (badge) {
        badge.textContent = failed;
        badge.classList.toggle('hidden', failed === 0);
    }
}

// ── Modals ────────────────────────────────────────
function openModal(id)  { const m = document.getElementById(id); if (m) m.classList.remove('hidden'); }
function closeModal(id) { const m = document.getElementById(id); if (m) m.classList.add('hidden'); }

// Close modal on overlay click
document.addEventListener('click', e => {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        if (e.target === overlay) overlay.classList.add('hidden');
    });
});

// ── Utilities ─────────────────────────────────────
function getVal(id)       { const el = document.getElementById(id); return el ? el.value : ''; }
function setVal(id, v)    { const el = document.getElementById(id); if (el) el.value = v; }
function setTxt(id, v)    { const el = document.getElementById(id); if (el) el.textContent = v; }
function genId()          { return Date.now().toString(36) + Math.random().toString(36).substr(2,6); }
function safeParse(s)     { try { return s ? JSON.parse(s) : null; } catch { return null; } }
function isEmail(s)       { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
function sleep(ms)        { return new Promise(r => setTimeout(r, ms)); }
function cap(s)           { if (!s) return ''; return s.charAt(0).toUpperCase() + s.slice(1); }
function fmtDate(iso)     { try { return new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }); } catch { return iso; } }

function escHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
}

function escAttr(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
}

function injectVars(str, vars) {
    if (!str) return str;
    let r = str;
    Object.entries(vars).forEach(([k, v]) => {
        r = r.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'gi'), v || '');
    });
    return r;
}

function setBtnState(id, disabled, label) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = disabled;
    if (disabled) {
        btn.setAttribute('data-orig', btn.innerHTML);
        btn.innerHTML = `<span class="spinner"></span> ${label}`;
    } else {
        btn.innerHTML = btn.getAttribute('data-orig') || label;
    }
}

function syntaxHL(json) {
    return json
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?/g, match => {
            const cls = /:$/.test(match) ? '#a5b4fc' : '#86efac'; // keys vs strings
            return `<span style="color:${cls}">${match}</span>`;
        });
}

function downloadCSV(rows, filename) {
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}
