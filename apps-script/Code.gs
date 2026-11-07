/**
 * B-SAD Contact Form — Google Apps Script
 *
 * Pasang kode ini melalui Google Sheets > Extensions > Apps Script.
 * Ganti NOTIFICATION_EMAIL sebelum deploy.
 */

const NOTIFICATION_EMAIL = 'rabbanimaulana40@gmail.com';
const SHEET_NAME = 'Pengunjung';

function doGet() {
  return HtmlService.createHtmlOutput(
    '<p>Backend formulir B-SAD aktif.</p>'
  );
}

function doPost(e) {
  try {
    const data = (e && e.parameter) ? e.parameter : {};

    // Honeypot anti-spam: bot biasanya mengisi field tersembunyi ini.
    if (String(data._honey || '').trim() !== '') {
      return responseToForm({ ok: true, emailSent: false });
    }

    const nama = String(data.nama || '').trim().slice(0, 100);
    const email = String(data.email || '').trim().toLowerCase().slice(0, 200);
    const pesan = String(data.pesan || '').trim().slice(0, 2000);

    if (!nama || !email || !pesan) {
      return responseToForm({ ok: false, message: 'Data belum lengkap.' });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return responseToForm({ ok: false, message: 'Format email tidak valid.' });
    }

    if (!NOTIFICATION_EMAIL || NOTIFICATION_EMAIL === 'GANTI_DENGAN_EMAIL_TUJUAN') {
      return responseToForm({ ok: false, message: 'Email tujuan belum dikonfigurasi.' });
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) {
      return responseToForm({ ok: false, message: 'Spreadsheet tidak ditemukan.' });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    let sheet;
    try {
      sheet = spreadsheet.getSheetByName(SHEET_NAME);
      if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);

      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Waktu', 'Nama', 'Email', 'Pesan']);
        sheet.setFrozenRows(1);
      }

      sheet.appendRow([new Date(), nama, email, pesan]);
    } finally {
      lock.releaseLock();
    }

    let emailSent = true;
    try {
      MailApp.sendEmail({
        to: NOTIFICATION_EMAIL,
        subject: 'Pesan baru dari website B-SAD',
        body:
          'Ada pesan baru dari formulir website B-SAD.\n\n' +
          'Nama: ' + nama + '\n' +
          'Email: ' + email + '\n\n' +
          'Pesan:\n' + pesan + '\n\n' +
          'Balas langsung email ini untuk menghubungi pengunjung.',
        replyTo: email,
        name: 'Formulir Website B-SAD'
      });
    } catch (mailError) {
      console.error('Gagal mengirim notifikasi email: ' + mailError);
      emailSent = false;
    }

    return responseToForm({ ok: true, emailSent: emailSent });
  } catch (error) {
    console.error('Kesalahan formulir B-SAD: ' + error);
    return responseToForm({ ok: false, message: 'Terjadi kesalahan pada server.' });
  }
}

/**
 * Mengirim hasil proses ke halaman website melalui iframe target formulir.
 */
function responseToForm(result) {
  const payload = JSON.stringify(result).replace(/</g, '\\u003c');
  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body>
<script>
  window.top.postMessage({
    type: 'bsad-contact-result',
    result: ${payload}
  }, '*');
</script>
</body>
</html>`;

  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
