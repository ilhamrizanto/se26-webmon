const https = require('https');

const SPREADSHEET_ID = "1a0t9gkPRg7DfDOXg2Rrl95byK8bKrfiikMfObgRfjBY";
const SHEET_CATATAN_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Catatan`;

https.get(SHEET_CATATAN_URL, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log("CSV length:", data.length);
    console.log("First 300 chars:", data.substring(0, 300));
    
    // Parse like app.js
    const rows = data.split('\n').map(r => r.split(',').map(c => c.replace(/^"|"$/g, '')));
    console.log("Total rows:", rows.length);
    if(rows.length > 1) {
        console.log("Row 0:", rows[0]);
        console.log("Row 1:", rows[1]);
        console.log("Row 2:", rows[2]);
    }
  });
}).on('error', (err) => {
  console.log("Error: " + err.message);
});
