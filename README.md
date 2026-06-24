# Webmon SE2026

Webmon SE2026 adalah *dashboard monitoring* dan *Hierarchy Explorer* yang dirancang untuk memantau progres lapangan Sensus Ekonomi 2026 (SE2026) BPS secara *real-time* maupun periodik. 

Proyek ini terdiri dari dua bagian utama:
1. **Frontend Webmon**: Berupa folder `webmon/` yang sepenuhnya statis (HTML, CSS, JS murni tanpa *framework* berat) sehingga dapat berjalan sangat ringan di mana saja, termasuk *GitHub Pages*.
2. **Data Pipeline**: Berupa skrip Python `scrape_rekap_api.py` yang bertugas mengambil data terbaru langsung dari *endpoint* API secara terprogram.

---

## 📂 Struktur Repositori

Jika Anda mem-*push* ke GitHub, Anda **disarankan untuk tetap mem-*push* keseluruhan root ini** (tidak hanya folder `webmon` saja), agar skrip *scraper* untuk meng-update data tidak hilang.

```text
/ (root)
├── .gitignore                   # Mengabaikan file temporary seperti CSV dan cache
├── README.md                    # Dokumentasi ini
├── scrape_rekap_api.py          # Skrip Python untuk Sinkronisasi Data (Pipeline)
└── webmon/                      # Folder Utama Aplikasi Web (Frontend)
    ├── index.html               # Halaman utama Webmon
    ├── css/style.css            # Gaya tampilan web (Glassmorphism & Responsif)
    ├── js/app.js                # Logika utama (parsing, kalkulasi KPI, render UI)
    └── data/rekap_data.json     # Data JSON sumber (diperbarui oleh skrip Python)
```

---

## 🚀 Cara Menjalankan

### 1. Menjalankan Dashboard (Frontend)
Karena keseluruhan aplikasi `webmon` bersifat statis, Anda dapat menjalankannya dengan cara:
- **Local:** Menggunakan ekstensi *Live Server* di VS Code, atau menjalankan perintah Python sederhana: `python -m http.server 8000`. Kemudian buka browser dan akses `http://localhost:8000/webmon/index.html`.
- **Online (Hosting):** Jika repositori ini telah di-*push* ke GitHub, Anda dapat mengaktifkan **GitHub Pages** dengan mengarahkan *source* ke folder `/webmon` untuk hosting secara gratis dan otomatis.

### 2. Memperbarui Data (Sinkronisasi via Scraper Python)
Data di dashboard tidak akan berubah sebelum Anda memperbarui file `rekap_data.json`. Untuk menarik data terbaru dari server:

1. **Pastikan Chrome Berjalan dalam Mode Debugging**
   Anda harus membuka Google Chrome dari terminal/cmd dengan *flag* debugging aktif:
   ```bash
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
   ```
2. **Buka Web Fasih BPS**
   Di Chrome yang baru terbuka tersebut, buka halaman web aplikasi *Fasih* (misal: `https://fasih-sm.bps.go.id/`) dan pastikan Anda sudah **Login**.
3. **Jalankan Skrip**
   Buka terminal di root proyek ini, lalu jalankan:
   ```bash
   python scrape_rekap_api.py
   ```
   *Skrip ini akan memanfaatkan koneksi Playwright ke Chrome lokal Anda untuk mem-*bypass* login dan menarik data API secara berhalaman (pagination), kemudian memprosesnya dan menimpanya ke `webmon/data/rekap_data.json` secara otomatis.*

---

## 🎨 Fitur Utama Dashboard
- **Glassmorphism UI:** Desain antarmuka modern yang memadukan latar belakang blur, warna gradien cerah, dan transparansi kaca untuk kesan elegan.
- **Responsivitas Tinggi:** Tata letak *fluid* yang secara otomatis menyesuaikan untuk desktop lebar, maupun layar sempit *mobile* (menampilkan *bottom navigation bar* ala aplikasi native).
- **Sonoma Hierarchy Explorer:** Navigasi interaktif berjenjang. Memilih Koseka (Koordinator Kecamatan) akan memunculkan PML di bawahnya. Memilih PML akan memunculkan PCL. Memilih PCL akan memunculkan Rincian Target Muatan.

---

**Catatan Git:** File `.gitignore` telah dikonfigurasi untuk secara otomatis mengabaikan file hasil sementara (`hasil_rekap_petugas.csv`) dan konfigurasi environment Python (seperti `__pycache__` atau `.venv`), sehingga repositori Anda akan tetap bersih saat di-*push* ke GitHub.
