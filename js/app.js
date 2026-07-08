const SPREADSHEET_ID = "1a0t9gkPRg7DfDOXg2Rrl95byK8bKrfiikMfObgRfjBY";
const SHEET_DB_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=DB`;
const SHEET_NAMA_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Nama`;
const SHEET_SLS_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=SLS`;
const SHEET_KORWIL_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Korwil`;
const SHEET_ANOMALI_USAHA_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Master%20Usaha`;
const SHEET_ANOMALI_KELUARGA_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Master%20Keluarga`;

// Global Data State
let rawDataDB = [];
let rawNamaData = [];
let rawSlsData = [];
let rawKorwilData = [];
let rawAnomaliUsahaRows = [];
let rawAnomaliKeluargaRows = [];

let slsAssignments = []; // Unified data array
let sortPjDesc = true;
let sortPmlDesc = true;
let petugasData = {};     // Aggregate by email
let pmlData = {};         // Aggregate by PML name
let kosekaData = {};       // Aggregate by PJ Kecamatan name
let kecamatanData = {};   // Aggregate by Kecamatan name

// DOM Elements
const elLoader = document.getElementById('loader');
const elAppContent = document.getElementById('app-content');
const elLastSync = document.getElementById('last-sync');


function getHeatmapColor(val, min, max) {
    if (min === max) return 'rgba(255,255,255,0.2)';
    const ratio = (val - min) / (max - min);
    // Red to White to Green
    // 0 = Red (rgb 239 68 68), 0.5 = White (rgb 255 255 255), 1 = Green (rgb 34 197 94)
    // We'll use lighter colors for background: #fca5a5 (red), #ffffff, #86efac (green)
    let r, g, b;
    if (ratio < 0.5) {
        // Red to White
        const pct = ratio / 0.5;
        r = 252 + (255 - 252) * pct; // 252 -> 255
        g = 165 + (255 - 165) * pct; // 165 -> 255
        b = 165 + (255 - 165) * pct; // 165 -> 255
    } else {
        // White to Green
        const pct = (ratio - 0.5) / 0.5;
        r = 255 + (134 - 255) * pct; // 255 -> 134
        g = 255 + (239 - 255) * pct; // 255 -> 239
        b = 255 + (172 - 255) * pct; // 255 -> 172
    }
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, 0.85)`;
}

function getProgressBarColor(pct) {
    const clamped = Math.min(100, Math.max(0, pct));
    let h, s, l;
    if (clamped <= 50) {
        const p = clamped / 50;
        h = 0 + p * 35;     // Merah tua ke Oranye tua
        s = 85 + p * 5;     
        l = 42 - p * 4;     // Lightness turun dari 42% ke 38%
    } else {
        const p = (clamped - 50) / 50;
        h = 35 + p * 105;   // Oranye tua ke Hijau tua (Emerald/Forest)
        s = 90 - p * 5;     
        l = 38 - p * 3;     // Lightness turun dari 38% ke 35%
    }
    return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

function makeTripleBar(name, pendataan, submit, approve, anomaliDone = 0, anomaliTotal = 0) {
    const colPen = getProgressBarColor(pendataan);
    const colSub = getProgressBarColor(submit);
    const colApp = getProgressBarColor(approve);
    const wPen   = Math.min(100, pendataan).toFixed(1);
    const wSub   = Math.min(100, submit).toFixed(1);
    const wApp   = Math.min(100, approve).toFixed(1);

    let anomaliBadgeClass = 'anomali-none';
    let anomaliIcon = 'ri-checkbox-circle-line';
    if (anomaliTotal > 0) {
        if (anomaliDone === anomaliTotal) {
            anomaliBadgeClass = 'anomali-done';
            anomaliIcon = 'ri-checkbox-circle-line';
        } else {
            anomaliBadgeClass = 'anomali-pending';
            anomaliIcon = 'ri-alert-line';
        }
    }

    return `
        <div class="pj-pml-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:7px; gap:8px;">
                <div class="pj-pml-name" title="${name}" style="margin-bottom:0; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${name}</div>
                <div class="anomali-badge ${anomaliBadgeClass}" title="Anomali: ${anomaliDone}/${anomaliTotal} Ditindaklanjuti">
                    <i class="${anomaliIcon}"></i> Anomali: ${anomaliDone}/${anomaliTotal}
                </div>
            </div>
            <div class="pj-pml-bars">
                <div class="pj-pml-bar-row">
                    <span class="pj-pml-label">Pendataan</span>
                    <div class="pj-pml-track">
                        <div class="pj-pml-fill" style="width:${wPen}%; background:${colPen};"></div>
                    </div>
                    <span class="pj-pml-pct">${pendataan.toFixed(1)}%</span>
                </div>
                <div class="pj-pml-bar-row">
                    <span class="pj-pml-label">Submit</span>
                    <div class="pj-pml-track">
                        <div class="pj-pml-fill" style="width:${wSub}%; background:${colSub};"></div>
                    </div>
                    <span class="pj-pml-pct">${submit.toFixed(1)}%</span>
                </div>
                <div class="pj-pml-bar-row">
                    <span class="pj-pml-label">Approve</span>
                    <div class="pj-pml-track">
                        <div class="pj-pml-fill" style="width:${wApp}%; background:${colApp};"></div>
                    </div>
                    <span class="pj-pml-pct">${approve.toFixed(1)}%</span>
                </div>
            </div>
        </div>
    `;
}

function renderOverviewTables() {
    // ── Progres PJ (PJ Kecamatan) ──────────────────────────
    const listPj = document.getElementById('list-progres-pj');
    if (listPj) {
        let pjList = [];
        Object.keys(kosekaData).forEach(k => {
            const data = kosekaData[k];
            const total = data.totalTarget || 0;
            if (total === 0) return;
            const tersubmit = total - data.open;
            const pctPendataan = tersubmit / total * 100;
            const pctSubmit = (total - data.open - data.draft) / total * 100;
            const pctApprove = data.approved / total * 100;
            pjList.push({ name: k, total, tersubmit, pendataan: pctPendataan, submit: pctSubmit, approve: pctApprove, anomaliDone: data.anomaliDone || 0, anomaliTotal: data.anomaliTotal || 0 });
        });
        pjList.sort((a, b) => sortPjDesc ? b.pendataan - a.pendataan : a.pendataan - b.pendataan);
        listPj.innerHTML = pjList.map(p => makeTripleBar(p.name, p.pendataan, p.submit, p.approve, p.anomaliDone, p.anomaliTotal)).join('');
    }

    // ── Progres PML ────────────────────────────────
    const listPml = document.getElementById('list-progres-pml');
    if (listPml) {
        let pmlList = [];
        Object.keys(pmlData).forEach(p => {
            const data = pmlData[p];
            const total = data.totalTarget || 0;
            if (total === 0) return;
            const tersubmit = total - data.open;
            const pctPendataan = tersubmit / total * 100;
            const pctSubmit = (total - data.open - data.draft) / total * 100;
            const pctApprove = data.approved / total * 100;
            pmlList.push({ name: p, total, tersubmit, pendataan: pctPendataan, submit: pctSubmit, approve: pctApprove, anomaliDone: data.anomaliDone || 0, anomaliTotal: data.anomaliTotal || 0 });
        });
        pmlList.sort((a, b) => sortPmlDesc ? b.pendataan - a.pendataan : a.pendataan - b.pendataan);
        listPml.innerHTML = pmlList.map(p => makeTripleBar(p.name, p.pendataan, p.submit, p.approve, p.anomaliDone, p.anomaliTotal)).join('');
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initApp();
    setupNavigation();
    setupSearch();
    setupFilters();
    setupKorwilFilters();
    setupModal();
    setupSorts();
    setupMobileMenu();
    
    document.getElementById('btn-refresh').addEventListener('click', () => {
        elAppContent.style.display = 'none';
        elLoader.style.display = 'flex';
        initApp();
    });
});

function fetchCSV(url) {
    const cbUrl = url + (url.includes('?') ? '&' : '?') + 'cb=' + new Date().getTime();
    return new Promise((resolve, reject) => {
        Papa.parse(cbUrl, {
            download: true,
            header: false,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: function(results) {
                if (!results.data || results.data.length === 0) {
                    resolve([]);
                    return;
                }
                const headers = results.data[0];
                const rows = results.data.slice(1);
                
                // Construct unique header names to prevent PapaParse header failures
                const cleanHeaders = [];
                const seen = {};
                headers.forEach((h, idx) => {
                    let name = h ? String(h).trim() : '';
                    if (!name) {
                        name = `_empty_col_${idx}`;
                    }
                    if (seen[name]) {
                        let count = 1;
                        while (seen[`${name}_${count}`]) {
                            count++;
                        }
                        name = `${name}_${count}`;
                    }
                    seen[name] = true;
                    cleanHeaders.push(name);
                });

                const objects = rows.map(row => {
                    const obj = {};
                    cleanHeaders.forEach((header, idx) => {
                        obj[header] = row[idx];
                    });
                    return obj;
                });
                
                resolve(objects);
            },
            error: function(err) {
                reject(err);
            }
        });
    });
}

function fetchCSVRaw(url) {
    const cbUrl = url + (url.includes('?') ? '&' : '?') + 'cb=' + new Date().getTime();
    return new Promise((resolve, reject) => {
        Papa.parse(cbUrl, {
            download: true,
            header: false,
            dynamicTyping: false,
            skipEmptyLines: true,
            complete: function(results) {
                resolve(results.data || []);
            },
            error: function(err) {
                reject(err);
            }
        });
    });
}

function parseAnomaliRows(rawRows) {
    if (!rawRows || rawRows.length === 0) return [];
    
    let headerIdx = -1;
    for (let i = 0; i < Math.min(10, rawRows.length); i++) {
        const rowStr = (rawRows[i] || []).map(c => String(c || '').trim()).join(' ');
        if (rowStr.toLowerCase().includes('kode desa') && (rowStr.toLowerCase().includes('checklist') || rowStr.toLowerCase().includes('tindak lanjut') || rowStr.toLowerCase().includes('kode sls'))) {
            headerIdx = i;
            break;
        }
    }
    
    if (headerIdx === -1) return [];
    
    const headers = rawRows[headerIdx].map(c => String(c || '').trim());
    
    const idxDesa = headers.findIndex(h => h.toLowerCase().includes('kode desa'));
    const idxSLS = headers.findIndex(h => h.toLowerCase().includes('kode sls'));
    const idxSubSLS = headers.findIndex(h => h.toLowerCase().includes('sub sls'));
    const idxTL = headers.findIndex(h => h.toLowerCase().includes('checklist') || h.toLowerCase().includes('tindak lanjut'));
    const idxEmail = headers.findIndex(h => h.toLowerCase().includes('email'));
    const idxKrt = headers.findIndex(h => h.toLowerCase().includes('nama krt') || h.toLowerCase().includes('nama kepala keluarga') || h.toLowerCase().includes('nama usaha'));
    const idxKec = headers.findIndex(h => h.toLowerCase().includes('nama kecamatan'));
    const idxDesaName = headers.findIndex(h => h.toLowerCase().includes('nama desa/kel'));
    const idxAnom = headers.findIndex(h => h.toLowerCase().includes('nama anomali'));
    const idxFasih = headers.findIndex(h => h.toLowerCase().includes('link fasih'));
    
    if (idxDesa === -1 || idxSLS === -1 || idxSubSLS === -1) return [];
    
    const items = [];
    const dataRows = rawRows.slice(headerIdx + 1);
    
    dataRows.forEach(row => {
        if (!row || row.length === 0) return;
        
        const rawDesa = String(row[idxDesa] || '').split('.')[0].trim();
        const rawSLS = String(row[idxSLS] || '').split('.')[0].trim();
        const rawSubSLS = String(row[idxSubSLS] || '').split('.')[0].trim();
        
        if (!rawDesa || rawDesa.includes('(') || rawDesa.toLowerCase().includes('kode')) return;
        
        const desaPad = rawDesa.padStart(10, '0');
        const slsPad = rawSLS.padStart(4, '0');
        const subSlsPad = rawSubSLS.padStart(2, '0');
        
        const idsubsls = desaPad + slsPad + subSlsPad;
        
        const tlVal = idxTL !== -1 ? String(row[idxTL] || '').trim().toLowerCase() : '';
        const isDone = tlVal === 'true' || tlVal === '1' || tlVal === 'yes' || ((tlVal.includes('sudah') || tlVal.includes('selesai') || tlVal.includes('ditindaklanjuti')) && !tlVal.includes('belum'));
        
        const email = idxEmail !== -1 ? String(row[idxEmail] || '').trim().toLowerCase() : '';
        const namaKrt = idxKrt !== -1 ? String(row[idxKrt] || '').trim() : '';
        const nmkec = idxKec !== -1 ? String(row[idxKec] || '').trim() : '';
        const nmdesa = idxDesaName !== -1 ? String(row[idxDesaName] || '').trim() : '';
        const namaAnomali = idxAnom !== -1 ? String(row[idxAnom] || '').trim() : '';
        const linkFasih = idxFasih !== -1 ? String(row[idxFasih] || '').trim() : '';
        
        items.push({
            idsubsls,
            isDone,
            email,
            namaKrt,
            nmkec,
            nmdesa,
            namaAnomali,
            linkFasih
        });
    });
    
    return items;
}

function extractDicetakTime(rawRows) {
    if (!rawRows || rawRows.length < 2) return null;
    const cellValue = String(rawRows[1][0] || '');
    const idx = cellValue.toLowerCase().indexOf('dicetak:');
    if (idx !== -1) {
        return cellValue.substring(idx + 8).trim();
    }
    return null;
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

function parseGSheetDate(val) {
    if (val === null || val === undefined || val === '') return null;
    const str = String(val).trim();
    if (!str) return null;
    
    const gvizMatch = str.match(/Date\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+),\s*(\d+),\s*(\d+))?\)/i);
    if (gvizMatch) {
        const y = parseInt(gvizMatch[1]);
        const m = parseInt(gvizMatch[2]) + 1;
        const d = parseInt(gvizMatch[3]);
        const hh = gvizMatch[4] ? String(gvizMatch[4]).padStart(2, '0') : '00';
        const mm = gvizMatch[5] ? String(gvizMatch[5]).padStart(2, '0') : '00';
        const ss = gvizMatch[6] ? String(gvizMatch[6]).padStart(2, '0') : '00';
        const mmStr = String(m).padStart(2, '0');
        const ddStr = String(d).padStart(2, '0');
        return `${y}-${mmStr}-${ddStr} ${hh}:${mm}:${ss}`;
    }
    
    return str;
}

function initApp() {
    Promise.all([
        fetchCSV(SHEET_DB_URL),
        fetchCSV(SHEET_NAMA_URL),
        fetchCSV(SHEET_SLS_URL),
        fetchCSV(SHEET_KORWIL_URL),
        fetchCSVRaw(SHEET_ANOMALI_USAHA_URL),
        fetchCSVRaw(SHEET_ANOMALI_KELUARGA_URL)
    ]).then(([dbData, namaData, slsDataRaw, korwilData, rawAnomaliUsaha, rawAnomaliKeluarga]) => {
        rawDataDB = dbData;
        rawNamaData = namaData;
        rawSlsData = slsDataRaw;
        rawKorwilData = korwilData;
        rawAnomaliUsahaRows = rawAnomaliUsaha;
        rawAnomaliKeluargaRows = rawAnomaliKeluarga;
        
        let timeStr = new Date().toLocaleString('id-ID');
        if (dbData && dbData.length > 0) {
            let foundTime = null;
            
            // 1. Try finding by column key matching 'sync'
            const keys = Object.keys(dbData[0]);
            const syncKey = keys.find(k => k && k.toLowerCase().replace(/[^a-z]/g, '').includes('sync'));
            
            if (syncKey) {
                for (let i = 0; i < Math.min(10, dbData.length); i++) {
                    const parsed = parseGSheetDate(dbData[i][syncKey]);
                    if (parsed) {
                        foundTime = parsed;
                        break;
                    }
                }
            }
            
            // 2. Fallback: Scan all cells in first 10 rows for Date(...) or date string
            if (!foundTime) {
                for (let i = 0; i < Math.min(10, dbData.length); i++) {
                    const values = Object.values(dbData[i]);
                    for (const val of values) {
                        if (val) {
                            const strVal = String(val);
                            if (strVal.includes('Date(') || strVal.match(/\d{4}-\d{2}-\d{2}/) || strVal.match(/\d{2}\/\d{2}\/\d{4}/)) {
                                foundTime = parseGSheetDate(val);
                                break;
                            }
                        }
                    }
                    if (foundTime) break;
                }
            }
            
            if (foundTime) {
                timeStr = foundTime;
            }
        }
        console.log("Final timeStr:", timeStr);
        
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
        elLastSync.innerText = timeStr;
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

        // PJ Kecamatan Aggregate
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

    // 5. Parse and Aggregate Anomalies
    const listAnomaliUsaha = parseAnomaliRows(rawAnomaliUsahaRows);
    const listAnomaliKeluarga = parseAnomaliRows(rawAnomaliKeluargaRows);
    
    window.anomaliUsahaTime = extractDicetakTime(rawAnomaliUsahaRows);
    window.anomaliKeluargaTime = extractDicetakTime(rawAnomaliKeluargaRows);
    
    listAnomaliUsaha.forEach(a => a.type = 'usaha');
    listAnomaliKeluarga.forEach(a => a.type = 'keluarga');

    let usahaDone = 0;
    listAnomaliUsaha.forEach(a => { if (a.isDone) usahaDone++; });
    let keluargaDone = 0;
    listAnomaliKeluarga.forEach(a => { if (a.isDone) keluargaDone++; });

    window.statsAnomaliUsaha = { done: usahaDone, total: listAnomaliUsaha.length };
    window.statsAnomaliKeluarga = { done: keluargaDone, total: listAnomaliKeluarga.length };

    const allAnomali = [...listAnomaliUsaha, ...listAnomaliKeluarga];

    const slsToAssignmentMap = {};
    slsAssignments.forEach(asgn => {
        slsToAssignmentMap[asgn.slsId] = asgn;
    });

    allAnomali.forEach(anom => {
        let asgn = slsToAssignmentMap[anom.idsubsls];
        
        let p = null;
        let pm = null;
        let ks = null;
        let kc = null;
        
        if (asgn) {
            p = petugasData[asgn.email];
            pm = pmlData[asgn.pml];
            ks = kosekaData[asgn.koseka];
            kc = kecamatanData[asgn.kecamatan];
        } else if (anom.email && petugasData[anom.email]) {
            p = petugasData[anom.email];
            if (p.pml) pm = pmlData[p.pml];
            if (p.koseka) ks = kosekaData[p.koseka];
        }
        
        if (p) {
            p.anomaliTotal = (p.anomaliTotal || 0) + 1;
            if (anom.isDone) p.anomaliDone = (p.anomaliDone || 0) + 1;
            if (!p.anomaliList) p.anomaliList = [];
            p.anomaliList.push(anom);
            
            if (anom.type === 'usaha') {
                p.anomaliUsahaTotal = (p.anomaliUsahaTotal || 0) + 1;
                if (anom.isDone) p.anomaliUsahaDone = (p.anomaliUsahaDone || 0) + 1;
            } else {
                p.anomaliKeluargaTotal = (p.anomaliKeluargaTotal || 0) + 1;
                if (anom.isDone) p.anomaliKeluargaDone = (p.anomaliKeluargaDone || 0) + 1;
            }
        }
        if (pm) {
            pm.anomaliTotal = (pm.anomaliTotal || 0) + 1;
            if (anom.isDone) pm.anomaliDone = (pm.anomaliDone || 0) + 1;
            if (anom.type === 'usaha') {
                pm.anomaliUsahaTotal = (pm.anomaliUsahaTotal || 0) + 1;
                if (anom.isDone) pm.anomaliUsahaDone = (pm.anomaliUsahaDone || 0) + 1;
            } else {
                pm.anomaliKeluargaTotal = (pm.anomaliKeluargaTotal || 0) + 1;
                if (anom.isDone) pm.anomaliKeluargaDone = (pm.anomaliKeluargaDone || 0) + 1;
            }
        }
        if (ks) {
            ks.anomaliTotal = (ks.anomaliTotal || 0) + 1;
            if (anom.isDone) ks.anomaliDone = (ks.anomaliDone || 0) + 1;
            if (anom.type === 'usaha') {
                ks.anomaliUsahaTotal = (ks.anomaliUsahaTotal || 0) + 1;
                if (anom.isDone) ks.anomaliUsahaDone = (ks.anomaliUsahaDone || 0) + 1;
            } else {
                ks.anomaliKeluargaTotal = (ks.anomaliKeluargaTotal || 0) + 1;
                if (anom.isDone) ks.anomaliKeluargaDone = (ks.anomaliKeluargaDone || 0) + 1;
            }
        }
        if (kc) {
            kc.anomaliTotal = (kc.anomaliTotal || 0) + 1;
            if (anom.isDone) kc.anomaliDone = (kc.anomaliDone || 0) + 1;
            if (anom.type === 'usaha') {
                kc.anomaliUsahaTotal = (kc.anomaliUsahaTotal || 0) + 1;
                if (anom.isDone) kc.anomaliUsahaDone = (kc.anomaliUsahaDone || 0) + 1;
            } else {
                kc.anomaliKeluargaTotal = (kc.anomaliKeluargaTotal || 0) + 1;
                if (anom.isDone) kc.anomaliKeluargaDone = (kc.anomaliKeluargaDone || 0) + 1;
            }
        }
    });
}

let statusDistributionChartInst = null;
let sortPetugasDesc = true;
let sortKecamatanDesc = true;

function updateDashboard() {
    let globalTarget = 0;
    let gOpen = 0, gDraft = 0, gSub = 0, gApp = 0, gRej = 0, gRev = 0;
    let gAnomaliDone = 0, gAnomaliTotal = 0;

    for (const email in petugasData) {
        const p = petugasData[email];
        globalTarget += p.totalTarget;
        gOpen += p.open;
        gDraft += p.draft;
        gSub += p.submitted;
        gApp += p.approved;
        gRej += p.rejected;
        gRev += p.revoked;
        gAnomaliDone += (p.anomaliDone || 0);
        gAnomaliTotal += (p.anomaliTotal || 0);
    }

    // Populate overview numbers with animation
    animateValue("kpi-assignment", 0, globalTarget, 1000);
    animateValue("kpi-open", 0, gOpen, 1000, ` <span style="font-size: 12px; color: var(--color-open); opacity: 0.75;">(${globalTarget > 0 ? ((gOpen/globalTarget)*100).toFixed(1) : 0}%)</span>`);
    animateValue("kpi-draft", 0, gDraft, 1000, ` <span style="font-size: 12px; color: var(--color-draft); opacity: 0.75;">(${globalTarget > 0 ? ((gDraft/globalTarget)*100).toFixed(1) : 0}%)</span>`);
    animateValue("kpi-submitted", 0, gSub, 1000, ` <span style="font-size: 12px; color: var(--color-submitted); opacity: 0.75;">(${globalTarget > 0 ? ((gSub/globalTarget)*100).toFixed(1) : 0}%)</span>`);
    animateValue("kpi-rejected", 0, gRej, 1000, ` <span style="font-size: 12px; color: var(--color-rejected); opacity: 0.75;">(${globalTarget > 0 ? ((gRej/globalTarget)*100).toFixed(1) : 0}%)</span>`);
    animateValue("kpi-revoked", 0, gRev, 1000, ` <span style="font-size: 12px; color: var(--color-revoked); opacity: 0.75;">(${globalTarget > 0 ? ((gRev/globalTarget)*100).toFixed(1) : 0}%)</span>`);
    animateValue("kpi-approved", 0, gApp, 1000, ` <span style="font-size: 12px; color: var(--color-approved); opacity: 0.75;">(${globalTarget > 0 ? ((gApp/globalTarget)*100).toFixed(1) : 0}%)</span>`);

    // Update Anomali Kabupaten Banner
    const elAnomali = document.getElementById("kpi-anomaly-kabupaten");
    const elAnomaliIcon = document.getElementById("kpi-anomaly-icon");
    if (elAnomali) {
        const uStats = window.statsAnomaliUsaha || { done: 0, total: 0 };
        const kStats = window.statsAnomaliKeluarga || { done: 0, total: 0 };
        
        const totalDone = uStats.done + kStats.done;
        const totalAnom = uStats.total + kStats.total;
        
        elAnomali.innerText = `${totalDone}/${totalAnom} Tuntas`;
        
        // Detailed breakdown
        const elUsahaDone = document.getElementById("anom-usaha-done");
        const elUsahaPending = document.getElementById("anom-usaha-pending");
        const elUsahaTotal = document.getElementById("anom-usaha-total");
        if (elUsahaDone && elUsahaPending && elUsahaTotal) {
            elUsahaDone.innerText = uStats.done;
            elUsahaPending.innerText = uStats.total - uStats.done;
            elUsahaTotal.innerText = uStats.total;
        }

        const elUsahaTime = document.getElementById("anom-usaha-time");
        if (elUsahaTime) {
            elUsahaTime.innerText = window.anomaliUsahaTime ? `Dicetak: ${window.anomaliUsahaTime}` : '';
        }

        const elKeluargaDone = document.getElementById("anom-keluarga-done");
        const elKeluargaPending = document.getElementById("anom-keluarga-pending");
        const elKeluargaTotal = document.getElementById("anom-keluarga-total");
        if (elKeluargaDone && elKeluargaPending && elKeluargaTotal) {
            elKeluargaDone.innerText = kStats.done;
            elKeluargaPending.innerText = kStats.total - kStats.done;
            elKeluargaTotal.innerText = kStats.total;
        }

        const elKeluargaTime = document.getElementById("anom-keluarga-time");
        if (elKeluargaTime) {
            elKeluargaTime.innerText = window.anomaliKeluargaTime ? `Dicetak: ${window.anomaliKeluargaTime}` : '';
        }

        if (totalAnom === 0 || totalDone === totalAnom) {
            elAnomali.style.color = "#10b981"; // green
            elAnomali.parentElement.parentElement.style.borderLeftColor = "#10b981";
            if (elAnomaliIcon) {
                elAnomaliIcon.className = "ri-checkbox-circle-line";
                elAnomaliIcon.style.color = "#10b981";
            }
        } else {
            elAnomali.style.color = "#ff8b0e"; // warning orange
            elAnomali.parentElement.parentElement.style.borderLeftColor = "#ff8b0e";
            if (elAnomaliIcon) {
                elAnomaliIcon.className = "ri-alert-line";
                elAnomaliIcon.style.color = "#ff8b0e";
            }
        }
    }

    // Calculate and animate Assignment Tersubmit percentage (excluding Open & Draft)
    const tersubmitCount = globalTarget - gOpen - gDraft;
    const completionPct = globalTarget > 0 ? ((tersubmitCount / globalTarget) * 100).toFixed(2) : 0;
    animateValuePercent("kpi-completion-percentage", 0, parseFloat(completionPct), 1000);
    
    const elFill = document.getElementById("kpi-progress-fill");
    if (elFill) {
        setTimeout(() => {
            elFill.style.width = completionPct + '%';
        }, 100);
    }

    // Render Charts
    Chart.defaults.color = '#6e6e73';
    Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif";

    // Update Horizontal Stacked Bar Chart with Chart.js
    const ctxStatus = document.getElementById('statusDistributionChart');
    if (ctxStatus) {
        if (statusDistributionChartInst) statusDistributionChartInst.destroy();
        
        statusDistributionChartInst = new Chart(ctxStatus, {
            type: 'bar',
            data: {
                labels: ['Status Distribution'],
                datasets: [
                    { label: 'Open',      data: [gOpen],  backgroundColor: '#9ca3af', barPercentage: 0.9 },
                    { label: 'Draft',     data: [gDraft], backgroundColor: '#a855f7', barPercentage: 0.9 },
                    { label: 'Submitted', data: [gSub],   backgroundColor: '#0ea5e9', barPercentage: 0.9 },
                    { label: 'Rejected',  data: [gRej],   backgroundColor: '#ef4444', barPercentage: 0.9 },
                    { label: 'Revoked',   data: [gRev],   backgroundColor: '#f59e0b', barPercentage: 0.9 },
                    { label: 'Approved',  data: [gApp],   backgroundColor: '#10b981', barPercentage: 0.9 }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                borderRadius: function(context) {
                    const chart = context.chart;
                    const datasetIndex = context.datasetIndex;
                    const dataIndex = context.dataIndex;
                    let firstVisible = -1;
                    let lastVisible = -1;
                    for (let i = 0; i < chart.data.datasets.length; i++) {
                        if (chart.data.datasets[i].data[dataIndex] > 0) {
                            if (firstVisible === -1) firstVisible = i;
                            lastVisible = i;
                        }
                    }
                    if (datasetIndex === firstVisible && datasetIndex === lastVisible) {
                        return 6;
                    } else if (datasetIndex === firstVisible) {
                        return {topLeft: 6, bottomLeft: 6, topRight: 0, bottomRight: 0};
                    } else if (datasetIndex === lastVisible) {
                        return {topRight: 6, bottomRight: 6, topLeft: 0, bottomLeft: 0};
                    } else {
                        return 0;
                    }
                },
                borderSkipped: false,
                barPercentage: 1.0,
                categoryPercentage: 1.0,
                scales: {
                    x: { stacked: true, display: false, max: globalTarget },
                    y: { stacked: true, display: false }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#6e6e73', usePointStyle: true, pointStyle: 'circle', boxWidth: 8, font: { size: 10 }, padding: 14 }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const val = context.raw;
                                const pct = globalTarget > 0 ? ((val / globalTarget) * 100).toFixed(1) : 0;
                                return `${context.dataset.label}: ${val} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Render List Progres Petugas & Kecamatan
    renderProgresPetugasList();
    renderProgresKecamatanList();
    renderOverviewTables();
}

function renderProgresPetugasList() {
    const listContainer = document.getElementById('list-progres-petugas');
    if (!listContainer) return;
    
    let pList = Object.values(petugasData).map(p => {
        const total = p.totalTarget || 0;
        if (total === 0) return null;
        const tersubmit = total - p.open;
        const pctPendataan = tersubmit / total * 100;
        const pctSubmit = (total - p.open - p.draft) / total * 100;
        const pctApprove = p.approved / total * 100;
        return { name: p.namaLengkap, total, tersubmit, pendataan: pctPendataan, submit: pctSubmit, approve: pctApprove, anomaliDone: p.anomaliDone || 0, anomaliTotal: p.anomaliTotal || 0 };
    }).filter(Boolean);
    
    pList.sort((a, b) => sortPetugasDesc ? b.pendataan - a.pendataan : a.pendataan - b.pendataan);
    listContainer.innerHTML = pList.map(p => makeTripleBar(p.name, p.pendataan, p.submit, p.approve, p.anomaliDone, p.anomaliTotal)).join('');
}

function renderProgresKecamatanList() {
    const listContainer = document.getElementById('list-progres-kecamatan');
    if (!listContainer) return;
    
    let kList = Object.values(kecamatanData).map(k => {
        const total = k.totalTarget || 0;
        if (total === 0) return null;
        const tersubmit = total - k.open;
        const pctPendataan = tersubmit / total * 100;
        const pctSubmit = (total - k.open - k.draft) / total * 100;
        const pctApprove = k.approved / total * 100;
        return { name: k.kecamatan, total, tersubmit, pendataan: pctPendataan, submit: pctSubmit, approve: pctApprove, anomaliDone: k.anomaliDone || 0, anomaliTotal: k.anomaliTotal || 0 };
    }).filter(Boolean);
    
    kList.sort((a, b) => sortKecamatanDesc ? b.pendataan - a.pendataan : a.pendataan - b.pendataan);
    listContainer.innerHTML = kList.map(k => makeTripleBar(k.name, k.pendataan, k.submit, k.approve, k.anomaliDone, k.anomaliTotal)).join('');
}

function renderKorwilTable() {
    const tbody = document.querySelector('#table-korwil tbody');
    tbody.innerHTML = '';

    const filterKoseka = document.getElementById('filter-korwil-koseka') ? document.getElementById('filter-korwil-koseka').value : '';
    const filterPml = document.getElementById('filter-korwil-pml') ? document.getElementById('filter-korwil-pml').value : '';
    const filterPcl = document.getElementById('filter-korwil-pcl') ? document.getElementById('filter-korwil-pcl').value : '';

    // Get all PCLs and filter/sort by Koorkec -> PML -> Nama Petugas
    let pList = Object.values(petugasData).filter(p => {
        if (!p.koseka || !p.pml) return false;
        if (filterKoseka && p.koseka !== filterKoseka) return false;
        if (filterPml && p.pml !== filterPml) return false;
        if (filterPcl && p.namaLengkap !== filterPcl) return false;
        return true;
    });

    pList.sort((a, b) => {
        if (a.koseka !== b.koseka) return a.koseka.localeCompare(b.koseka);
        if (a.pml !== b.pml) return a.pml.localeCompare(b.pml);
        return a.namaLengkap.localeCompare(b.namaLengkap);
    });

    // Calculate rowspans
    let kosekaCounts = {};
    let pmlCounts = {};
    
    pList.forEach(p => {
        kosekaCounts[p.koseka] = (kosekaCounts[p.koseka] || 0) + 1;
        let pmlKey = p.koseka + "||" + p.pml;
        pmlCounts[pmlKey] = (pmlCounts[pmlKey] || 0) + 1;
    });

    let currentKoseka = null;
    let currentPml = null;

    pList.forEach(item => {
        const assignmentTersubmit = item.totalTarget - item.open - item.draft;
        const progresPendataan = item.totalTarget - item.open;
        const pctSubmitted = item.totalTarget > 0 ? ((assignmentTersubmit / item.totalTarget) * 100).toFixed(1) : 0;
        const pctPendataan = item.totalTarget > 0 ? ((progresPendataan / item.totalTarget) * 100).toFixed(1) : 0;
        
        const tr = document.createElement('tr');
        let html = '';
        
        if (item.koseka !== currentKoseka) {
            html += `<td rowspan="${kosekaCounts[item.koseka]}" style="vertical-align: middle;"><strong>${item.koseka}</strong></td>`;
            currentKoseka = item.koseka;
        }
        
        let pmlKey = item.koseka + "||" + item.pml;
        if (pmlKey !== currentPml) {
            html += `<td rowspan="${pmlCounts[pmlKey]}" style="vertical-align: middle;"><strong>${item.pml}</strong></td>`;
            currentPml = pmlKey;
        }

        const colorSubmitted = getScaleColor(pctSubmitted);
        const colorPendataan = getScaleColor(pctPendataan);

        const uDone = item.anomaliUsahaDone || 0;
        const uTotal = item.anomaliUsahaTotal || 0;
        const uPending = uTotal - uDone;

        const kDone = item.anomaliKeluargaDone || 0;
        const kTotal = item.anomaliKeluargaTotal || 0;
        const kPending = kTotal - kDone;

        const uText = uTotal > 0 ? `<span style="font-weight:600;"><span style="color:#10b981;">${uDone}</span><span style="color:var(--text-dim); margin:0 1px;">/</span><span style="color:#ef4444;">${uPending}</span> <span style="color:var(--text-muted); font-size:10px; font-weight:normal;">(${uTotal})</span></span>` : `<span style="color:var(--text-dim); font-size:11px;">-</span>`;
        const kText = kTotal > 0 ? `<span style="font-weight:600;"><span style="color:#10b981;">${kDone}</span><span style="color:var(--text-dim); margin:0 1px;">/</span><span style="color:#ef4444;">${kPending}</span> <span style="color:var(--text-muted); font-size:10px; font-weight:normal;">(${kTotal})</span></span>` : `<span style="color:var(--text-dim); font-size:11px;">-</span>`;

        html += `
            <td><strong>${item.namaLengkap}</strong></td>
            <td>${item.totalTarget}</td>
            <td><span class="badge-dot open"></span> ${item.open}</td>
            <td><span class="badge-dot draft"></span> ${item.draft}</td>
            <td><span class="badge-dot submitted"></span> ${item.submitted}</td>
            <td><span class="badge-dot rejected"></span> ${item.rejected || 0}</td>
            <td><span class="badge-dot revoked"></span> ${item.revoked || 0}</td>
            <td><span class="badge-dot approved"></span> ${item.approved}</td>
            <td>
                <div style="display:flex; align-items:center; gap:8px;">
                    <div class="progress-bar-thin" style="width:60px; margin:0;"><div class="progress-fill-thin" style="background:${colorSubmitted}; width:${pctSubmitted}%"></div></div>
                    <span style="font-size:11px;color:var(--text-title); font-weight:600;">${pctSubmitted}% <span style="opacity:0.8; font-weight:normal;">(${assignmentTersubmit})</span></span>
                </div>
            </td>
            <td>
                <div style="display:flex; align-items:center; gap:8px;">
                    <div class="progress-bar-thin" style="width:60px; margin:0;"><div class="progress-fill-thin" style="background:${colorPendataan}; width:${pctPendataan}%"></div></div>
                    <span style="font-size:11px;color:var(--text-title); font-weight:600;">${pctPendataan}% <span style="opacity:0.8; font-weight:normal;">(${progresPendataan})</span></span>
                </div>
            </td>
            <td>${uText}</td>
            <td>${kText}</td>
        `;
        tr.innerHTML = html;
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
            <td><span class="badge-dot rejected"></span> ${p.rejected}</td>
            <td><span class="badge-dot revoked"></span> ${p.revoked}</td>
            <td><span class="badge-dot approved"></span> ${p.approved}</td>
            <td>
                <div style="display:flex; align-items:center; gap:8px;">
                    <div class="progress-bar-thin" style="width:60px; margin:0;"><div class="progress-fill-thin" style="background:${getProgressBarColor(pct)}; width:${pct}%"></div></div>
                    <span style="font-size:11px; color:var(--text-title); font-weight:600;">${pct}%</span>
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

function getScaleColor(pct) {
    return getProgressBarColor(pct);
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
    const searchEl = document.getElementById('global-search');
    const searchVal = searchEl ? searchEl.value.toLowerCase() : '';

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
    populateSelect('filter-koseka', Array.from(kosekas).sort(), "Semua PJ Kecamatan");

    // Dynamic Desa dropdown based on selected Kecamatan
    updateDesaDropdown();

    if (document.getElementById('filter-korwil-koseka')) {
        populateKorwilFilterDropdowns();
    }
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
    applyCustomSelect(select);
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
            const sel = document.getElementById(id);
            if (sel.value !== '') {
                sel.value = '';
                sel.dispatchEvent(new Event('change'));
            }
        });
    });
}

function populateKorwilFilterDropdowns() {
    const kosekas = new Set();
    Object.values(petugasData).forEach(p => {
        if (p.koseka) kosekas.add(p.koseka);
    });
    populateSelect('filter-korwil-koseka', Array.from(kosekas).sort(), "Semua PJ Kecamatan");
    
    updateKorwilPmlDropdown();
}

function updateKorwilPmlDropdown() {
    const selectedKoseka = document.getElementById('filter-korwil-koseka').value;
    const pmls = new Set();
    Object.values(petugasData).forEach(p => {
        if (selectedKoseka && p.koseka !== selectedKoseka) return;
        if (p.pml) pmls.add(p.pml);
    });
    populateSelect('filter-korwil-pml', Array.from(pmls).sort(), "Semua PML");
    
    updateKorwilPclDropdown();
}

function updateKorwilPclDropdown() {
    const selectedKoseka = document.getElementById('filter-korwil-koseka').value;
    const selectedPml = document.getElementById('filter-korwil-pml').value;
    const pcls = new Set();
    
    Object.values(petugasData).forEach(p => {
        if (selectedKoseka && p.koseka !== selectedKoseka) return;
        if (selectedPml && p.pml !== selectedPml) return;
        if (p.namaLengkap) pcls.add(p.namaLengkap);
    });
    populateSelect('filter-korwil-pcl', Array.from(pcls).sort(), "Semua PCL");
}

function setupKorwilFilters() {
    const filterIds = ['filter-korwil-koseka', 'filter-korwil-pml', 'filter-korwil-pcl'];
    filterIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                if (id === 'filter-korwil-koseka') {
                    updateKorwilPmlDropdown();
                } else if (id === 'filter-korwil-pml') {
                    updateKorwilPclDropdown();
                }
                renderKorwilTable();
            });
        }
    });
    
    const resetBtn = document.getElementById('btn-reset-korwil-filters');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            ['filter-korwil-koseka', 'filter-korwil-pml', 'filter-korwil-pcl'].forEach(id => {
                const sel = document.getElementById(id);
                if (sel.value !== '') {
                    sel.value = '';
                    sel.dispatchEvent(new Event('change'));
                }
            });
        });
    }
}


function setupModal() {
    const modal = document.getElementById('petugas-modal');
    const btnClose = document.getElementById('close-modal');

    if (btnClose) {
        btnClose.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

function setupSorts() {
    const btnSortPj = document.getElementById('btn-sort-pj');
    if (btnSortPj) {
        btnSortPj.addEventListener('click', () => {
            sortPjDesc = !sortPjDesc;
            btnSortPj.innerHTML = sortPjDesc ? '<i class="ri-sort-desc"></i> Sort' : '<i class="ri-sort-asc"></i> Sort';
            renderOverviewTables();
        });
    }
    const btnSortPml = document.getElementById('btn-sort-pml');
    if (btnSortPml) {
        btnSortPml.addEventListener('click', () => {
            sortPmlDesc = !sortPmlDesc;
            btnSortPml.innerHTML = sortPmlDesc ? '<i class="ri-sort-desc"></i> Sort' : '<i class="ri-sort-asc"></i> Sort';
            renderOverviewTables();
        });
    }
    const btnSortPetugas = document.getElementById('btn-sort-petugas');
    if (btnSortPetugas) {
        btnSortPetugas.addEventListener('click', () => {
            sortPetugasDesc = !sortPetugasDesc;
            btnSortPetugas.innerHTML = sortPetugasDesc ? '<i class="ri-sort-desc"></i> Sort' : '<i class="ri-sort-asc"></i> Sort';
            renderProgresPetugasList();
        });
    }

    const btnSortKecamatan = document.getElementById('btn-sort-kecamatan');
    if (btnSortKecamatan) {
        btnSortKecamatan.addEventListener('click', () => {
            sortKecamatanDesc = !sortKecamatanDesc;
            btnSortKecamatan.innerHTML = sortKecamatanDesc ? '<i class="ri-sort-desc"></i> Sort' : '<i class="ri-sort-asc"></i> Sort';
            renderProgresKecamatanList();
    renderOverviewTables();
        });
    }
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
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
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
}

// Utility: Number Animation
function animateValue(id, start, end, duration, suffix = "") {
    let obj = document.getElementById(id);
    if (!obj) return;
    if (start === end) {
        obj.innerHTML = end.toLocaleString('id-ID') + suffix;
        return;
    }
    
    let startTime = null;
    
    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        let progress = Math.min((timestamp - startTime) / duration, 1);
        let easeOut = 1 - Math.pow(1 - progress, 3);
        let current = Math.floor(easeOut * (end - start) + start);
        
        obj.innerHTML = current.toLocaleString('id-ID') + suffix;
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = end.toLocaleString('id-ID') + suffix;
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
        let current = (easeOut * (end - start) + start).toFixed(2);
        
        obj.innerHTML = current + '%';
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = end.toFixed(2) + '%';
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
            <p>Pilih PJ Kecamatan terlebih dahulu</p>
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
        const progressVal = total > 0 ? ((total - data.open - data.draft) / total * 100).toFixed(1) : "0.0";
        const pendataanVal = total > 0 ? ((total - data.open) / total * 100).toFixed(1) : "0.0";
        
        const card = document.createElement('div');
        card.className = 'hierarchy-card';
        card.innerHTML = `
            <div class="hierarchy-card-header" style="margin-bottom: 6px;">
                <span class="hierarchy-card-title" title="${koseka}">${koseka}</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:4px; margin-bottom: 8px;">
                <div>
                    <div style="display:flex; justify-content:space-between; font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">
                        <span style="color:var(--text-muted)">Tersubmit</span>
                        <span style="color:var(--text-title);">${progressVal}%</span>
                    </div>
                    <div class="hierarchy-progress-bar" style="margin-top:2px;">
                        <div class="hierarchy-progress-fill" style="width: ${progressVal}%; background: ${getProgressBarColor(progressVal)};"></div>
                    </div>
                </div>
                <div>
                    <div style="display:flex; justify-content:space-between; font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">
                        <span style="color:var(--text-muted)">Pendataan</span>
                        <span style="color:var(--text-title);">${pendataanVal}%</span>
                    </div>
                    <div class="hierarchy-progress-bar" style="margin-top:2px;">
                        <div class="hierarchy-progress-fill" style="width: ${pendataanVal}%; background: ${getProgressBarColor(pendataanVal)};"></div>
                    </div>
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
        const progressVal = total > 0 ? ((total - data.open - data.draft) / total * 100).toFixed(1) : "0.0";
        const pendataanVal = total > 0 ? ((total - data.open) / total * 100).toFixed(1) : "0.0";

        const card = document.createElement('div');
        card.className = 'hierarchy-card';
        card.innerHTML = `
            <div class="hierarchy-card-header" style="margin-bottom: 6px;">
                <span class="hierarchy-card-title" title="${pml}">${pml}</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:4px; margin-bottom: 8px;">
                <div>
                    <div style="display:flex; justify-content:space-between; font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">
                        <span style="color:var(--text-muted)">Tersubmit</span>
                        <span style="color:var(--text-title);">${progressVal}%</span>
                    </div>
                    <div class="hierarchy-progress-bar" style="margin-top:2px;">
                        <div class="hierarchy-progress-fill" style="width: ${progressVal}%; background: ${getProgressBarColor(progressVal)};"></div>
                    </div>
                </div>
                <div>
                    <div style="display:flex; justify-content:space-between; font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">
                        <span style="color:var(--text-muted)">Pendataan</span>
                        <span style="color:var(--text-title);">${pendataanVal}%</span>
                    </div>
                    <div class="hierarchy-progress-bar" style="margin-top:2px;">
                        <div class="hierarchy-progress-fill" style="width: ${pendataanVal}%; background: ${getProgressBarColor(pendataanVal)};"></div>
                    </div>
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
        const progressVal = total > 0 ? ((total - data.open - data.draft) / total * 100).toFixed(1) : "0.0";
        const pendataanVal = total > 0 ? ((total - data.open) / total * 100).toFixed(1) : "0.0";

        const card = document.createElement('div');
        card.className = 'hierarchy-card';
        card.innerHTML = `
            <div class="hierarchy-card-header" style="margin-bottom: 6px;">
                <span class="hierarchy-card-title" title="${data.namaLengkap}">${data.namaLengkap}</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:4px; margin-bottom: 8px;">
                <div>
                    <div style="display:flex; justify-content:space-between; font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">
                        <span style="color:var(--text-muted)">Tersubmit</span>
                        <span style="color:var(--text-title);">${progressVal}%</span>
                    </div>
                    <div class="hierarchy-progress-bar" style="margin-top:2px;">
                        <div class="hierarchy-progress-fill" style="width: ${progressVal}%; background: ${getProgressBarColor(progressVal)};"></div>
                    </div>
                </div>
                <div>
                    <div style="display:flex; justify-content:space-between; font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">
                        <span style="color:var(--text-muted)">Pendataan</span>
                        <span style="color:var(--text-title);">${pendataanVal}%</span>
                    </div>
                    <div class="hierarchy-progress-bar" style="margin-top:2px;">
                        <div class="hierarchy-progress-fill" style="width: ${pendataanVal}%; background: ${getProgressBarColor(pendataanVal)};"></div>
                    </div>
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
    const progressVal = total > 0 ? ((total - data.open - data.draft) / total * 100).toFixed(1) : "0.0";
    const pendataanVal = total > 0 ? ((total - data.open) / total * 100).toFixed(1) : "0.0";

    detailBody.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px;">
            <!-- Header Info -->
            <div style="border-bottom:1px solid var(--border-glass); padding-bottom:8px;">
                <h2 style="font-family:'Outfit'; font-size:16px; font-weight:700; color:var(--text-title);">${data.namaLengkap}</h2>
                <p style="font-size:11px; color:var(--text-muted); margin-top:2px;">${email}</p>
            </div>

            <!-- Stats Grid -->
            <div class="detail-stats-grid">
                <div class="detail-stat-card">
                    <span class="label">PJ Kecamatan</span>
                    <strong class="value" title="${data.koseka}">${data.koseka}</strong>
                </div>
                <div class="detail-stat-card">
                    <span class="label">PML</span>
                    <strong class="value" title="${data.pml}">${data.pml}</strong>
                </div>
                <div class="detail-stat-card">
                    <span class="label" title="Submitted + Approved">Penyelesaian Muatan</span>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                        <strong class="value" style="font-size:14px;">${data.approved + data.submitted} / ${total}</strong>
                        <span class="hierarchy-progress-percent" style="font-size:12px; color:var(--color-approved);">${progressVal}%</span>
                    </div>
                    <div class="hierarchy-progress-bar" style="margin-top:6px;">
                        <div class="hierarchy-progress-fill" style="width: ${progressVal}%; background: ${getProgressBarColor(progressVal)};"></div>
                    </div>
                </div>
                <div class="detail-stat-card">
                    <span class="label" title="Semua status selain OPEN">Progres Pendataan</span>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                        <strong class="value" style="font-size:14px;">${total - data.open} / ${total}</strong>
                        <span class="hierarchy-progress-percent" style="font-size:12px; color:var(--text-title);">${total > 0 ? ((total - data.open) / total * 100).toFixed(1) : "0.0"}%</span>
                    </div>
                    <div class="hierarchy-progress-bar" style="margin-top:6px;">
                        <div class="hierarchy-progress-fill" style="width: ${total > 0 ? ((total - data.open) / total * 100).toFixed(1) : "0.0"}%; background: ${getProgressBarColor(pendataanVal)};"></div>
                    </div>
                </div>
            </div>

            <!-- Status Distribution Breakdown -->
            <div class="detail-stats-grid" style="grid-template-columns: repeat(3, 1fr); gap:6px;">
                <div class="detail-stat-card" style="border-left: 2px solid var(--color-open); padding: 6px;">
                    <span class="label" style="font-size:8px;">Open</span>
                    <strong class="value" style="font-size:12px; color:var(--color-open);">${data.open} <span style="font-size:10px; opacity:0.8; font-weight:normal;">(${total > 0 ? (data.open/total*100).toFixed(1) : "0.0"}%)</span></strong>
                </div>
                <div class="detail-stat-card" style="border-left: 2px solid var(--color-draft); padding: 6px;">
                    <span class="label" style="font-size:8px;">Draft</span>
                    <strong class="value" style="font-size:12px; color:var(--color-draft);">${data.draft} <span style="font-size:10px; opacity:0.8; font-weight:normal;">(${total > 0 ? (data.draft/total*100).toFixed(1) : "0.0"}%)</span></strong>
                </div>
                <div class="detail-stat-card" style="border-left: 2px solid var(--color-submitted); padding: 6px;">
                    <span class="label" style="font-size:8px;">Submitted</span>
                    <strong class="value" style="font-size:12px; color:var(--color-submitted);">${data.submitted} <span style="font-size:10px; opacity:0.8; font-weight:normal;">(${total > 0 ? (data.submitted/total*100).toFixed(1) : "0.0"}%)</span></strong>
                </div>
                <div class="detail-stat-card" style="border-left: 2px solid var(--color-rejected); padding: 6px;">
                    <span class="label" style="font-size:8px;">Rejected</span>
                    <strong class="value" style="font-size:12px; color:var(--color-rejected);">${data.rejected} <span style="font-size:10px; opacity:0.8; font-weight:normal;">(${total > 0 ? (data.rejected/total*100).toFixed(1) : "0.0"}%)</span></strong>
                </div>
                <div class="detail-stat-card" style="border-left: 2px solid var(--color-revoked); padding: 6px;">
                    <span class="label" style="font-size:8px;">Revoked</span>
                    <strong class="value" style="font-size:12px; color:var(--color-revoked);">${data.revoked} <span style="font-size:10px; opacity:0.8; font-weight:normal;">(${total > 0 ? (data.revoked/total*100).toFixed(1) : "0.0"}%)</span></strong>
                </div>
                <div class="detail-stat-card" style="border-left: 2px solid var(--color-approved); padding: 6px;">
                    <span class="label" style="font-size:8px;">Approved</span>
                    <strong class="value" style="font-size:12px; color:var(--color-approved);">${data.approved} <span style="font-size:10px; opacity:0.8; font-weight:normal;">(${total > 0 ? (data.approved/total*100).toFixed(1) : "0.0"}%)</span></strong>
                </div>
            </div>

            <!-- Detailed List Section -->
            <div>
                <span class="detail-section-title"><i class="ri-list-check"></i> Detail Target Muatan</span>
                <div class="sls-list-container" id="detail-sls-list"></div>
            </div>

            <!-- Detailed Anomaly Section -->
            <div style="margin-top: 16px;">
                <span class="detail-section-title"><i class="ri-alert-line"></i> Detail Anomali (${(data.anomaliList || []).length})</span>
                <div class="sls-list-container" id="detail-anomaly-list" style="margin-top: 8px; display: flex; flex-direction: column; gap: 8px;"></div>
            </div>
        </div>
    `;

    // Render List Cards
    const listContainer = document.getElementById('detail-sls-list');
    data.slsList.forEach((sls) => {
        const card = document.createElement('div');
        card.className = 'sls-detail-card';
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

    // Render Anomaly Cards
    const anomalyContainer = document.getElementById('detail-anomaly-list');
    if (anomalyContainer) {
        const anomalies = data.anomaliList || [];
        if (anomalies.length === 0) {
            anomalyContainer.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--text-dim); font-size: 11px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px dashed rgba(255,255,255,0.08);">
                    <i class="ri-checkbox-circle-line" style="font-size: 16px; color: #10b981; display: block; margin-bottom: 4px;"></i>
                    Bersih dari anomali data
                </div>
            `;
        } else {
            // Sort by Nama KRT ascending
            const sortedAnom = [...anomalies].sort((a, b) => {
                const nameA = (a.namaKrt || '').toLowerCase();
                const nameB = (b.namaKrt || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });
            
            sortedAnom.forEach(anom => {
                const card = document.createElement('div');
                card.className = 'sls-detail-card'; // Reuse premium card styling
                card.style.borderLeft = anom.isDone ? '3px solid #10b981' : '3px solid #ef4444';
                
                const badgeTL = anom.isDone 
                    ? `<span style="font-size: 9px; padding: 2px 6px; border-radius: 4px; background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 600; display: inline-flex; align-items: center; gap: 3px;"><i class="ri-checkbox-circle-line"></i> Selesai</span>`
                    : `<span style="font-size: 9px; padding: 2px 6px; border-radius: 4px; background: rgba(239, 68, 68, 0.15); color: #ef4444; font-weight: 600; display: inline-flex; align-items: center; gap: 3px;"><i class="ri-alert-line"></i> Belum</span>`;
                
                const badgeJenis = anom.type === 'usaha'
                    ? `<span style="font-size: 9px; padding: 2px 6px; border-radius: 4px; background: rgba(59, 130, 246, 0.15); color: #3b82f6; font-weight: 600; text-transform: uppercase; display: inline-flex; align-items: center; gap: 3px;"><i class="ri-store-2-line"></i> Usaha</span>`
                    : `<span style="font-size: 9px; padding: 2px 6px; border-radius: 4px; background: rgba(168, 85, 247, 0.15); color: #a855f7; font-weight: 600; text-transform: uppercase; display: inline-flex; align-items: center; gap: 3px;"><i class="ri-home-heart-line"></i> Keluarga</span>`;

                card.innerHTML = `
                    <div class="sls-card-header" style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                        <div style="min-width: 0; flex: 1;">
                            <div class="sls-card-title" style="font-size: 11px; font-weight: 700; color: var(--text-title); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${anom.namaKrt || 'N/A'}">${anom.namaKrt || 'N/A'}</div>
                            <div style="font-size: 9px; color: var(--text-dim); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="Kec. ${anom.nmkec || '-'}, Desa ${anom.nmdesa || '-'}">
                                <i class="ri-map-pin-line"></i> Kec. ${anom.nmkec || '-'}, Desa ${anom.nmdesa || '-'}
                            </div>
                        </div>
                        <div style="display:flex; gap:4px; align-items:center; flex-shrink:0;">
                            ${badgeJenis}
                            ${badgeTL}
                        </div>
                    </div>
                    <div style="margin-top: 6px; font-size: 10px; color: var(--text-muted); line-height: 1.35; background: rgba(0,0,0,0.1); padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.03); display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                        <div style="min-width: 0; flex: 1;">
                            <strong style="color: var(--text-dim);">Masalah:</strong> ${anom.namaAnomali || 'Tidak ada deskripsi'}
                        </div>
                        ${anom.linkFasih && (anom.linkFasih.startsWith('http://') || anom.linkFasih.startsWith('https://')) ? `
                            <a href="${anom.linkFasih}" target="_blank" style="display: inline-flex; align-items: center; gap: 3px; padding: 4px 8px; background: linear-gradient(135deg, #3b82f6, #2563eb); color: #fff; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 9px; white-space: nowrap; transition: all 0.2s; box-shadow: 0 2px 4px rgba(37,99,235,0.25);">
                                <i class="ri-external-link-line" style="font-size: 10px;"></i> Fasih
                            </a>
                        ` : ''}
                    </div>
                `;
                anomalyContainer.appendChild(card);
            });
        }
    }
}

function exportOverviewToExcel() {
    const wb = XLSX.utils.book_new();
    const ws_data = [];

    // ── Helper to push blank separator ──────────────────
    const blank = (n = 1) => { for (let i = 0; i < n; i++) ws_data.push([]); };

    // ── Compute totals ──────────────────────────────────
    let globalTarget = 0, gOpen = 0, gDraft = 0, gSub = 0, gApp = 0, gRej = 0, gRev = 0;
    for (const email in petugasData) {
        const p = petugasData[email];
        globalTarget += p.totalTarget; gOpen += p.open; gDraft += p.draft;
        gSub += p.submitted; gApp += p.approved; gRej += p.rejected; gRev += p.revoked;
    }
    const tersubmit  = globalTarget - gOpen - gDraft;
    const pctDone    = globalTarget > 0 ? (tersubmit  / globalTarget * 100).toFixed(2) : 0;
    const pctOpen    = globalTarget > 0 ? (gOpen  / globalTarget * 100).toFixed(2) : 0;
    const pctDraft   = globalTarget > 0 ? (gDraft / globalTarget * 100).toFixed(2) : 0;
    const pctSub     = globalTarget > 0 ? (gSub   / globalTarget * 100).toFixed(2) : 0;
    const pctApp     = globalTarget > 0 ? (gApp   / globalTarget * 100).toFixed(2) : 0;
    const pctRej     = globalTarget > 0 ? (gRej   / globalTarget * 100).toFixed(2) : 0;
    const pctRev     = globalTarget > 0 ? (gRev   / globalTarget * 100).toFixed(2) : 0;
    const lastSync   = document.getElementById('last-sync')?.innerText || '-';
    const exportTime = new Date().toLocaleString('id-ID');

    // ════════════════════════════════════════════════════
    // SECTION 1 — HEADER
    // ════════════════════════════════════════════════════
    ws_data.push(['DASHBOARD SE2026 - BPS KABUPATEN HALMAHERA UTARA']);
    ws_data.push([`Terakhir Sync GSheet: ${lastSync}`]);
    ws_data.push([`Waktu Export: ${exportTime}`]);
    blank(1);

    // ════════════════════════════════════════════════════
    // SECTION 2 — KPI RINGKASAN
    // ════════════════════════════════════════════════════
    const uStats = window.statsAnomaliUsaha || { done: 0, total: 0 };
    const kStats = window.statsAnomaliKeluarga || { done: 0, total: 0 };
    const totalAnomDone = uStats.done + kStats.done;
    const totalAnomTotal = uStats.total + kStats.total;
    const pctAnom = totalAnomTotal > 0 ? (totalAnomDone / totalAnomTotal * 100).toFixed(2) : 0;
    const pctAnomUsaha = uStats.total > 0 ? (uStats.done / uStats.total * 100).toFixed(2) : 0;
    const pctAnomKeluarga = kStats.total > 0 ? (kStats.done / kStats.total * 100).toFixed(2) : 0;

    ws_data.push(['A. RINGKASAN KPI']);
    ws_data.push(['Indikator', 'Jumlah', 'Persentase']);
    ws_data.push(['Total Target SLS', globalTarget, '100%']);
    ws_data.push(['Assignment Tersubmit (Non Open/Draft)', tersubmit, `${pctDone}%`]);
    ws_data.push(['Total Rekap Anomali (Tuntas/Total)', `${totalAnomDone}/${totalAnomTotal}`, `${pctAnom}%`]);
    ws_data.push(['  - Anomali Usaha', `${uStats.done}/${uStats.total}`, `${pctAnomUsaha}%`]);
    ws_data.push(['  - Anomali Keluarga', `${kStats.done}/${kStats.total}`, `${pctAnomKeluarga}%`]);
    blank(1);
    ws_data.push(['Detail Status Distribusi']);
    ws_data.push(['Status', 'Jumlah', 'Persentase (%)']);
    ws_data.push(['OPEN',      gOpen,  pctOpen]);
    ws_data.push(['DRAFT',     gDraft, pctDraft]);
    ws_data.push(['SUBMITTED', gSub,   pctSub]);
    ws_data.push(['REJECTED',  gRej,   pctRej]);
    ws_data.push(['REVOKED',   gRev,   pctRev]);
    ws_data.push(['APPROVED',  gApp,   pctApp]);
    blank(2);

    // ════════════════════════════════════════════════════
    // SECTION 3 — PROGRES PETUGAS (PCL)
    // ════════════════════════════════════════════════════
    ws_data.push(['B. PROGRES PETUGAS (PCL)']);
    ws_data.push(['Nama Petugas', 'PJ Kecamatan', 'Total Target', 'Tersubmit', '% Tersubmit', 'Submitted', 'Approved', 'Rejected', 'Revoked', 'Draft', 'Open', 'Anomali (X/Y)']);
    const pList = Object.values(petugasData).map(p => {
        const ts = p.totalTarget - p.open - p.draft;
        const pct = p.totalTarget > 0 ? (ts / p.totalTarget * 100).toFixed(2) : 0;
        return { ...p, ts, pct };
    }).sort((a, b) => b.ts - a.ts);
    pList.forEach(p => {
        const anomStr = `${p.anomaliDone || 0}/${p.anomaliTotal || 0}`;
        ws_data.push([p.namaLengkap, p.koseka, p.totalTarget, p.ts, parseFloat(p.pct), p.submitted, p.approved, p.rejected, p.revoked, p.draft, p.open, anomStr]);
    });
    blank(2);

    // ════════════════════════════════════════════════════
    // SECTION 4 — PROGRES KECAMATAN
    // ════════════════════════════════════════════════════
    ws_data.push(['C. PROGRES KECAMATAN']);
    ws_data.push(['Kecamatan', 'Jml SLS', 'Total Target', 'Tersubmit', '% Tersubmit', 'Submitted', 'Approved', 'Rejected', 'Revoked', 'Draft', 'Open', 'Anomali (X/Y)']);
    const kList = Object.values(kecamatanData).map(k => {
        const ts = k.totalTarget - k.open - k.draft;
        const pct = k.totalTarget > 0 ? (ts / k.totalTarget * 100).toFixed(2) : 0;
        return { ...k, ts, pct };
    }).sort((a, b) => b.ts - a.ts);
    kList.forEach(k => {
        const anomStr = `${k.anomaliDone || 0}/${k.anomaliTotal || 0}`;
        ws_data.push([k.kecamatan, k.slsCount, k.totalTarget, k.ts, parseFloat(k.pct), k.submitted, k.approved, k.rejected, k.revoked, k.draft, k.open, anomStr]);
    });
    blank(2);

    // ════════════════════════════════════════════════════
    // SECTION 5 — PROGRES PJ KECAMATAN
    // ════════════════════════════════════════════════════
    ws_data.push(['D. PROGRES PJ KECAMATAN']);
    ws_data.push(['Nama PJ Kecamatan', 'Total Target', '% Pendataan', '% Submit', '% Approve', 'Anomali (X/Y)']);
    const pjList = Object.keys(kosekaData).map(k => {
        const d = kosekaData[k];
        const total = d.totalTarget || 0;
        if (total === 0) return null;
        return {
            name: k, total,
            pendataan: parseFloat(((total - d.open) / total * 100).toFixed(2)),
            submit:    parseFloat((d.submitted / total * 100).toFixed(2)),
            approve:   parseFloat((d.approved  / total * 100).toFixed(2)),
            anomaliDone: d.anomaliDone || 0,
            anomaliTotal: d.anomaliTotal || 0
        };
    }).filter(Boolean).sort((a, b) => b.pendataan - a.pendataan);
    pjList.forEach(p => {
        ws_data.push([p.name, p.total, p.pendataan, p.submit, p.approve, `${p.anomaliDone}/${p.anomaliTotal}`]);
    });
    blank(2);

    // ════════════════════════════════════════════════════
    // SECTION 6 — PROGRES PML
    // ════════════════════════════════════════════════════
    ws_data.push(['E. PROGRES PML (PENGAWAS LAPANGAN)']);
    ws_data.push(['Nama PML', 'Total Target', '% Pendataan', '% Submit', '% Approve', 'Anomali (X/Y)']);
    const pmlList = Object.keys(pmlData).map(p => {
        const d = pmlData[p];
        const total = d.totalTarget || 0;
        if (total === 0) return null;
        return {
            name: p, total,
            pendataan: parseFloat(((total - d.open) / total * 100).toFixed(2)),
            submit:    parseFloat((d.submitted / total * 100).toFixed(2)),
            approve:   parseFloat((d.approved  / total * 100).toFixed(2)),
            anomaliDone: d.anomaliDone || 0,
            anomaliTotal: d.anomaliTotal || 0
        };
    }).filter(Boolean).sort((a, b) => b.pendataan - a.pendataan);
    pmlList.forEach(p => {
        ws_data.push([p.name, p.total, p.pendataan, p.submit, p.approve, `${p.anomaliDone}/${p.anomaliTotal}`]);
    });

    // ════════════════════════════════════════════════════
    // BUILD SHEET & APPLY STYLES
    // ════════════════════════════════════════════════════
    const ws = XLSX.utils.aoa_to_sheet(ws_data);

    // Column widths
    ws['!cols'] = [
        { wch: 38 }, // A
        { wch: 20 }, // B
        { wch: 15 }, // C
        { wch: 13 }, // D
        { wch: 15 }, // E
        { wch: 12 }, // F
        { wch: 12 }, // G
        { wch: 12 }, // H
        { wch: 12 }, // I
        { wch: 10 }, // J
        { wch: 10 }, // K
    ];

    // Merge title cells A1:K1
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } },
    ];

    // Apply cell styles using xlsx-js-style
    const totalRows = ws_data.length;
    for (let r = 0; r < totalRows; r++) {
        const row = ws_data[r];
        if (!row) continue;
        
        let isSection = false;
        let isHeader = false;
        let isTitle = r < 3;
        
        if (row[0] && typeof row[0] === 'string') {
            if (row[0].match(/^[A-E]\. /) || row[0] === 'Detail Status Distribusi') isSection = true;
            if (row[0] === 'Indikator' || row[0] === 'Status' || row[0] === 'Nama Petugas' || row[0] === 'Kecamatan' || row[0] === 'Nama PJ Kecamatan' || row[0] === 'Nama PML') isHeader = true;
        }

        row.forEach((cell, c) => {
            const addr = XLSX.utils.encode_cell({ r, c });
            if (ws[addr]) {
                if (typeof cell === 'number' && !String(ws_data[r][c]).includes('Persentase')) {
                    ws[addr].t = 'n';
                }
                
                let cellStyle = {
                    font: { name: "Arial", sz: 10, color: { rgb: "333333" } },
                    alignment: { vertical: "center" }
                };

                if (isTitle) {
                    cellStyle.font.bold = true;
                    if (r === 0) cellStyle.font.sz = 14;
                    cellStyle.font.color = { rgb: "111827" };
                } else if (isSection) {
                    cellStyle.font.bold = true;
                    cellStyle.font.sz = 11;
                    cellStyle.font.color = { rgb: "4F46E5" };
                    cellStyle.fill = { fgColor: { rgb: "EEF2FF" } };
                    cellStyle.border = { bottom: { style: "medium", color: { rgb: "4F46E5" } } };
                } else if (isHeader) {
                    cellStyle.font.bold = true;
                    cellStyle.font.color = { rgb: "FFFFFF" };
                    cellStyle.fill = { fgColor: { rgb: "6366F1" } };
                    cellStyle.alignment.horizontal = "center";
                } else if (cell !== undefined && cell !== '') {
                    cellStyle.border = {
                        top: { style: "thin", color: { rgb: "E5E7EB" } },
                        bottom: { style: "thin", color: { rgb: "E5E7EB" } },
                        left: { style: "thin", color: { rgb: "E5E7EB" } },
                        right: { style: "thin", color: { rgb: "E5E7EB" } }
                    };
                    if (c > 0 && !isHeader && !isSection && !isTitle && typeof cell === 'number') {
                         cellStyle.alignment.horizontal = "center";
                    }
                }
                
                ws[addr].s = cellStyle;
            }
        });
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Overview');

    // Download
    const lastSyncStr = document.getElementById('last-sync')?.innerText || 'UnknownTime';
    let safeStamp = 'UnknownTime';
    let dtMatch = lastSyncStr.match(/(\d{1,4})/g);
    if (dtMatch && dtMatch.length >= 5) {
        let y = dtMatch.find(d => d.length === 4) || new Date().getFullYear().toString();
        let d, m, h, mn;
        if (dtMatch[2] === y) {
            d = dtMatch[0].padStart(2, '0');
            m = dtMatch[1].padStart(2, '0');
        } else if (dtMatch[0] === y) {
            m = dtMatch[1].padStart(2, '0');
            d = dtMatch[2].padStart(2, '0');
        } else {
            d = dtMatch[0].padStart(2, '0');
            m = dtMatch[1].padStart(2, '0');
        }
        h = dtMatch[3].padStart(2, '0');
        mn = dtMatch[4].padStart(2, '0');
        safeStamp = `${y}${m}${d}_${h}${mn}`;
    }
    XLSX.writeFile(wb, `Rekap_SE2026_Halut_${safeStamp}.xlsx`);
}

// ================================================================
// Custom Select Logic for Glassmorphism UI
// ================================================================
function applyCustomSelect(select) {
    let wrapper = select.nextElementSibling;
    if (wrapper && wrapper.classList.contains('custom-select-wrapper')) {
        wrapper.remove(); // rebuild on options change
    }
    
    select.style.display = 'none';
    
    wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper';
    
    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger glass-select';
    
    const textSpan = document.createElement('span');
    textSpan.textContent = select.options[select.selectedIndex]?.textContent || '';
    
    const icon = document.createElement('i');
    icon.className = 'ri-arrow-down-s-line';
    
    trigger.appendChild(textSpan);
    trigger.appendChild(icon);
    
    const optionsPanel = document.createElement('div');
    optionsPanel.className = 'custom-select-options glass-panel-inner';
    
    Array.from(select.options).forEach((opt, idx) => {
        const optDiv = document.createElement('div');
        optDiv.className = 'custom-option' + (opt.selected ? ' selected' : '');
        optDiv.textContent = opt.textContent;
        optDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            select.selectedIndex = idx;
            select.dispatchEvent(new Event('change'));
            
            textSpan.textContent = opt.textContent;
            optionsPanel.classList.remove('open');
            trigger.classList.remove('open');
            Array.from(optionsPanel.children).forEach(c => c.classList.remove('selected'));
            optDiv.classList.add('selected');
        });
        optionsPanel.appendChild(optDiv);
    });
    
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = optionsPanel.classList.contains('open');
        document.querySelectorAll('.custom-select-options').forEach(p => p.classList.remove('open'));
        document.querySelectorAll('.custom-select-trigger').forEach(p => p.classList.remove('open'));
        if (!isOpen) {
            optionsPanel.classList.add('open');
            trigger.classList.add('open');
        }
    });
    
    wrapper.appendChild(trigger);
    wrapper.appendChild(optionsPanel);
    select.parentNode.insertBefore(wrapper, select.nextSibling);
    
    if (!select.dataset.customized) {
        select.dataset.customized = "true";
        select.addEventListener('change', () => {
             const w = select.nextElementSibling;
             if(w && w.classList.contains('custom-select-wrapper')) {
                 w.querySelector('span').textContent = select.options[select.selectedIndex]?.textContent || '';
                 Array.from(w.querySelectorAll('.custom-option')).forEach((optEl, i) => {
                     optEl.classList.toggle('selected', i === select.selectedIndex);
                 });
             }
        });
    }
}

document.addEventListener('click', () => {
    document.querySelectorAll('.custom-select-options').forEach(p => p.classList.remove('open'));
    document.querySelectorAll('.custom-select-trigger').forEach(p => p.classList.remove('open'));
});

function setupMobileMenu() {
    const btnBurger = document.getElementById('btn-burger');
    const btnCloseSidebar = document.getElementById('btn-close-sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebar = document.querySelector('.sidebar');
    
    if (btnBurger && sidebar) {
        btnBurger.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.add('open');
            if (sidebarOverlay) {
                sidebarOverlay.classList.add('active');
            }
        });
    }
    
    const closeMenu = () => {
        if (sidebar) sidebar.classList.remove('open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    };
    
    if (btnCloseSidebar) {
        btnCloseSidebar.addEventListener('click', closeMenu);
    }
    
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeMenu);
    }
    
    // Close sidebar on nav item click in mobile
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                closeMenu();
            }
        });
    });
}
