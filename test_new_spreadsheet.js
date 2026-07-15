const https = require('https');

const SPREADSHEET_ID = "1hfzqBgXF9yAYaB7vP-g-cUSNVfXJmrqXk0Ue9FUveo8";
const SHEET_CATATAN = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Catatan`;
const SHEET_TUTUP = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Catatan%20Tutup`;
const SHEET_TDK = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Catatan%20Tidak%20Ditemukan`;

function fetchCSV(url, name) {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const rows = data.split('\n').map(r => r.split(',').map(c => c.replace(/^"|"$/g, '')));
        console.log(`\n--- ${name} ---`);
        console.log("Total rows:", rows.length);
        if(rows.length > 0) {
            console.log("Row 0:", rows[0]);
            if(rows.length > 1) console.log("Row 1:", rows[1]);
        }
      });
    }).on('error', (err) => {
      console.log("Error: " + err.message);
    });
}

fetchCSV(SHEET_CATATAN, "Catatan");
fetchCSV(SHEET_TUTUP, "Catatan Tutup");
fetchCSV(SHEET_TDK, "Catatan Tidak Ditemukan");
