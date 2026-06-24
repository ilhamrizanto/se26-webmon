const SPREADSHEET_ID = "1a0t9gkPRg7DfDOXg2Rrl95byK8bKrfiikMfObgRfjBY";
const SHEET_DB_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=DB`;
const SHEET_NAMA_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Nama`;
const SHEET_SLS_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=SLS`;
const SHEET_KORWIL_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Korwil`;

// Global Data State
let rawDataDB = [];
let rawNamaData = [];
let rawSlsData = [];
let rawKorwilData = [];

let slsAssignments = []; // Unified data array
let petugasData = {};     // Aggregate by email
let pmlData = {};         // Aggregate by PML name
let kosekaData = {};       // Aggregate by Koseka name
let kecamatanData = {};   // Aggregate by Kecamatan name

// DOM Elements
const elLoader = document.getElementById('loader');
const elAppContent = document.getElementById('app-content');
const elLastSync = document.getElementById('last-sync');

document.addEventListener("DOMContentLoaded", () => {
    initApp();
    setupNavigation();
    setupSearch();
    setupFilters();
    setupModal();
    
    document.getElementById('btn-refresh').addEventListener('click', () => {
        elAppContent.style.display = 'none';
        elLoader.style.display = 'flex';
        initApp();
    });
});

function fetchCSV(url) {
    return new Promise((resolve, reject) => {
        Papa.parse(url, {
            download: true,
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: function(results) {
                resolve(results.data);
            },
            error: function(err) {
                reject(err);
            }
        });
    });
}

function cleanName(name) {
    if (!name) return "";
    return String(name).toLowerCase()
        .replace(/\(.*?\)/g, "") // Remove parentheses and contents, e.g. (406)
        .replace(/\d+/g, "")     // Remove numbers
        .replace(/[^a-zA-Z\s]/g, "") // Remove special characters like =
        .replace(/\s+/g, " ")    // Collapse spaces
        .trim();
}

function initApp() {
    Promise.all([
        fetchCSV(SHEET_DB_URL),
        fetchCSV(SHEET_NAMA_URL),
        fetchCSV(SHEET_SLS_URL),
        fetchCSV(SHEET_KORWIL_URL)
    ]).then(([dbData, namaData, slsDataRaw, korwilData]) => {
        rawDataDB = dbData;
        rawNamaData = namaData;
        rawSlsData = slsDataRaw;
        rawKorwilData = korwilData;
        
        processAllData();
        updateDashboard();
        renderKorwilTable();
        renderPetugasTable();
        renderSlsTable();
        populateFilterDropdowns();
        renderHierarchyView();
        
        // Hide loader, show app
        elLoader.style.display = 'none';
        elAppContent.style.display = 'flex';
        elLastSync.innerText = new Date().toLocaleString('id-ID');
    }).catch(err => {
        console.error("Error loading data:", err);
        elLoader.innerHTML = `
            <div style="color:var(--accent-rose); padding: 30px; text-align:center;">
                <h2>Gagal Memuat Data</h2>
                <p style="margin-top:10px; color:var(--text-muted);">${err.message || err}</p>
                <p style="margin-top:5px; color:var(--text-dim);">Pastikan spreadsheet Anda telah dipublikasikan ke web (File > Share > Publish to web) dan linknya benar.</p>
                <button onclick="location.reload()" style="margin-top:15px; padding:8px 16px; border-radius:8px; border:none; background:#8b5cf6; color:white; cursor:pointer;">Coba Lagi</button>
            </div>
        `;
    });
}

function processAllData() {
    // 1. Build maps for lookups
    const emailToNama = {};
    rawNamaData.forEach(row => {
        const email = row['Email'] ? row['Email'].trim().toLowerCase() : '';
        const name = row['Nama Lengkap'] ? row['Nama Lengkap'].trim() : '';
        if (email) {
            emailToNama[email] = name;
        }
    });

    const pplToKorwil = {};
    rawKorwilData.forEach(row => {
        const ppl = row['PPL'] ? row['PPL'].trim() : '';
        const pml = row['PML'] ? row['PML'].trim() : 'Belum Terpetakan';
        const koseka = row['Koordinator Kecamatan'] ? row['Koordinator Kecamatan'].trim() : 'Belum Terpetakan';
        if (ppl) {
            pplToKorwil[cleanName(ppl)] = { pml, koseka };
        }
    });

    const slsLookup = {};
    rawSlsData.forEach(row => {
        const id = row['idsubsls'] ? String(row['idsubsls']).split('.')[0].trim() : '';
        if (id) {
            slsLookup[id] = {
                nmsls: row['nmsls'] || 'RT ...',
                nama_ketua: row['nama_ketua'] || 'N/A',
                jenis: row['jenis'] || 'SLS',
                nmkec: row['nmkec'] || 'Belum Terpetakan',
                nmdesa: row['nmdesa'] || 'Belum Terpetakan'
            };
        }
    });

    // 2. Build unified array
    slsAssignments = [];
    rawDataDB.forEach(row => {
        const email = row['Email Petugas'] ? row['Email Petugas'].trim().toLowerCase() : '';
        if (!email) return;

        const slsIdRaw = row['Nama SLS'] ? String(row['Nama SLS']).split('.')[0].trim() : '';

        const open = parseInt(row['OPEN']) || 0;
        const draft = parseInt(row['DRAFT']) || 0;
        const submitted = parseInt(row['SUBMITTED BY PENCACAH']) || 0;
        const approved = parseInt(row['APPROVED BY PENGAWAS']) || 0;
        const rejected = parseInt(row['REJECTED BY PENGAWAS']) || 0;
        const revoked = parseInt(row['REVOKED BY PENGAWAS']) || 0;
        const total = open + draft + submitted + approved + rejected + revoked;

        // Mappings
        const namaLengkap = emailToNama[email] || email;
        const cleanPpl = cleanName(namaLengkap);
        
        let pml = 'Belum Terpetakan';
        let koseka = 'Belum Terpetakan';
        
        if (pplToKorwil[cleanPpl]) {
            pml = pplToKorwil[cleanPpl].pml;
            koseka = pplToKorwil[cleanPpl].koseka;
        } else {
            // Fuzzy search as fallback (e.g. if names differ slightly)
            const cleanPplWords = cleanPpl.split(' ');
            for (const key in pplToKorwil) {
                const keyWords = key.split(' ');
                // Check if names overlap significantly (e.g., share 2 words)
                const intersection = cleanPplWords.filter(w => keyWords.includes(w));
                if (intersection.length >= 2) {
                    pml = pplToKorwil[key].pml;
                    koseka = pplToKorwil[key].koseka;
                    break;
                }
            }
        }

        const sls = slsLookup[slsIdRaw] || {
            nmsls: `RT ... (${slsIdRaw})`,
            nama_ketua: 'N/A',
            jenis: 'SLS',
            nmkec: 'Belum Terpetakan',
            nmdesa: 'Belum Terpetakan'
        };

        slsAssignments.push({
            slsId: slsIdRaw,
            nmsls: sls.nmsls,
            namaKetua: sls.nama_ketua,
            jenis: sls.jenis,
            desa: sls.nmdesa,
            kecamatan: sls.nmkec,
            email: email,
            namaLengkap: namaLengkap,
            koseka: koseka,
            pml: pml,
            open, draft, submitted, approved, rejected, revoked,
            total
        });
    });

    // 3. Reset Aggregates
    petugasData = {};
    pmlData = {};
    kosekaData = {};
    kecamatanData = {};

    // 4. Calculate Aggregates
    slsAssignments.forEach(item => {
        // Petugas Aggregate
        if (!petugasData[item.email]) {
            petugasData[item.email] = {
                email: item.email,
                namaLengkap: item.namaLengkap,
                koseka: item.koseka,
                pml: item.pml,
                totalTarget: 0,
                open: 0, draft: 0, submitted: 0, approved: 0, rejected: 0, revoked: 0,
                slsList: []
            };
        }
        const p = petugasData[item.email];
        p.totalTarget += item.total;
        p.open += item.open;
        p.draft += item.draft;
        p.submitted += item.submitted;
        p.approved += item.approved;
        p.rejected += item.rejected;
        p.revoked += item.revoked;
        p.slsList.push(item);

        // PML Aggregate
        const pmlKey = item.pml;
        if (!pmlData[pmlKey]) {
            pmlData[pmlKey] = {
                pml: pmlKey,
                koseka: item.koseka,
                totalTarget: 0,
                open: 0, draft: 0, submitted: 0, approved: 0, rejected: 0, revoked: 0,
                pcls: new Set(),
                slsCount: 0
            };
        }
        const pm = pmlData[pmlKey];
        pm.totalTarget += item.total;
        pm.open += item.open;
        pm.draft += item.draft;
        pm.submitted += item.submitted;
        pm.approved += item.approved;
        pm.rejected += item.rejected;
        pm.revoked += item.revoked;
        pm.pcls.add(item.email);
        pm.slsCount++;

        // Koseka Aggregate
        const kosekaKey = item.koseka;
        if (!kosekaData[kosekaKey]) {
            kosekaData[kosekaKey] = {
                koseka: kosekaKey,
                totalTarget: 0,
                open: 0, draft: 0, submitted: 0, approved: 0, rejected: 0, revoked: 0,
                pmls: new Set(),
                pcls: new Set(),
                slsCount: 0
            };
        }
        const ks = kosekaData[kosekaKey];
        ks.totalTarget += item.total;
        ks.open += item.open;
        ks.draft += item.draft;
        ks.submitted += item.submitted;
        ks.approved += item.approved;
        ks.rejected += item.rejected;
        ks.revoked += item.revoked;
        ks.pmls.add(item.pml);
        ks.pcls.add(item.email);
        ks.slsCount++;

        // Kecamatan Aggregate
        const kecKey = item.kecamatan;
        if (!kecamatanData[kecKey]) {
            kecamatanData[kecKey] = {
                kecamatan: kecKey,
                totalTarget: 0,
                open: 0, draft: 0, submitted: 0, approved: 0, rejected: 0, revoked: 0,
                slsCount: 0
            };
        }
        const kc = kecamatanData[kecKey];
        kc.totalTarget += item.total;
        kc.open += item.open;
        kc.draft += item.draft;
        kc.submitted += item.submitted;
        kc.approved += item.approved;
        kc.rejected += item.rejected;
        kc.revoked += item.revoked;
        kc.slsCount++;
    });
}

let statusChartInst = null;
let topPetugasChartInst = null;

function updateDashboard() {
    let globalTarget = 0;
    let gOpen = 0, gDraft = 0, gSub = 0, gApp = 0, gRej = 0, gRev = 0;

    for (const email in petugasData) {
        const p = petugasData[email];
        globalTarget += p.totalTarget;
        gOpen += p.open;
        gDraft += p.draft;
        gSub += p.submitted;
        gApp += p.approved;
        gRej += p.rejected;
        gRev += p.revoked;
    }

    // Populate overview numbers with animation
    animateValue("kpi-assignment", 0, globalTarget, 1000);
    animateValue("kpi-open", 0, gOpen, 1000);
    animateValue("kpi-draft", 0, gDraft, 1000);
    animateValue("kpi-submitted", 0, gSub, 1000);
    animateValue("kpi-approved", 0, gApp, 1000);
    animateValue("kpi-rejected", 0, gRej, 1000);
    animateValue("kpi-revoked", 0, gRev, 1000);

    // Calculate and animate Assignment Tersubmit percentage (excluding Open & Draft)
    const tersubmitCount = globalTarget - gOpen - gDraft;
    const completionPct = globalTarget > 0 ? ((tersubmitCount / globalTarget) * 100).toFixed(1) : 0;
    animateValuePercent("kpi-completion-percentage", 0, parseFloat(completionPct), 1000);
    
    const elFill = document.getElementById("kpi-progress-fill");
    if (elFill) {
        setTimeout(() => {
            elFill.style.width = completionPct + '%';
        }, 100);
    }

    // Render Charts
    Chart.defaults.color = '#a1a1aa';
    Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif";

    // Update Horizontal Stacked Bar Chart
    if (globalTarget > 0) {
        document.getElementById('bar-approved').style.width = ((gApp / globalTarget) * 100) + '%';
        document.getElementById('bar-submitted').style.width = ((gSub / globalTarget) * 100) + '%';
        document.getElementById('bar-open').style.width = ((gOpen / globalTarget) * 100) + '%';
        document.getElementById('bar-draft').style.width = ((gDraft / globalTarget) * 100) + '%';
        document.getElementById('bar-rejected').style.width = ((gRej / globalTarget) * 100) + '%';
        document.getElementById('bar-revoked').style.width = ((gRev / globalTarget) * 100) + '%';
    } else {
        document.querySelectorAll('.stacked-segment').forEach(el => el.style.width = '0%');
    }

    // Bar Chart top performers (Approved)
    const petugasArray = Object.values(petugasData);
    petugasArray.sort((a, b) => b.approved - a.approved);
    const top5 = petugasArray.slice(0, 5);

    const ctxTop = document.getElementById('topPetugasChart').getContext('2d');
    if (topPetugasChartInst) topPetugasChartInst.destroy();
    
    topPetugasChartInst = new Chart(ctxTop, {
        type: 'bar',
        data: {
            labels: top5.map(p => p.namaLengkap.length > 15 ? p.namaLengkap.slice(0,13) + '..' : p.namaLengkap),
            datasets: [
                {
                    label: 'Approved',
                    data: top5.map(p => p.approved),
                    backgroundColor: '#10b981',
                    borderRadius: 4
                },
                {
                    label: 'Remaining (Open/Draft/Sub)',
                    data: top5.map(p => p.open + p.draft + p.submitted),
                    backgroundColor: '#0284c7',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });
}

function renderKorwilTable() {
    const tbody = document.querySelector('#table-korwil tbody');
    tbody.innerHTML = '';

    // Sort Koseka, then PML
    const rows = [];
    for (const pmlKey in pmlData) {
        rows.push(pmlData[pmlKey]);
    }
    rows.sort((a, b) => {
        if (a.koseka !== b.koseka) return a.koseka.localeCompare(b.koseka);
        return a.pml.localeCompare(b.pml);
    });

    rows.forEach(item => {
        const pct = item.totalTarget > 0 ? ((item.approved / item.totalTarget) * 100).toFixed(1) : 0;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${item.koseka}</strong></td>
            <td><strong>${item.pml}</strong></td>
            <td>${item.pcls.size}</td>
            <td>${item.slsCount}</td>
            <td>${item.totalTarget}</td>
            <td><span class="badge-dot open"></span> ${item.open}</td>
            <td><span class="badge-dot draft"></span> ${item.draft}</td>
            <td><span class="badge-dot submitted"></span> ${item.submitted}</td>
            <td><span class="badge-dot approved"></span> ${item.approved}</td>
            <td>
                <div style="display:flex; align-items:center; gap:8px;">
                    <div class="progress-bar-thin" style="width:60px; margin:0;"><div class="progress-fill-thin" style="background:var(--accent-emerald); width:${pct}%"></div></div>
                    <span style="font-size:11px">${pct}%</span>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderPetugasTable() {
    const tbody = document.querySelector('#table-petugas tbody');
    tbody.innerHTML = '';

    const pList = Object.values(petugasData).sort((a, b) => b.totalTarget - a.totalTarget);

    pList.forEach(p => {
        const pct = p.totalTarget > 0 ? ((p.approved / p.totalTarget) * 100).toFixed(1) : 0;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${p.namaLengkap}</strong></td>
            <td>${p.email}</td>
            <td>${p.pml}</td>
            <td>${p.koseka}</td>
            <td>${p.totalTarget}</td>
            <td><span class="badge-dot open"></span> ${p.open}</td>
            <td><span class="badge-dot draft"></span> ${p.draft}</td>
            <td><span class="badge-dot submitted"></span> ${p.submitted}</td>
            <td><span class="badge-dot approved"></span> ${p.approved}</td>
            <td><span class="badge-dot rejected"></span> ${p.rejected}</td>
            <td><span class="badge-dot revoked"></span> ${p.revoked}</td>
            <td>
                <div style="display:flex; align-items:center; gap:8px;">
                    <div class="progress-bar-thin" style="width:60px; margin:0;"><div class="progress-fill-thin" style="background:var(--accent-emerald); width:${pct}%"></div></div>
                    <span style="font-size:11px">${pct}%</span>
                </div>
            </td>
        `;
        
        // Add click listener for drill-down modal
        tr.addEventListener('click', () => {
            showPetugasModal(p.email);
        });
        
        tbody.appendChild(tr);
    });
}

function getSlsStatus(item) {
    if (item.approved === item.total && item.total > 0) return 'APPROVED';
    if (item.open === item.total) return 'OPEN';
    return 'PROGRESS';
}

function getSlsStatusHTML(status) {
    if (status === 'APPROVED') return `<span class="badge-status approved">APPROVED</span>`;
    if (status === 'OPEN') return `<span class="badge-status open">OPEN</span>`;
    return `<span class="badge-status progress">IN PROGRESS</span>`;
}

function renderSlsTable() {
    const tbody = document.querySelector('#table-sls tbody');
    tbody.innerHTML = '';

    const filterKec = document.getElementById('filter-kecamatan').value;
    const filterDesa = document.getElementById('filter-desa').value;
    const filterStat = document.getElementById('filter-status').value;
    const filterPml = document.getElementById('filter-pml').value;
    const filterKoseka = document.getElementById('filter-koseka').value;
    const searchVal = document.getElementById('global-search').value.toLowerCase();

    slsAssignments.forEach(s => {
        const slsStatus = getSlsStatus(s);

        // Apply filters
        if (filterKec && s.kecamatan !== filterKec) return;
        if (filterDesa && s.desa !== filterDesa) return;
        if (filterStat && slsStatus !== filterStat) return;
        if (filterPml && s.pml !== filterPml) return;
        if (filterKoseka && s.koseka !== filterKoseka) return;

        // Apply search
        if (searchVal) {
            const matches = s.slsId.toLowerCase().includes(searchVal) ||
                            s.nmsls.toLowerCase().includes(searchVal) ||
                            s.namaLengkap.toLowerCase().includes(searchVal) ||
                            s.email.toLowerCase().includes(searchVal) ||
                            s.desa.toLowerCase().includes(searchVal) ||
                            s.kecamatan.toLowerCase().includes(searchVal);
            if (!matches) return;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${s.slsId}</strong></td>
            <td>${s.nmsls}</td>
            <td>${s.namaKetua}</td>
            <td>${s.desa}</td>
            <td>${s.kecamatan}</td>
            <td>${s.namaLengkap}</td>
            <td>${s.pml}</td>
            <td>${s.koseka}</td>
            <td>${s.total}</td>
            <td>${s.open}</td>
            <td>${s.draft}</td>
            <td>${s.submitted}</td>
            <td>${s.approved}</td>
            <td>${getSlsStatusHTML(slsStatus)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function populateFilterDropdowns() {
    const kecamations = new Set();
    const pmls = new Set();
    const kosekas = new Set();

    slsAssignments.forEach(s => {
        if (s.kecamatan) kecamations.add(s.kecamatan);
        if (s.pml) pmls.add(s.pml);
        if (s.koseka) kosekas.add(s.koseka);
    });

    populateSelect('filter-kecamatan', Array.from(kecamations).sort(), "Semua Kecamatan");
    populateSelect('filter-pml', Array.from(pmls).sort(), "Semua PML");
    populateSelect('filter-koseka', Array.from(kosekas).sort(), "Semua Koseka");

    // Dynamic Desa dropdown based on selected Kecamatan
    updateDesaDropdown();
}

function updateDesaDropdown() {
    const selectedKec = document.getElementById('filter-kecamatan').value;
    const desas = new Set();

    slsAssignments.forEach(s => {
        if (selectedKec && s.kecamatan !== selectedKec) return;
        if (s.desa) desas.add(s.desa);
    });

    populateSelect('filter-desa', Array.from(desas).sort(), "Semua Desa");
}

function populateSelect(id, list, placeholder) {
    const select = document.getElementById(id);
    const currentValue = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>`;
    list.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item;
        opt.textContent = item;
        if (item === currentValue) opt.selected = true;
        select.appendChild(opt);
    });
}

function setupFilters() {
    const filters = ['filter-kecamatan', 'filter-desa', 'filter-status', 'filter-pml', 'filter-koseka'];
    
    filters.forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            if (id === 'filter-kecamatan') {
                updateDesaDropdown();
            }
            renderSlsTable();
        });
    });

    document.getElementById('btn-reset-filters').addEventListener('click', () => {
        filters.forEach(id => {
            document.getElementById(id).value = '';
        });
        updateDesaDropdown();
        renderSlsTable();
    });
}

function setupModal() {
    const modal = document.getElementById('petugas-modal');
    const closeBtn = document.getElementById('modal-close-btn');
    
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

function showPetugasModal(email) {
    const p = petugasData[email];
    if (!p) return;

    document.getElementById('modal-petugas-name').innerText = p.namaLengkap;
    document.getElementById('modal-petugas-email').innerText = p.email;
    document.getElementById('modal-petugas-koseka').innerText = p.koseka;
    document.getElementById('modal-petugas-pml').innerText = p.pml;
    document.getElementById('modal-petugas-target').innerText = p.totalTarget;

    const tbody = document.querySelector('#table-modal-sls tbody');
    tbody.innerHTML = '';

    p.slsList.forEach(s => {
        const slsStatus = getSlsStatus(s);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${s.slsId}</strong></td>
            <td>${s.nmsls}</td>
            <td>${s.desa}</td>
            <td>${s.kecamatan}</td>
            <td>${s.total}</td>
            <td>${s.open}</td>
            <td>${s.draft}</td>
            <td>${s.submitted}</td>
            <td>${s.approved}</td>
            <td>${getSlsStatusHTML(slsStatus)}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('petugas-modal').style.display = 'flex';
}

function setupNavigation() {
    const links = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view-section');

    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');
            
            links.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            views.forEach(v => v.classList.remove('active'));
            document.getElementById(`view-${targetId}`).classList.add('active');
        });
    });
}

function setupSearch() {
    document.getElementById('global-search').addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        
        // Filter Petugas
        const trsP = document.querySelectorAll('#table-petugas tbody tr');
        trsP.forEach(tr => {
            const text = tr.innerText.toLowerCase();
            tr.style.display = text.includes(val) ? '' : 'none';
        });

        // Filter Korwil
        const trsK = document.querySelectorAll('#table-korwil tbody tr');
        trsK.forEach(tr => {
            const text = tr.innerText.toLowerCase();
            tr.style.display = text.includes(val) ? '' : 'none';
        });

        // Filter SLS
        renderSlsTable();
    });
}

// Utility: Number Animation
function animateValue(id, start, end, duration) {
    let obj = document.getElementById(id);
    if (!obj) return;
    if (start === end) {
        obj.innerHTML = end.toLocaleString('id-ID');
        return;
    }
    
    let startTime = null;
    
    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        let progress = Math.min((timestamp - startTime) / duration, 1);
        let easeOut = 1 - Math.pow(1 - progress, 3);
        let current = Math.floor(easeOut * (end - start) + start);
        
        obj.innerHTML = current.toLocaleString('id-ID');
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = end.toLocaleString('id-ID');
        }
    }
    window.requestAnimationFrame(step);
}

function animateValuePercent(id, start, end, duration) {
    let obj = document.getElementById(id);
    if (!obj) return;
    if (start === end) {
        obj.innerHTML = end + '%';
        return;
    }
    
    let startTime = null;
    
    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        let progress = Math.min((timestamp - startTime) / duration, 1);
        let easeOut = 1 - Math.pow(1 - progress, 3);
        let current = (easeOut * (end - start) + start).toFixed(1);
        
        obj.innerHTML = current + '%';
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = end.toFixed(1) + '%';
        }
    }
    window.requestAnimationFrame(step);
}

/* ==========================================================================
   Hierarchy Explorer Implementation
   ========================================================================== */
function renderHierarchyView() {
    const listKoseka = document.getElementById('list-koseka');
    if (!listKoseka) return;

    listKoseka.innerHTML = '';
    
    // Clear next columns
    document.getElementById('list-pml').innerHTML = `
        <div class="empty-column-state">
            <i class="ri-arrow-left-line"></i>
            <p>Pilih Koseka terlebih dahulu</p>
        </div>
    `;
    document.getElementById('list-pcl').innerHTML = `
        <div class="empty-column-state">
            <i class="ri-arrow-left-line"></i>
            <p>Pilih PML terlebih dahulu</p>
        </div>
    `;
    document.getElementById('detail-pcl-body').innerHTML = `
        <div class="empty-column-state">
            <i class="ri-information-line"></i>
            <p>Pilih PCL untuk melihat detail kinerja</p>
        </div>
    `;

    document.getElementById('count-koseka').innerText = '0';
    document.getElementById('count-pml').innerText = '0';
    document.getElementById('count-pcl').innerText = '0';

    const kosekaKeys = Object.keys(kosekaData).sort();
    document.getElementById('count-koseka').innerText = kosekaKeys.length;

    kosekaKeys.forEach(koseka => {
        const data = kosekaData[koseka];
        const total = data.totalTarget || 0;
        const progressVal = total > 0 ? ((data.approved + data.submitted) / total * 100).toFixed(1) : "0.0";
        
        const card = document.createElement('div');
        card.className = 'hierarchy-card glass-panel-inner';
        card.innerHTML = `
            <div class="hierarchy-card-header">
                <span class="hierarchy-card-title" title="${koseka}">${koseka}</span>
                <span class="hierarchy-progress-percent">${progressVal}%</span>
            </div>
            <div class="hierarchy-progress-wrapper">
                <div class="hierarchy-progress-bar">
                    <div class="hierarchy-progress-fill" style="width: ${progressVal}%;"></div>
                </div>
            </div>
            <div class="hierarchy-card-meta">
                <span>${data.pmls.size} PML</span>
                <span>${data.slsCount} SLS</span>
            </div>
        `;
        
        card.addEventListener('click', () => {
            // Set active class
            document.querySelectorAll('#list-koseka .hierarchy-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            renderPmlList(koseka);
        });
        
        listKoseka.appendChild(card);
    });
}

function renderPmlList(kosekaName) {
    const listPml = document.getElementById('list-pml');
    listPml.innerHTML = '';
    
    // Clear next columns
    document.getElementById('list-pcl').innerHTML = `
        <div class="empty-column-state">
            <i class="ri-arrow-left-line"></i>
            <p>Pilih PML terlebih dahulu</p>
        </div>
    `;
    document.getElementById('detail-pcl-body').innerHTML = `
        <div class="empty-column-state">
            <i class="ri-information-line"></i>
            <p>Pilih PCL untuk melihat detail kinerja</p>
        </div>
    `;

    document.getElementById('count-pml').innerText = '0';
    document.getElementById('count-pcl').innerText = '0';

    const pmlsForKoseka = Array.from(kosekaData[kosekaName].pmls).sort();
    document.getElementById('count-pml').innerText = pmlsForKoseka.length;

    pmlsForKoseka.forEach(pml => {
        const data = pmlData[pml] || { totalTarget: 0, open: 0, draft: 0, submitted: 0, approved: 0, rejected: 0, revoked: 0, pcls: new Set(), slsCount: 0 };
        const total = data.totalTarget || 0;
        const progressVal = total > 0 ? ((data.approved + data.submitted) / total * 100).toFixed(1) : "0.0";

        const card = document.createElement('div');
        card.className = 'hierarchy-card glass-panel-inner';
        card.innerHTML = `
            <div class="hierarchy-card-header">
                <span class="hierarchy-card-title" title="${pml}">${pml}</span>
                <span class="hierarchy-progress-percent">${progressVal}%</span>
            </div>
            <div class="hierarchy-progress-wrapper">
                <div class="hierarchy-progress-bar">
                    <div class="hierarchy-progress-fill" style="width: ${progressVal}%;"></div>
                </div>
            </div>
            <div class="hierarchy-card-meta">
                <span>${data.pcls.size} PCL</span>
                <span>${data.slsCount} SLS</span>
            </div>
        `;

        card.addEventListener('click', () => {
            // Set active class
            document.querySelectorAll('#list-pml .hierarchy-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');

            renderPclList(pml);
        });

        listPml.appendChild(card);
    });
}

function renderPclList(pmlName) {
    const listPcl = document.getElementById('list-pcl');
    listPcl.innerHTML = '';

    document.getElementById('detail-pcl-body').innerHTML = `
        <div class="empty-column-state">
            <i class="ri-information-line"></i>
            <p>Pilih PCL untuk melihat detail kinerja</p>
        </div>
    `;

    document.getElementById('count-pcl').innerText = '0';

    const pclsForPml = Array.from(pmlData[pmlName].pcls).sort();
    document.getElementById('count-pcl').innerText = pclsForPml.length;

    pclsForPml.forEach(email => {
        const data = petugasData[email];
        if (!data) return;

        const total = data.totalTarget || 0;
        const progressVal = total > 0 ? ((data.approved + data.submitted) / total * 100).toFixed(1) : "0.0";

        const card = document.createElement('div');
        card.className = 'hierarchy-card glass-panel-inner';
        card.innerHTML = `
            <div class="hierarchy-card-header">
                <span class="hierarchy-card-title" title="${data.namaLengkap}">${data.namaLengkap}</span>
                <span class="hierarchy-progress-percent">${progressVal}%</span>
            </div>
            <div class="hierarchy-progress-wrapper">
                <div class="hierarchy-progress-bar">
                    <div class="hierarchy-progress-fill" style="width: ${progressVal}%;"></div>
                </div>
            </div>
            <div class="hierarchy-card-meta">
                <span style="font-size: 8.5px; opacity:0.8; text-overflow:ellipsis; overflow:hidden;" title="${email}">${email}</span>
            </div>
        `;

        card.addEventListener('click', () => {
            // Set active class
            document.querySelectorAll('#list-pcl .hierarchy-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');

            renderPclDetail(email);
        });

        listPcl.appendChild(card);
    });
}

function renderPclDetail(email) {
    const data = petugasData[email];
    const detailBody = document.getElementById('detail-pcl-body');
    if (!data || !detailBody) return;

    const total = data.totalTarget || 0;
    const progressVal = total > 0 ? ((data.approved + data.submitted) / total * 100).toFixed(1) : "0.0";

    detailBody.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px;">
            <!-- Header Info -->
            <div style="border-bottom:1px solid var(--border-glass); padding-bottom:8px;">
                <h2 style="font-family:'Outfit'; font-size:16px; font-weight:700; color:var(--text-title);">${data.namaLengkap}</h2>
                <p style="font-size:11px; color:var(--text-muted); margin-top:2px;">${email}</p>
            </div>

            <!-- Stats Grid -->
            <div class="detail-stats-grid">
                <div class="detail-stat-card glass-panel-inner">
                    <span class="label">Koseka</span>
                    <strong class="value" title="${data.koseka}">${data.koseka}</strong>
                </div>
                <div class="detail-stat-card glass-panel-inner">
                    <span class="label">PML</span>
                    <strong class="value" title="${data.pml}">${data.pml}</strong>
                </div>
                <div class="detail-stat-card glass-panel-inner" style="grid-column: span 2;">
                    <span class="label">Penyelesaian Muatan</span>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                        <strong class="value">${data.approved + data.submitted} / ${total} Target</strong>
                        <span class="hierarchy-progress-percent" style="font-size:14px;">${progressVal}%</span>
                    </div>
                    <div class="hierarchy-progress-bar" style="margin-top:6px; height:6px;">
                        <div class="hierarchy-progress-fill" style="width: ${progressVal}%;"></div>
                    </div>
                </div>
            </div>

            <!-- Status Distribution Breakdown -->
            <div class="detail-stats-grid" style="grid-template-columns: repeat(3, 1fr); gap:6px;">
                <div class="detail-stat-card glass-panel-inner" style="border-left: 2px solid var(--color-open); padding: 6px;">
                    <span class="label" style="font-size:8px;">Open</span>
                    <strong class="value" style="font-size:12px; color:var(--color-open);">${data.open} <span style="font-size:10px; opacity:0.8; font-weight:normal;">(${total > 0 ? (data.open/total*100).toFixed(1) : "0.0"}%)</span></strong>
                </div>
                <div class="detail-stat-card glass-panel-inner" style="border-left: 2px solid var(--color-draft); padding: 6px;">
                    <span class="label" style="font-size:8px;">Draft</span>
                    <strong class="value" style="font-size:12px; color:var(--color-draft);">${data.draft} <span style="font-size:10px; opacity:0.8; font-weight:normal;">(${total > 0 ? (data.draft/total*100).toFixed(1) : "0.0"}%)</span></strong>
                </div>
                <div class="detail-stat-card glass-panel-inner" style="border-left: 2px solid var(--color-submitted); padding: 6px;">
                    <span class="label" style="font-size:8px;">Submitted</span>
                    <strong class="value" style="font-size:12px; color:var(--color-submitted);">${data.submitted} <span style="font-size:10px; opacity:0.8; font-weight:normal;">(${total > 0 ? (data.submitted/total*100).toFixed(1) : "0.0"}%)</span></strong>
                </div>
                <div class="detail-stat-card glass-panel-inner" style="border-left: 2px solid var(--color-rejected); padding: 6px;">
                    <span class="label" style="font-size:8px;">Rejected</span>
                    <strong class="value" style="font-size:12px; color:var(--color-rejected);">${data.rejected} <span style="font-size:10px; opacity:0.8; font-weight:normal;">(${total > 0 ? (data.rejected/total*100).toFixed(1) : "0.0"}%)</span></strong>
                </div>
                <div class="detail-stat-card glass-panel-inner" style="border-left: 2px solid var(--color-revoked); padding: 6px;">
                    <span class="label" style="font-size:8px;">Revoked</span>
                    <strong class="value" style="font-size:12px; color:var(--color-revoked);">${data.revoked} <span style="font-size:10px; opacity:0.8; font-weight:normal;">(${total > 0 ? (data.revoked/total*100).toFixed(1) : "0.0"}%)</span></strong>
                </div>
                <div class="detail-stat-card glass-panel-inner" style="border-left: 2px solid var(--color-approved); padding: 6px;">
                    <span class="label" style="font-size:8px;">Approved</span>
                    <strong class="value" style="font-size:12px; color:var(--color-approved);">${data.approved} <span style="font-size:10px; opacity:0.8; font-weight:normal;">(${total > 0 ? (data.approved/total*100).toFixed(1) : "0.0"}%)</span></strong>
                </div>
            </div>

            <!-- Detailed List Section -->
            <div>
                <span class="detail-section-title"><i class="ri-list-check"></i> Detail Target Muatan</span>
                <div class="sls-list-container" id="detail-sls-list"></div>
            </div>
        </div>
    `;

    // Render List Cards
    const listContainer = document.getElementById('detail-sls-list');
    data.slsList.forEach((sls) => {
        const card = document.createElement('div');
        card.className = 'sls-detail-card glass-panel-inner';
        card.innerHTML = `
            <div class="sls-card-header">
                <div>
                    <div class="sls-card-title">${sls.nmsls}</div>
                    <div style="font-size: 9px; color: var(--text-dim); margin-top: 2px;">ID: ${sls.slsId}</div>
                </div>
            </div>
            <div class="sls-card-meta">
                <span><i class="ri-map-pin-line"></i> Kec. ${sls.kecamatan}, Desa ${sls.desa}</span>
                <span><i class="ri-user-line"></i> Ketua: ${sls.namaKetua}</span>
            </div>
            <div class="sls-card-stats">
                <span style="color: var(--color-open)">Op: ${sls.open}</span>
                <span style="color: var(--color-draft)">Dr: ${sls.draft}</span>
                <span style="color: var(--color-submitted)">Su: ${sls.submitted}</span>
                <span style="color: var(--color-rejected)">Rej: ${sls.rejected}</span>
                <span style="color: var(--color-revoked)">Rev: ${sls.revoked}</span>
                <span style="color: var(--color-approved)">Ap: ${sls.approved}</span>
            </div>
        `;
        listContainer.appendChild(card);
    });
}
