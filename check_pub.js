const https = require('https');

const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS8zmGV9jv3ZyqGjAdg-Y-ft-_qOzKMR7Xba3T_SMKFppkvGccciTOYfyBYwuQXuEI-OA1VyL-b_1zr/pubhtml';

https.get(url, (res) => {
  let html = '';
  res.on('data', (d) => html += d);
  res.on('end', () => {
    const regex = /<li id="sheet-button-.*?>(.*?)<\/li>/g;
    let match;
    const sheets = [];
    while ((match = regex.exec(html)) !== null) {
      sheets.push(match[1].replace(/<[^>]+>/g, '').trim());
    }
    console.log("Published Sheets:", sheets);
  });
});
