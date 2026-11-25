const SHEET_NAME = "Registrations";
const HEADERS = ["Name", "Phone", "Age", "Town", "Email", "Timestamp"];
const REQUIRED_FIELDS = ["name", "phone", "age", "town"];
const MAX_LENGTH = 254;
const REGISTRATION_TIME_ZONE = "Asia/Beirut";
const SPREADSHEET_ID_PROPERTY = "REGISTRATION_SPREADSHEET_ID";

function configureRegistrationSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet?.getSheetByName(SHEET_NAME)) {
    throw new Error("Open the Apps Script editor from the spreadsheet with the Registrations tab.");
  }
  PropertiesService.getScriptProperties().setProperty(SPREADSHEET_ID_PROPERTY, spreadsheet.getId());
}

function doPost(e) {
  const params = e.parameter;
  if (REQUIRED_FIELDS.some((field) => !params[field])) {
    return jsonResponse({ ok: false, error: "Missing required fields" });
  }

  const phone = normalizePhone(params.phone);
  if (!phone) {
    return jsonResponse({ ok: false, code: "INVALID_PHONE", error: "Enter a valid phone number." });
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();
    // Read Phone through Timestamp, including registrations from the previous deployment.
    const entries = lastRow > 1 ? sheet.getRange(2, 2, lastRow - 1, 5).getValues() : [];
    const timestamp = new Date();
    const today = registrationDay(timestamp);
    const alreadyRegistered = entries.some(([savedPhone, , , , savedTimestamp]) => (
      normalizePhone(savedPhone) === phone &&
      savedTimestamp instanceof Date &&
      registrationDay(savedTimestamp) === today
    ));

    if (alreadyRegistered) {
      return jsonResponse({
        ok: false,
        code: "DUPLICATE_PHONE",
        error: "This phone number is already registered today. Try another phone number.",
      });
    }

    sheet.appendRow([
      asText(params.name),
      asText(params.phone),
      asText(params.age),
      asText(params.town),
      asText(params.email),
      timestamp,
    ]);
    SpreadsheetApp.flush();
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error) });
  } finally {
    lock.releaseLock();
  }
}

function normalizePhone(value) {
  const phone = String(value).trim().replace(/^'/, "")
    .replace(/[٠-٩]/g, (digit) => digit.charCodeAt(0) - 0x0660)
    .replace(/[۰-۹]/g, (digit) => digit.charCodeAt(0) - 0x06f0);
  if (!/^\+?[\d ().-]+$/.test(phone) || phone.length > MAX_LENGTH) return "";

  const digits = phone.replace(/\D/g, "");
  const international = phone.startsWith("+") || digits.startsWith("00");
  const number = phone.startsWith("+") ? digits : digits.replace(/^00/, "");
  if (number.length < 6 || number.length > 15) return "";
  if (international && number.startsWith("0")) return "";

  // Local numbers default to Lebanon. Strip its optional domestic trunk prefix.
  if (!international) return "961" + number.replace(/^0/, "");
  if (number.startsWith("961")) return "961" + number.slice(3).replace(/^0/, "");
  return number;
}

function registrationDay(timestamp) {
  return Utilities.formatDate(timestamp, REGISTRATION_TIME_ZONE, "yyyy-MM-dd");
}

function getSheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_PROPERTY);
  const spreadsheet = spreadsheetId ? SpreadsheetApp.openById(spreadsheetId) : SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error("Run configureRegistrationSheet from the Apps Script editor.");
  const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  return sheet;
}

function asText(value) {
  return "'" + String(value || "").slice(0, MAX_LENGTH);
}

function jsonResponse(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
