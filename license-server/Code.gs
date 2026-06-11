// Google Apps Script - Video Clipper License Server
// Compatible payloads:
// login:          { path:'login', email, password, device_uid, app_id, app_version }
// register:       { path:'register', email, password, device_uid, app_id, app_version }
// verify-license: { path:'verify-license', token, device_uid }

const FALLBACK_SHEET_ID = '';

const USERS_SHEET = 'users';
const LICENSES_SHEET = 'licenses';
const SESSIONS_SHEET = 'sessions';
const LOGS_SHEET = 'logs';
const AUDIT_LOGS_SHEET = 'audit_logs';

const USERS_HEADERS = ['id', 'email', 'password_hash', 'created_at', 'status'];
const LICENSE_HEADERS = ['id', 'user_id', 'email', 'plan', 'status', 'device_uid', 'max_devices', 'expires_at', 'created_at', 'last_checked_at', 'mismatch_count'];
const SESSIONS_HEADERS = ['token', 'user_id', 'device_uid', 'created_at', 'last_seen_at'];
const LOG_HEADERS = ['id', 'timestamp', 'user_id', 'email', 'action', 'device_uid', 'ip', 'message'];
const AUDIT_LOG_HEADERS = ['id', 'timestamp', 'action', 'email', 'license_id', 'device_uid', 'status', 'message', 'app_id', 'app_version', 'mismatch_count'];

const ACTIVE_STATUSES = ['active', 'trial'];
const VERIFY_CACHE_SECONDS = 600;
const INVALID_VERIFY_CACHE_SECONDS = 60;
const VERIFY_WRITE_THROTTLE_HOURS = 6;
const LOCK_WAIT_MS = 10000;
const DEFAULT_ENTITLEMENTS = ['import', 'preview', 'export_single'];
const PRO_ENTITLEMENTS = ['import', 'preview', 'export_single', 'export_all', 'batch_processing', 'smart_reframe'];

function doGet() {
  try {
    const spreadsheet = setupSheets();
    return json_({
      ok: true,
      success: true,
      message: 'Video Clipper License API ready. Gunakan POST JSON field path.',
      data: {
        service: 'video-clipper-license-server',
        spreadsheet_id: spreadsheet.getId(),
        spreadsheet_url: spreadsheet.getUrl(),
        sheets: getSheetHeaders_(spreadsheet),
      },
    });
  } catch (error) {
    const message = error.message || String(error);
    return json_({ ok: false, success: false, error: message, message, data: {} });
  }
}

function doPost(e) {
  let body = {};
  let path = '';
  try {
    body = parseBody_(e);
    path = optionalString_(body.path || body.action);
    setupSheets();

    const handlers = {
      'admin-login': handleAdminLogin_,
      register: handleRegister_,
      login: handleLogin_,
      'verify-license': handleVerifyLicense_,
      deactivate: handleDeactivate_,
      'list-licenses': handleListLicenses_,
      list_licenses: handleListLicenses_,
      'reset-device': handleResetDevice_,
      reset_device: handleResetDevice_,
      'revoke-license': handleRevokeLicense_,
      revoke_license: handleRevokeLicense_,
      'approve-license': handleApproveLicense_,
      approve_license: handleApproveLicense_,
      'set-license-status': handleSetLicenseStatus_,
      set_license_status: handleSetLicenseStatus_,
    };

    if (!handlers[path]) throw new Error('Route tidak dikenal: ' + path);
    const payload = normalizePayload_(handlers[path](body, e), 'Request berhasil.');
    appendAuditLogSafe_(body, path, payload.ok ? 'success' : 'failed', payload.message || '', payload.license || payload.data || {});
    return json_(payload);
  } catch (error) {
    const message = error.message || String(error);
    appendAuditLogSafe_(body, path || body.path || '', 'failed', message, {});
    return json_({ ok: false, success: false, error: message, message, data: {} });
  }
}

function handleAdminLogin_(body) {
  const password = required_(body.password, 'password');
  const adminPassword = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD') || 'admin123';
  if (password !== adminPassword) throw new Error('Invalid admin password');
  return { ok: true, token: 'admin-session-token-valid', message: 'Admin login berhasil.' };
}

function validateAdminPassword_(body) {
  const password = required_(body.admin_password || body.password, 'admin_password');
  const adminPassword = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD') || 'admin123';
  if (password !== adminPassword) throw new Error('Invalid admin password');
}

function handleRegister_(body, e) {
  return withScriptLock_(() => {
    const email = required_(body.email, 'email').toLowerCase();
    const password = required_(body.password, 'password');
    const deviceUid = required_(body.device_uid || body.device_id, 'device_uid');
    const now = nowIso_();

    const userSheet = getSpreadsheet_().getSheetByName(USERS_SHEET);
    const userTable = getTable_(userSheet);
    if (userTable.rows.some((row) => String(row.email).toLowerCase() === email)) throw new Error('Email sudah terdaftar.');

    const userId = Utilities.getUuid();
    const token = Utilities.getUuid();
    const expiresAt = addDaysIso_(7);
    userSheet.appendRow([userId, email, hash_(password), now, 'active']);

    const licenseId = Utilities.getUuid();
       getSpreadsheet_().getSheetByName(LICENSES_SHEET).appendRow([licenseId, userId, email, 'trial', 'pending', deviceUid, 1, expiresAt, now, now, 0]);
    getSpreadsheet_().getSheetByName(SESSIONS_SHEET).appendRow([token, userId, deviceUid, now, now]);
    appendLog_(userId, email, 'register', deviceUid, e, 'Trial created.');

       return makeAuthPayload_(token, { id: licenseId, user_id: userId, email, plan: 'trial', status: 'pending', device_uid: deviceUid, expires_at: expiresAt }, 'Daftar berhasil. Menunggu approval admin.');
  });
}

function handleLogin_(body, e) {
  return withScriptLock_(() => {
    const email = required_(body.email, 'email').toLowerCase();
    const password = required_(body.password, 'password');
    const deviceUid = required_(body.device_uid || body.device_id, 'device_uid');
    const now = nowIso_();

    const userTable = getTable_(getSpreadsheet_().getSheetByName(USERS_SHEET));
    const user = userTable.rows.find((row) => String(row.email).toLowerCase() === email);
    if (!user || user.password_hash !== hash_(password)) throw new Error('Invalid credentials');
    if (user.status && user.status !== 'active') throw new Error('User tidak aktif.');

    const licenseSheet = getSpreadsheet_().getSheetByName(LICENSES_SHEET);
    const table = getTable_(licenseSheet);
    const rowIndex = table.rows.findIndex((row) => row.user_id === user.id && ACTIVE_STATUSES.indexOf(String(row.status)) !== -1);
    if (rowIndex === -1) throw new Error('No active license found');

    const bindResult = bindOrValidateDevice_(licenseSheet, table, rowIndex, deviceUid);
    if (!bindResult.ok) {
      appendLog_(user.id, email, 'device_mismatch', deviceUid, e, bindResult.message);
      return { ok: false, error: bindResult.message, message: bindResult.message, data: bindResult.data || {} };
    }

    const refreshedTable = getTable_(licenseSheet);
    const license = refreshedTable.rows[rowIndex];
    const effective = buildEffectiveLicense_(license, deviceUid);
    if (!effective.valid) {
      appendLog_(user.id, email, 'login_invalid_' + effective.reason, deviceUid, e, effective.message);
      return { ok: false, error: effective.message, message: effective.message, data: effective };
    }

    const token = Utilities.getUuid();
    getSpreadsheet_().getSheetByName(SESSIONS_SHEET).appendRow([token, user.id, deviceUid, now, now]);
    setLastChecked_(licenseSheet, refreshedTable, rowIndex, now);
    appendLog_(user.id, email, 'login', deviceUid, e, 'Login berhasil.');
    return makeAuthPayload_(token, license, 'Login berhasil.');
  });
}

function handleVerifyLicense_(body, e) {
  const token = required_(body.token, 'token');
  const deviceUid = required_(body.device_uid || body.device_id, 'device_uid');
  const cache = CacheService.getScriptCache();
  const cacheKey = makeVerifyCacheKey_(token, deviceUid);
  const cached = getJsonCache_(cache, cacheKey);
  if (cached) return cached;

  return withScriptLock_(() => {
    const sessionSheet = getSpreadsheet_().getSheetByName(SESSIONS_SHEET);
    const sessionTable = getTable_(sessionSheet);
    const sessionIndex = sessionTable.rows.findIndex((row) => row.token === token && row.device_uid === deviceUid);
    if (sessionIndex === -1) {
      const invalid = { ok: false, error: 'Invalid or expired session', message: 'Invalid or expired session', data: {} };
      cache.put(cacheKey, JSON.stringify(invalid), INVALID_VERIFY_CACHE_SECONDS);
      return invalid;
    }

    const session = sessionTable.rows[sessionIndex];
    const licenseSheet = getSpreadsheet_().getSheetByName(LICENSES_SHEET);
    const table = getTable_(licenseSheet);
    const rowIndex = table.rows.findIndex((row) => row.user_id === session.user_id && ACTIVE_STATUSES.indexOf(String(row.status)) !== -1);
    if (rowIndex === -1) throw new Error('No active license found');

    const license = table.rows[rowIndex];
    const effective = buildEffectiveLicense_(license, deviceUid);
    if (!effective.valid) {
      appendLog_(session.user_id, license.email || '', 'verify_invalid_' + effective.reason, deviceUid, e, effective.message);
      const invalid = { ok: false, error: effective.message, message: effective.message, data: effective };
      cache.put(cacheKey, JSON.stringify(invalid), INVALID_VERIFY_CACHE_SECONDS);
      return invalid;
    }

    const now = nowIso_();
    if (!shouldThrottleVerifyWrite_(license.last_checked_at)) {
      setLastChecked_(licenseSheet, table, rowIndex, now);
      setSessionLastSeen_(sessionSheet, sessionTable, sessionIndex, now);
      appendLog_(session.user_id, license.email || '', 'verify_valid', deviceUid, e, 'License valid.');
    }

    const payload = makeAuthPayload_(token, license, 'License valid.');
    cache.put(cacheKey, JSON.stringify(payload), VERIFY_CACHE_SECONDS);
    return payload;
  });
}

function handleDeactivate_(body, e) {
  return withScriptLock_(() => {
    const token = optionalString_(body.token);
    const deviceUid = required_(body.device_uid || body.device_id, 'device_uid');
    const sessionSheet = getSpreadsheet_().getSheetByName(SESSIONS_SHEET);
    const table = getTable_(sessionSheet);
    let deleted = 0;
    for (let i = table.rows.length - 1; i >= 0; i -= 1) {
      const row = table.rows[i];
      if (row.device_uid === deviceUid && (!token || row.token === token)) {
        sessionSheet.deleteRow(i + 2);
        deleted += 1;
      }
    }
    appendLog_('', '', 'deactivate', deviceUid, e, 'Session removed: ' + deleted);
    return { ok: true, message: 'Device deactivated.', data: { deleted } };
  });
}

function handleListLicenses_(body) {
  validateAdminPassword_(body);
  const table = getTable_(getSpreadsheet_().getSheetByName(LICENSES_SHEET));
  const licenses = table.rows.map((row) => ({ ...row, effective_status: getEffectiveStatus_(row.status, row.expires_at) }));
  return { ok: true, message: 'Licenses loaded.', data: licenses, licenses };
}

function handleResetDevice_(body, e) {
  return withScriptLock_(() => {
    const email = optionalString_(body.email).toLowerCase();
    const licenseId = optionalString_(body.license_id);
    const sheet = getSpreadsheet_().getSheetByName(LICENSES_SHEET);
    const table = getTable_(sheet);
    const rowIndex = table.rows.findIndex((row) => (licenseId && row.id === licenseId) || (email && String(row.email).toLowerCase() === email));
    if (rowIndex === -1) throw new Error('License tidak ditemukan.');
    const row = table.rows[rowIndex];
    setCell_(sheet, table, rowIndex, 'device_uid', '');
    setCell_(sheet, table, rowIndex, 'mismatch_count', 0);
    appendLog_(row.user_id, row.email, 'reset_device', row.device_uid, e, 'Device reset.');
    return { ok: true, message: 'Device reset berhasil.', data: { id: row.id, old_device_uid: row.device_uid || '' } };
  });
}

function handleRevokeLicense_(body, e) {
  return withScriptLock_(() => {
    const email = optionalString_(body.email).toLowerCase();
    const licenseId = optionalString_(body.license_id);
    const sheet = getSpreadsheet_().getSheetByName(LICENSES_SHEET);
    const table = getTable_(sheet);
    const rowIndex = table.rows.findIndex((row) => (licenseId && row.id === licenseId) || (email && String(row.email).toLowerCase() === email));
    if (rowIndex === -1) throw new Error('License tidak ditemukan.');
    const row = table.rows[rowIndex];
    setCell_(sheet, table, rowIndex, 'status', 'revoked');
    appendLog_(row.user_id, row.email, 'revoke_license', row.device_uid, e, 'License revoked.');
    return { ok: true, message: 'License revoked.', data: { id: row.id, status: 'revoked' } };
  });
}

function bindOrValidateDevice_(sheet, table, rowIndex, deviceUid) {
  const row = table.rows[rowIndex];
  const stored = optionalString_(row.device_uid);
  if (!stored) {
    setCell_(sheet, table, rowIndex, 'device_uid', deviceUid);
    setCell_(sheet, table, rowIndex, 'mismatch_count', 0);
    return { ok: true, message: 'Device bound.' };
  }
  if (stored === deviceUid) return { ok: true, message: 'Device valid.' };

  const mismatch = Number(row.mismatch_count || 0) + 1;
  setCell_(sheet, table, rowIndex, 'mismatch_count', mismatch);
  if (mismatch >= 3) setCell_(sheet, table, rowIndex, 'status', 'suspended');
  return {
    ok: false,
    message: mismatch >= 3 ? 'Lisensi disuspend karena device mismatch berulang.' : 'License terdaftar untuk device lain.',
    data: { reason: mismatch >= 3 ? 'suspended' : 'device_mismatch', mismatch_count: mismatch, stored_device_uid: stored },
  };
}

function buildEffectiveLicense_(license, requestDeviceUid) {
  const status = getEffectiveStatus_(license.status, license.expires_at);
  const storedDeviceUid = optionalString_(license.device_uid);
  let valid = true;
  let reason = 'valid';
  let message = 'License valid.';

  if (status === 'expired') {
    valid = false;
    reason = 'expired';
    message = 'License sudah expired.';
  } else if (status === 'pending') {
    valid = false;
    reason = 'pending';
    message = 'Lisensi masih menunggu approval admin.';
  } else if (status === 'revoked' || status === 'suspended' || status === 'blocked') {
    valid = false;
    reason = status;
    message = 'License tidak aktif: ' + status;
  } else if (storedDeviceUid && requestDeviceUid && storedDeviceUid !== requestDeviceUid) {
    valid = false;
    reason = 'device_mismatch';
    message = 'License terdaftar untuk device lain.';
  }

  return { valid, reason, message, status, device_uid: storedDeviceUid || requestDeviceUid || '' };
}

function makeAuthPayload_(token, license, message) {
  const effective = buildEffectiveLicense_(license, license.device_uid);
  const plan = license.plan || 'free';
  const entitlements = plan === 'free' ? DEFAULT_ENTITLEMENTS : PRO_ENTITLEMENTS;
  return {
    ok: effective.valid,
    success: effective.valid,
    token,
    message: message || effective.message,
    license: {
      id: license.id || '',
      user_id: license.user_id || '',
      email: license.email || '',
          status: effective.status,
      plan,
      device_uid: effective.device_uid,
      expires_at: license.expires_at || null,
      entitlements,
    },
    data: { valid: effective.valid, reason: effective.reason, server_time: nowIso_() },
  };
}

function handleApproveLicense_(body, e) {
  body.status = 'active';
  return handleSetLicenseStatus_(body, e);
}

function handleSetLicenseStatus_(body, e) {
  return withScriptLock_(() => {
    validateAdminPassword_(body);
    const status = optionalString_(body.status).toLowerCase();
    if (['active', 'pending', 'revoked', 'suspended', 'expired'].indexOf(status) === -1) throw new Error('Status tidak valid.');
    const email = optionalString_(body.email).toLowerCase();
    const licenseId = optionalString_(body.license_id || body.id);
    const sheet = getSpreadsheet_().getSheetByName(LICENSES_SHEET);
    const table = getTable_(sheet);
    const rowIndex = table.rows.findIndex((row) => (licenseId && row.id === licenseId) || (email && String(row.email).toLowerCase() === email));
    if (rowIndex === -1) throw new Error('License tidak ditemukan.');
    const row = table.rows[rowIndex];
    setCell_(sheet, table, rowIndex, 'status', status);
    appendLog_(row.user_id, row.email, 'set_license_status', row.device_uid, e, 'Status -> ' + status);
    return { ok: true, message: 'Status license diubah ke ' + status + '.', data: { ...row, status }, license: { ...row, status } };
  });
}

function setupSheets() {
  const spreadsheet = getSpreadsheet_();
  ensureSheet_(spreadsheet, USERS_SHEET, USERS_HEADERS);
  ensureSheet_(spreadsheet, LICENSES_SHEET, LICENSE_HEADERS);
  ensureSheet_(spreadsheet, SESSIONS_SHEET, SESSIONS_HEADERS);
  ensureSheet_(spreadsheet, LOGS_SHEET, LOG_HEADERS);
  ensureSheet_(spreadsheet, AUDIT_LOGS_SHEET, AUDIT_LOG_HEADERS);
  return spreadsheet;
}

function getSheetHeaders_(spreadsheet) {
  return [USERS_SHEET, LICENSES_SHEET, SESSIONS_SHEET, LOGS_SHEET, AUDIT_LOGS_SHEET].reduce((acc, name) => {
    const sheet = spreadsheet.getSheetByName(name);
    acc[name] = sheet ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].filter(Boolean) : [];
    return acc;
  }, {});
}

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = optionalString_(props.getProperty('SPREADSHEET_ID') || FALLBACK_SHEET_ID);
  if (spreadsheetId && spreadsheetId !== 'YOUR_GOOGLE_SHEET_ID_HERE') return SpreadsheetApp.openById(spreadsheetId);

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    props.setProperty('SPREADSHEET_ID', active.getId());
    return active;
  }

  const created = SpreadsheetApp.create('Video Clipper License DB');
  props.setProperty('SPREADSHEET_ID', created.getId());
  return created;
}

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  const currentLastColumn = Math.max(sheet.getLastColumn(), headers.length);
  const currentHeaders = sheet.getRange(1, 1, 1, currentLastColumn).getValues()[0].map((value) => String(value || ''));
  if (currentHeaders.every((value) => value === '')) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }
  const missing = headers.filter((header) => currentHeaders.indexOf(header) === -1);
  if (missing.length) {
    const lastHeaderColumn = currentHeaders.reduce((last, header, index) => header ? index + 1 : last, 0);
    sheet.getRange(1, lastHeaderColumn + 1, 1, missing.length).setValues([missing]);
  }
  return sheet;
}

function getTable_(sheet) {
  const values = sheet.getDataRange().getDisplayValues();
  const headers = (values[0] || []).map((header) => String(header || ''));
  const headerMap = headers.reduce((acc, header, index) => {
    if (header) acc[header] = index;
    return acc;
  }, {});
  const rows = values.slice(1).filter((row) => row.some(Boolean)).map((row) => headers.reduce((acc, header, index) => {
    if (header) acc[header] = row[index] || '';
    return acc;
  }, {}));
  return { headers, headerMap, rows };
}

function setCell_(sheet, table, rowIndex, header, value) {
  if (table.headerMap[header] === undefined) return;
  sheet.getRange(rowIndex + 2, table.headerMap[header] + 1).setValue(value);
}

function setLastChecked_(sheet, table, rowIndex, value) {
  setCell_(sheet, table, rowIndex, 'last_checked_at', value);
}

function setSessionLastSeen_(sheet, table, rowIndex, value) {
  setCell_(sheet, table, rowIndex, 'last_seen_at', value);
}

function appendLog_(userId, email, action, deviceUid, e, message) {
  try {
    getSpreadsheet_().getSheetByName(LOGS_SHEET).appendRow([Utilities.getUuid(), nowIso_(), userId || '', email || '', action || '', deviceUid || '', getIp_(e), message || '']);
  } catch (error) {}
}

function appendAuditLogSafe_(body, action, status, message, data) {
  try {
    const payload = data || {};
    getSpreadsheet_().getSheetByName(AUDIT_LOGS_SHEET).appendRow([
      Utilities.getUuid(),
      nowIso_(),
      action || '',
      payload.email || body.email || '',
      payload.id || body.license_id || '',
      payload.device_uid || body.device_uid || body.device_id || '',
      status || '',
      message || '',
      body.app_id || '',
      body.app_version || '',
      payload.mismatch_count || '',
    ]);
  } catch (error) {}
}

function parseBody_(e) {
  if (e && e.postData && e.postData.contents) return JSON.parse(e.postData.contents);
  if (e && e.parameter && Object.keys(e.parameter).length) return e.parameter;
  return {};
}

function normalizePayload_(payload, fallbackMessage) {
  const source = payload || {};
  const ok = typeof source.ok === 'boolean' ? source.ok : (typeof source.success === 'boolean' ? source.success : true);
  const message = source.message || source.error || fallbackMessage || (ok ? 'Request berhasil.' : 'Request gagal.');
  return { ...source, ok, success: ok, message };
}

function withScriptLock_(callback) {
  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    lock.waitLock(LOCK_WAIT_MS);
    locked = true;
    return callback();
  } finally {
    if (locked) lock.releaseLock();
  }
}

function makeVerifyCacheKey_(token, deviceUid) {
  return 'vc_verify_' + Utilities.base64EncodeWebSafe([token, deviceUid].join('|')).slice(0, 220);
}

function getJsonCache_(cache, key) {
  const value = cache.get(key);
  if (!value) return null;
  try { return JSON.parse(value); } catch (error) { return null; }
}

function shouldThrottleVerifyWrite_(lastCheckedAt) {
  const date = parseSheetDate_(lastCheckedAt);
  if (!date) return false;
  return new Date().getTime() - date.getTime() < VERIFY_WRITE_THROTTLE_HOURS * 60 * 60 * 1000;
}

function getEffectiveStatus_(status, expiresAt) {
  const normalized = optionalString_(status).toLowerCase() || 'expired';
  if (['revoked', 'suspended', 'blocked'].indexOf(normalized) !== -1) return normalized;
  if (isExpired_(expiresAt)) return 'expired';
  return normalized;
}

function isExpired_(expiresAt) {
  const date = parseExpiryEndOfDay_(expiresAt);
  if (!date) return false;
  return new Date().getTime() > date.getTime();
}

function parseExpiryEndOfDay_(value) {
  const date = parseSheetDate_(value);
  if (!date) return null;
  date.setHours(23, 59, 59, 999);
  return date;
}

function parseSheetDate_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) return value;
  const text = String(value).trim();
  if (!text) return null;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), Number(iso[4] || 0), Number(iso[5] || 0), Number(iso[6] || 0));
  const parsed = new Date(text.indexOf('T') === -1 ? text.replace(' ', 'T') : text);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function required_(value, field) {
  const text = optionalString_(value);
  if (!text) throw new Error('Field ' + field + ' wajib diisi.');
  return text;
}

function optionalString_(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/[\u0000-\u001F\u007F]/g, '').trim();
}

function hash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value)
    .map((byte) => (byte + 256).toString(16).slice(-2))
    .join('');
}

function nowIso_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function addDaysIso_(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function getIp_(e) {
  if (!e || !e.parameter) return '';
  return optionalString_(e.parameter.ip).split(',')[0].slice(0, 80);
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
