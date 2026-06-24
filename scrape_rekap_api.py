from playwright.sync_api import sync_playwright
import csv
import json
import os

def run():
    with sync_playwright() as p:
        print("Connecting to local Chrome via CDP...")
        try:
            browser = p.chromium.connect_over_cdp("http://localhost:9222")
            context = browser.contexts[0]
            
            page = None
            for pg in context.pages:
                if "fasih" in pg.url:
                    page = pg
                    print(f"Using active page: {page.url}")
                    break
                    
            if not page:
                print("Error: Fasih page not found in active browser.")
                return
            
            print("Fetching all pages of rekap data via programmatic fetch in page context...")
            js_code = """
            async () => {
                const getCookie = (name) => {
                    const value = `; ${document.cookie}`;
                    const parts = value.split(`; ${name}=`);
                    if (parts.length === 2) return parts.pop().split(';').shift();
                    return '';
                };
                
                const xsrfToken = decodeURIComponent(getCookie('XSRF-TOKEN'));
                const allContent = [];
                let currentPage = 0;
                const pageSize = 5;
                
                while (true) {
                    console.log(`Fetching page ${currentPage}...`);
                    const response = await fetch('/app/api/analytic/api/v2/assignment/report-progress-by-responsibility', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-xsrf-token': xsrfToken
                        },
                        body: JSON.stringify({
                            surveyPeriodId: "fd68e454-ba45-4b85-8205-f3bf777ded24",
                            surveyRoleId: "6d7d919a-45e5-4779-bb87-2905b49fd31a",
                            size: pageSize,
                            page: currentPage,
                            search: "",
                            target: "TARGET_ONLY",
                            region: {
                                region1Id: null,
                                region2Id: null,
                                region3Id: null,
                                region4Id: null,
                                region5Id: null,
                                region6Id: null,
                                region7Id: null,
                                region8Id: null,
                                region9Id: null,
                                region10Id: null
                            },
                            regionSummaryLevel: 6
                        })
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error on page ${currentPage}! Status: ${response.status}`);
                    }
                    
                    const result = await response.json();
                    const content = result?.data?.content || [];
                    
                    if (content.length === 0) {
                        break;
                    }
                    
                    allContent.push(...content);
                    currentPage++;
                    
                    // Safety check to prevent infinite loops
                    if (currentPage > 100) {
                        break;
                    }
                }
                
                return allContent;
            }
            """
            
            all_officers = page.evaluate(js_code)
            print(f"Successfully retrieved data for {len(all_officers)} officers.")
            
            filename = "hasil_rekap_petugas.csv"
            
            # Write to CSV
            print(f"Writing data to {filename}...")
            with open(filename, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow([
                    "Email Petugas", "Total Assignment", "Nama SLS", 
                    "OPEN", "SUBMITTED BY PENCACAH", "DRAFT", 
                    "APPROVED BY PENGAWAS", "REJECTED BY PENGAWAS", "REVOKED BY PENGAWAS",
                    "RAW_BODY_TEXT"
                ])
                
                total_sls_rows = 0
                for officer in all_officers:
                    email = officer.get("email") or officer.get("username")
                    total_assignment = officer.get("total", 0)
                    region_summary = officer.get("regionSummary", [])
                    
                    if not region_summary:
                        # Write a row with empty stats if there is no SLS assigned
                        writer.writerow([
                            email, total_assignment, "N/A", 
                            0, 0, 0, 0, 0, 0, ""
                        ])
                        total_sls_rows += 1
                    else:
                        for region in region_summary:
                            sls_code = region.get("regionCode")
                            
                            # Initialize stats
                            stats = {
                                "OPEN": 0,
                                "SUBMITTED BY PENCACAH": 0,
                                "DRAFT": 0,
                                "APPROVED BY PENGAWAS": 0,
                                "REJECTED BY PENGAWAS": 0,
                                "REVOKED BY PENGAWAS": 0
                            }
                            
                            # Populate stats from statusBreakdown
                            for bd in region.get("statusBreakdown", []):
                                status_name = bd.get("status", "").upper()
                                count = bd.get("count", 0)
                                
                                # Match status names case-insensitively
                                if "OPEN" in status_name:
                                    stats["OPEN"] = count
                                elif "SUBMITTED" in status_name or "PENCACAH" in status_name:
                                    stats["SUBMITTED BY PENCACAH"] = count
                                elif "DRAFT" in status_name:
                                    stats["DRAFT"] = count
                                elif "APPROVED" in status_name or "PENGAWAS" in status_name:
                                    # Wait, differentiate approved/rejected/revoked
                                    if "APPROVED" in status_name:
                                        stats["APPROVED BY PENGAWAS"] = count
                                    elif "REJECTED" in status_name:
                                        stats["REJECTED BY PENGAWAS"] = count
                                    elif "REVOKED" in status_name:
                                        stats["REVOKED BY PENGAWAS"] = count
                                
                            writer.writerow([
                                email, total_assignment, sls_code,
                                stats["OPEN"], stats["SUBMITTED BY PENCACAH"], stats["DRAFT"],
                                stats["APPROVED BY PENGAWAS"], stats["REJECTED BY PENGAWAS"], stats["REVOKED BY PENGAWAS"],
                                json.dumps(region)
                            ])
                            total_sls_rows += 1
                            
            print(f"Successfully wrote {total_sls_rows} rows to {filename}!")
            
        except Exception as e:
            print("Error running script:", e)

if __name__ == "__main__":
    run()
