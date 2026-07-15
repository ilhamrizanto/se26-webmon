const https = require('https');

const url = 'https://docs.google.com/spreadsheets/d/1hfzqBgXF9yAYaB7vP-g-cUSNVfXJmrqXk0Ue9FUveo8/edit?usp=sharing';

https.get(url, (res) => {
  let html = '';
  res.on('data', (d) => html += d);
  res.on('end', () => {
    const matches = [...html.matchAll(/"name":"(.*?)"/g)];
    const sheets = new Set(matches.map(m => m[1]));
    console.log("Found Sheets:", Array.from(sheets));
  });
});
