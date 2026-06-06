# License Dashboard

Web Dashboard (Next.js) untuk memvisualisasikan dan mengatur lisensi (Admin/Reseller).  
Target Deploy: **Vercel**

## Fitur UI
- List Lisensi (ID, Email, Plan, Status, Devices, Expires).
- Badge status (Active, Expired, Revoked).
- Tombol Generate License, Edit, Revoke.

## Setup Lokal
\`\`\`bash
cd license-dashboard
npm install
npm run dev
\`\`\`
Buka `http://localhost:3000`

## Deploy ke Vercel
1. Push folder ini ke GitHub repo.
2. Buka dashboard Vercel.
3. Import project (pilih folder `license-dashboard` sebagai Root Directory).
4. Deploy.

*(Catatan: Saat ini menggunakan dummy data untuk keperluan visualisasi UI. Nantinya perlu disambungkan ke endpoint Google Apps Script / Backend).*