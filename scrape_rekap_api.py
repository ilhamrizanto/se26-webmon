import configparser
import csv
import json
import os
import re
import time
import subprocess
from playwright.sync_api import sync_playwright

def load_config():
    config_file = "config.txt"
    if not os.path.exists(config_file):
        with open(config_file, "w") as f:
            f.write("[Config]\n")
            f.write("username = \n")
            f.write("password = \n")
            f.write("target_url = https://fasih-sm.bps.go.id/app/surveys/b0cb30f1-bd3b-4c46-a7b4-eb3f8cfff9e7/c3ed3362-c12c-49f0-a1ad-60ed7e273e51\n")
            f.write("survey_role_id = \n")
        print(f"File {config_file} dibuat. Silakan isi kredensial Anda lalu jalankan ulang script.")
        return None
        
    config = configparser.ConfigParser()
    config.read(config_file)
    return config['Config']

def launch_real_chrome():
    chrome_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Users\TECNO\AppData\Local\Google\Chrome\Application\chrome.exe"
    ]
    
    executable = None
    for path in chrome_paths:
        if os.path.exists(path):
            executable = path
            break
            
    if not executable:
        print("Google Chrome asli tidak ditemukan di sistem Anda.")
        return False
        
    user_data_dir = os.path.join(os.getcwd(), "chrome_debug_data")
    if not os.path.exists(user_data_dir):
        os.makedirs(user_data_dir)
        
    print(f"Membuka Chrome asli secara otomatis (Anti-Bot) dari: {executable}")
    try:
        subprocess.Popen([
            executable,
            "--remote-debugging-port=9222",
            f"--user-data-dir={user_data_dir}",
            "--no-first-run",
            "--no-default-browser-check"
        ])
        time.sleep(3) # Wait for Chrome to initialize
        return True
    except Exception as e:
        print(f"Gagal membuka Chrome: {e}")
        return False

def run():
    print("=== Fasih Scraping Tool (Anti-Bot Mode) ===")
    
    config = load_config()
    if not config:
        return
        
    username = config.get("username", "")
    password = config.get("password", "")
    target_url = config.get("target_url", "")
    survey_role_id = config.get("survey_role_id", "")
    
    uuids = re.findall(r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', target_url)
    if len(uuids) < 2:
        print("Error: URL target di config.txt tidak valid (harus mengandung Survey ID dan Period ID).")
        return
        
    survey_id = uuids[0]
    survey_period_id = uuids[1]
    
    with sync_playwright() as p:
        # Hubungkan ke Chrome asli via CDP (menghindari deteksi Bot)
        try:
            browser = p.chromium.connect_over_cdp("http://localhost:9222")
            print("Berhasil terhubung ke Chrome yang sudah berjalan.")
        except Exception:
            print("Chrome Debug belum berjalan. Menjalankan Chrome...")
            if launch_real_chrome():
                try:
                    browser = p.chromium.connect_over_cdp("http://localhost:9222")
                    print("Berhasil terhubung ke Chrome.")
                except Exception as e:
                    print("Gagal terhubung ke CDP setelah Chrome dibuka:", e)
                    return
            else:
                return

        context = browser.contexts[0]
        page = context.pages[0] if len(context.pages) > 0 else context.new_page()
        
        print("Navigasi ke halaman Login Fasih...")
        try:
            # Go to oauth_login.html first to avoid direct-link bot detection
            page.goto("https://fasih-sm.bps.go.id/oauth_login.html", timeout=30000, wait_until="domcontentloaded")
            
            # Click Login SSO BPS button if it's there
            print("Mencari tombol Login SSO BPS...")
            try:
                page.locator("text=SSO BPS").first.click(timeout=5000)
            except Exception:
                try:
                    page.click("//*[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'sso bps')]", timeout=5000)
                except Exception:
                    pass # Maybe already logged in
                
            # Now we should be on SSO BPS page
            if "sso.bps.go.id" in page.url:
                print("Berada di halaman login SSO. Melakukan pengisian kredensial otomatis...")
                if not username or not password:
                    print("Username atau password di config.txt kosong! Silakan isi terlebih dahulu.")
                    return
                    
                page.fill('input[name="username"]', username)
                page.fill('input[name="password"]', password)
                page.click('button[type="submit"], input[type="submit"]')
                
                print("Menunggu proses login selesai...")
                try:
                    page.wait_for_url(lambda url: "fasih-sm.bps.go.id" in url, timeout=15000)
                except Exception:
                    print("Timeout menunggu redirect login. Kita coba paksa lanjut...")
                    time.sleep(3)
        except Exception as e:
            print("Terjadi sedikit masalah saat auto-login:", e)
            print("Script akan tetap memaksa lanjut ke target URL...")

        print("Menavigasi ke URL target dasbor kegiatan (menunggu hingga 3 menit)...")
        try:
            page.goto(target_url, timeout=180000, wait_until="domcontentloaded")
        except Exception as e:
            print("Peringatan saat load URL target:", e)
                
        if not survey_role_id:
            print("\n[Otomasi Penuh Aktif] survey_role_id tidak ditemukan di config.txt.")
            print(">>> MENCARI ROLE ID SECARA OTOMATIS (Sabar, server BPS lambat) <<<")
            
            try:
                print("Menunggu elemen 'Rekap Petugas' muncul di layar...")
                
                # Robust JS click for Rekap Petugas
                js_click_rekap = """
                () => {
                    let els = Array.from(document.querySelectorAll('*'));
                    let target = els.find(e => e.textContent && e.textContent.trim() === 'Rekap Petugas' && e.children.length === 0);
                    if (!target) {
                        target = els.find(e => e.textContent && e.textContent.includes('Rekap Petugas') && e.tagName !== 'SCRIPT' && e.tagName !== 'STYLE');
                    }
                    if (target) {
                        target.click();
                        if(target.parentElement) target.parentElement.click();
                        return true;
                    }
                    return false;
                }
                """
                
                # Polling for Rekap Petugas up to 2 minutes
                rekap_clicked = False
                for i in range(60):
                    if page.evaluate(js_click_rekap):
                        rekap_clicked = True
                        break
                    time.sleep(2)
                    
                if not rekap_clicked:
                    print("Peringatan: Gagal menemukan elemen 'Rekap Petugas' setelah 2 menit menunggu.")
                else:
                    print("✅ Berhasil mengklik 'Rekap Petugas'!")
                
                print("Menunggu tab termuat (memberi jeda 5 detik)...")
                page.wait_for_timeout(5000)
                
                print("Menunggu elemen 'Pencacah' muncul di layar dan menangkap request API...")
                # Robust JS click for Pencacah
                js_click_pencacah = """
                () => {
                    let els = Array.from(document.querySelectorAll('*'));
                    let target = els.find(e => e.textContent && e.textContent.trim() === 'Pencacah' && e.children.length === 0);
                    if (!target) {
                        target = els.find(e => e.textContent && e.textContent.includes('Pencacah') && e.tagName !== 'SCRIPT' && e.tagName !== 'STYLE');
                    }
                    if (target) {
                        target.click();
                        if(target.parentElement) target.parentElement.click();
                        return true;
                    }
                    return false;
                }
                """
                
                # We need to expect the request simultaneously with the click. 
                # Since we are polling, we can start the expect_request in the background, 
                # or we just poll until the element is FOUND, and then click it inside expect_request.
                
                js_check_pencacah = """
                () => {
                    let els = Array.from(document.querySelectorAll('*'));
                    let target = els.find(e => e.textContent && e.textContent.trim() === 'Pencacah' && e.children.length === 0);
                    if (!target) {
                        target = els.find(e => e.textContent && e.textContent.includes('Pencacah') && e.tagName !== 'SCRIPT' && e.tagName !== 'STYLE');
                    }
                    return target ? true : false;
                }
                """
                
                pencacah_found = False
                for i in range(30):
                    if page.evaluate(js_check_pencacah):
                        pencacah_found = True
                        break
                    time.sleep(2)
                    
                if pencacah_found:
                    print("Elemen 'Pencacah' ditemukan! Mengklik dan menangkap network request...")
                    with page.expect_request(lambda request: "report-progress-by-responsibility" in request.url and request.method == "POST", timeout=60000) as req_info:
                        page.evaluate(js_click_pencacah)
                    
                    req = req_info.value
                    captured_payload = json.loads(req.post_data)
                    survey_role_id = captured_payload.get('surveyRoleId', '')
                    print(f"✅ Request Pencacah tertangkap! Role ID: {survey_role_id}")
                    base_payload = captured_payload
                else:
                    print("Peringatan: Tidak menemukan elemen 'Pencacah'. Script akan gagal.")
                    return
            except Exception as e:
                print(f"Gagal mengklik otomatis atau menangkap request: {e}")
                return
        else:
            print(f"Menggunakan Role ID dari config.txt: {survey_role_id}")
            # Create a standard payload
            base_payload = {
                "surveyPeriodId": survey_period_id,
                "surveyRoleId": survey_role_id,
                "size": 10,
                "page": 0,
                "search": "",
                "target": "TARGET_ONLY",
                "region": {
                    "region1Id": None, "region2Id": None, "region3Id": None,
                    "region4Id": None, "region5Id": None, "region6Id": None,
                    "region7Id": None, "region8Id": None, "region9Id": None, "region10Id": None
                },
                "regionSummaryLevel": 6
            }
            
        print("\nMengambil halaman data rekap secara bertahap (Sistem Anti-Lemot & Retry)...")
        
        js_fetch_single = """
        async ([basePayload, pageIndex]) => {
            const getCookie = (name) => {
                const value = `; ${document.cookie}`;
                const parts = value.split(`; ${name}=`);
                if (parts.length === 2) return parts.pop().split(';').shift();
                return '';
            };
            
            const xsrf = decodeURIComponent(getCookie('XSRF-TOKEN'));
            const url = '/app/api/analytic/api/v2/assignment/report-progress-by-responsibility';
            const pageSize = basePayload.size || 10;
            
            let payload = { ...basePayload, page: pageIndex, size: pageSize };
            
            let response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-xsrf-token': xsrf
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                let errText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errText.substring(0, 50)}`);
            }
            
            return await response.json();
        }
        """
        
        all_records = []
        current_page = 0
        is_last = False
        
        while not is_last:
            success = False
            retries = 3
            while retries > 0 and not success:
                try:
                    print(f"Memproses Halaman {current_page + 1}... ", end="", flush=True)
                    data = page.evaluate(js_fetch_single, [base_payload, current_page])
                    
                    if data.get("success") and data.get("data") and data.get("data").get("content") is not None:
                        content = data["data"]["content"]
                        all_records.extend(content)
                        is_last = data["data"]["last"]
                        print(f"✅ Sukses! (+{len(content)} baris. Total: {len(all_records)})")
                        success = True
                    else:
                        print("Tidak ada data. (Selesai)")
                        is_last = True
                        success = True
                except Exception as e:
                    retries -= 1
                    err_msg = str(e)
                    print(f"\n⚠️ Gagal: Server Fasih lambat atau timeout (Sisa percobaan: {retries}).")
                    if retries > 0:
                        print("Menunggu 5 detik sebelum mencoba lagi...")
                        time.sleep(5)
                    else:
                        print(f"❌ Error detail: {err_msg}")
            
            if not success:
                print(f"\n❌ TERHENTI di Halaman {current_page + 1} karena server Fasih terus-menerus gagal merespons.")
                print("Menyimpan data yang berhasil dikumpulkan sejauh ini...")
                break
                
            current_page += 1
            if current_page > 500: # Infinite loop safety
                break
                
        if not all_records:
            print("Tidak ada data yang ditemukan untuk disave.")
            return
            
        output_filename = "hasil_rekap_petugas.csv"
        print(f"Menulis data ke {output_filename}...")
        
        first_record = all_records[0]
        fieldnames = [
            "regionId", "regionName", "username", "name", 
            "surveyRoleId", "surveyRoleName", "totalTarget", 
            "totalOpen", "totalDraft", "totalSubmitted", 
            "totalRejected", "totalApproved", "assignmentStatus"
        ]
        
        for key in first_record.keys():
            if key not in fieldnames:
                fieldnames.append(key)
        
        with open(output_filename, mode='w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
            writer.writeheader()
            for row in all_records:
                writer.writerow(row)
                
        print(f"✅ Berhasil menulis {len(all_records)} baris ke {output_filename}!")
        print("Tugas selesai.")
        
        # Opsi untuk close browser (kita biarkan saja terbuka agar user bisa lanjut kerja)
        # browser.close()

if __name__ == "__main__":
    run()
