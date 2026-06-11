# License Server (Google Apps Script)

Google Apps Script + Google Sheets DB untuk lisensi Video Clipper.

## Script Properties

Set di Google Apps Script > Project Settings > Script Properties:

- `SPREADSHEET_ID` = opsional. Jika kosong, script akan pakai active spreadsheet atau membuat sheet baru otomatis.
- `ADMIN_PASSWORD` = password dashboard admin

App/Tauri tetap hanya perlu URL GAS. Sheet ID hanya untuk storage internal GAS.

## Sheets

`Code.gs` membuat / melengkapi header otomatis.

### `users`
`id` | `email` | `password_hash` | `created_at` | `status`

### `licenses`
`id` | `user_id` | `email` | `plan` | `status` | `device_uid` | `max_devices` | `expires_at` | `created_at` | `last_checked_at` | `mismatch_count`

### `sessions`
`token` | `user_id` | `device_uid` | `created_at` | `last_seen_at`

### `logs`
`id` | `timestamp` | `user_id` | `email` | `action` | `device_uid` | `ip` | `message`

### `audit_logs`
`id` | `timestamp` | `action` | `email` | `license_id` | `device_uid` | `status` | `message` | `app_id` | `app_version` | `mismatch_count`

## Deploy

1. Buka https://script.google.com/.
2. Buat project baru.
3. Paste `Code.gs`.
4. Set `ADMIN_PASSWORD` di Script Properties. `SPREADSHEET_ID` boleh kosong.
5. Deploy > New deployment > Web app.
6. Execute as: `Me`.
7. Access: `Anyone`.
8. Pakai Web App URL sebagai license endpoint.

## Payload

Semua request via POST JSON ke Web App URL. Field route: `path`.

### `register`

```json
{
  "path": "register",
  "email": "user@email.com",
  "password": "mypassword",
  "device_uid": "hardware-device-id",
  "app_id": "video-clipper",
  "app_version": "1.1.0"
}
```

### `login`

```json
{
  "path": "login",
  "email": "user@email.com",
  "password": "mypassword",
  "device_uid": "hardware-device-id",
  "app_id": "video-clipper",
  "app_version": "1.1.0"
}
```

Response:

```json
{
  "ok": true,
  "success": true,
  "token": "uuid-token",
  "license": {
    "status": "active",
    "plan": "trial",
    "device_uid": "hardware-device-id",
    "expires_at": "2026-06-13",
    "entitlements": ["import", "preview", "export_single", "export_all", "batch_processing", "smart_reframe"]
  }
}
```

### `verify-license`

```json
{
  "path": "verify-license",
  "token": "uuid-token",
  "device_uid": "hardware-device-id"
}
```

### `deactivate`

```json
{
  "path": "deactivate",
  "token": "uuid-token",
  "device_uid": "hardware-device-id"
}
```

### `admin-login`

```json
{
  "path": "admin-login",
  "password": "admin-password"
}
```

## Device logic

- Login/register pertama mengikat license ke `device_uid`.
- Device sama → valid.
- Device beda → `device_mismatch`.
- Mismatch 3x → license `suspended`.
- `verify-license` cache 10 menit.
- Aktivitas verify valid ditulis maksimal 1x per 6 jam.

## Endpoint lokal

Untuk debug lokal app Tauri:

```text
Tauri -> http://localhost:20129/license -> Apps Script
```

Jalankan proxy dari `tauri-app`:

```powershell
npm run license:proxy
```
