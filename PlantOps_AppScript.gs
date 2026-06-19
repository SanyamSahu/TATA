// ============================================================================
// TATA MOTORS Operations Portal — Google Apps Script Backend
// Meeting Excel Sheet + Analytical Sheet version
//
// Main concept:
// 1. Shop reps submit simple data entry from the React app.
// 2. Backend stores raw data in a hidden Main Data sheet.
// 3. Backend converts the data into two visible, presentable sheets:
//    - Meeting Excel Sheet: row format matching the meeting screenshot, with formulas.
//    - Analytical Sheet: shop/month/day/cumulative/breakdown/parameter analytics.
// 4. Admin and users can view the same converted data in React; admin gets reminders.
// ============================================================================

// ── REQUIRED CONFIG ──────────────────────────────────────────────────────────
var ADMIN_EMAIL = "admin@yourcompany.com";

// Leave blank if this script is bound to the Google Sheet.
// If this is a standalone script, paste the Google Sheet ID here.
var SPREADSHEET_ID = "";

var TIME_ZONE = "Asia/Kolkata";
var RAW_SHEET_NAME = "Main Data";
var LOSS_REPORT_SHEET_NAME = "Loss Report";
var MEETING_REPORT_SHEET_NAME = "Meeting Report";
var ANALYTICAL_SHEET_NAME = "Analytical Sheet";
var DAILY_EXCEL_REPORT_HOUR = 8;
// ─────────────────────────────────────────────────────────────────────────────

var SHOPS = ["TCF1", "X4", "PAINT", "TCF2", "Q5", "NOVA", "X1", "PRESS", "TA64", "TA78", "ENGINE"];

var SHIFT_ASSIGNMENT = {
  X1: "A",
  X4: "A",
  ENGINE: "A",
  PAINT: "A",
  PRESS: "A",
  TCF1: "C",
  TCF2: "C",
  Q5: "B",
  NOVA: "B",
  TA64: "B",
  TA78: "B"
};

var FIXED_QR = {
  TCF1: 0.827,
  X4: 0.68,
  PAINT: 0.85,
  TCF2: 0.8,
  Q5: 0.71,
  NOVA: 0.7,
  X1: 0.7,
  PRESS: 0.98,
  TA64: 0.98,
  TA78: 0.98,
  ENGINE: 0.99
};

function getFixedQR(shop) {
  var key = String(shop || "").replace(/\s+/g, "").toUpperCase();
  return FIXED_QR[key] || 1.0;
}

var X4_GROUP_SHOPS = ["X4", "Q5", "X1", "NOVA", "ENGINE", "TA64", "TA78"];
var SHOP_LOSS_CATEGORIES = {
  TCF1: [
    ["lossShortages", "Shortages"], ["lossQualityBIW", "Quality, BIW"], ["lossBDMaintenance", "BD/Maintenance"],
    ["lossProcessOthers", "Process/Others"], ["lossEngine", "Engine"], ["lossPaint", "Paint"],
    ["lossPPC", "PPC"], ["lossIPMS", "IPMS"], ["lossHR", "HR"], ["lossTS", "TS"], ["lossOthers", "Others"]
  ],
  X4_GROUP: [
    ["lossShortages", "Shortages"], ["lossQualityBIW", "Quality"], ["lossBDMaintenance", "BD/Maintenance"],
    ["lossProcessOthers", "Process/Others"], ["lossHR", "Manpower Loss"],
    ["lossProject", "Fixed Losses"], ["lossOthers", "Others"]
  ],
  TCF2: [
    ["lossShortages", "Shortages"], ["lossQualityBIW", "Part Quality"], ["lossBDMaintenance", "BD/Maintenance"],
    ["lossProcessOthers", "JBIW"], ["lossEngine", "Process"], ["lossPaint", "IPMS"], ["lossPPC", "TS"],
    ["lossIPMS", "EV Shop"], ["lossHR", "PPC"], ["lossProject", "Paint"], ["lossTS", "Others"], ["lossOthers", "UA"]
  ],
  PAINT: [
    ["lossShortages", "Shortages"], ["lossQualityBIW", "Quality"], ["lossBDMaintenance", "BD/Maintenance"],
    ["lossProcessOthers", "Process/Others"], ["lossHR", "Manpower Loss"], ["lossProject", "PBS Full - No PBS Hanger"],
    ["lossOthers", "Others"]
  ],
  PRESS: [
    ["lossProcessOthers", "Process Losses (Automation, Set Up, Blanking)"], ["lossQualityBIW", "Quality"],
    ["lossBDMaintenance", "BD/Maintenance"], ["lossEngine", "D/R"], ["lossHR", "Manpower Loss"],
    ["lossProject", "Planned Shutdown/Other Losses"], ["lossOthers", "Others"]
  ]
};

function getLossCategories(shop) {
  var key = String(shop || "").toUpperCase();
  if (X4_GROUP_SHOPS.indexOf(key) !== -1) return SHOP_LOSS_CATEGORIES.X4_GROUP;
  return SHOP_LOSS_CATEGORIES[key] || SHOP_LOSS_CATEGORIES.TCF1;
}

var SHIFT_TIME = {
  A: "6:30 AM – 3:00 PM",
  B: "3:00 PM – 11:30 PM",
  C: "11:30 PM – 6:30 AM",
};

var SHIFT_DURATION_MIN = { A: 460, B: 460, C: 365 };
var HOUR_SLOT_DURATION_MIN = {
  A: [60, 60, 60, 60, 60, 60, 60, 60, 30],
  B: [60, 60, 60, 60, 60, 60, 60, 60, 30],
  C: [60, 60, 60, 60, 60, 60, 60]
};

function calculateAvailableTime(shift, hourlyActual) {
  var fixedTime = SHIFT_DURATION_MIN[shift] || 0;
  var durations = HOUR_SLOT_DURATION_MIN[shift] || [];
  var actual = safeJsonParse(hourlyActual, []);
  if (!Array.isArray(actual)) actual = [];
  var zeroTime = durations.reduce(function (sum, duration, index) {
    var value = actual[index];
    var isExplicitZero = value === 0 || (typeof value === "string" && value.trim() === "0");
    return isExplicitZero ? sum + duration : sum;
  }, 0);
  return Math.max(fixedTime - zeroTime, 0);
}

function calculatePlannedCapacity(shift, cycleTimeSec) {
  var fixedTime = SHIFT_DURATION_MIN[shift] || 0;
  var cycle = toNumber(cycleTimeSec);
  return fixedTime > 0 && cycle > 0 ? Math.round((fixedTime * 60) / cycle) : 0;
}

var RAW_HEADERS = [
  "SN",
  "Key",
  "Month",
  "Date",
  "Shop Name",
  "Shift",
  "Shift Code",
  "Shift Time",
  "Shop Rep Name",
  "Actual Production",
  "Time Available (Min)",
  "Cycle Time (Sec)",
  "PR",
  "QR",
  "Affected DT (Min)",
  "Gross DT (Min)",
  "BD Occurrence",
  "Gross DT Target",
  "Breakdown Details",
  "Safety Issue",
  "Spares Consumed",
  "Hourly Plan",
  "Hourly Actual",
  "Loss Shortages",
  "Loss Quality BIW",
  "Loss BD Maintenance",
  "Loss Process Others",
  "Loss Engine",
  "Loss Paint",
  "Loss PPC",
  "Loss IPMS",
  "Loss HR",
  "Loss Project",
  "Loss TS",
  "Loss Others",
  "Loss Usage Details",
  "Submitted By",
  "Submitted At",
  "Last Updated At",
];

var RAW_KEY_MAP = {
  "SN": "sn",
  "Key": "id",
  "Month": "month",
  "Date": "date",
  "Shop Name": "shop",
  "Shift": "shift",
  "Shift Code": "shiftCode",
  "Shift Time": "shiftTime",
  "Shop Rep Name": "repName",
  "Actual Production": "actualProduction",
  "Time Available (Min)": "timeAvailable",
  "Cycle Time (Sec)": "cycleTimeSec",
  "PR": "pr",
  "QR": "qr",
  "Affected DT (Min)": "affectedDowntime",
  "Gross DT (Min)": "grossDowntime",
  "BD Occurrence": "bdOccurrence",
  "Gross DT Target": "grossDTTarget",
  "Breakdown Details": "majorBreakdown",
  "Safety Issue": "safetyIssue",
  "Spares Consumed": "sparesConsumed",
  "Hourly Plan": "hourlyPlan",
  "Hourly Actual": "hourlyActual",
  "Loss Shortages": "lossShortages",
  "Loss Quality BIW": "lossQualityBIW",
  "Loss BD Maintenance": "lossBDMaintenance",
  "Loss Process Others": "lossProcessOthers",
  "Loss Engine": "lossEngine",
  "Loss Paint": "lossPaint",
  "Loss PPC": "lossPPC",
  "Loss IPMS": "lossIPMS",
  "Loss HR": "lossHR",
  "Loss Project": "lossProject",
  "Loss TS": "lossTS",
  "Loss Others": "lossOthers",
  "Loss Usage Details": "lossDetails",
  "Submitted By": "submittedBy",
  "Submitted At": "submittedAt",
  "Last Updated At": "lastUpdatedAt",
};

var MEETING_HEADER_1 = [
  "Month",
  "Date",
  "ShopName",
  "Actual Production",
  "Shift",
  "Time Available (Min)",
  "Cycle Time (Sec)",
  "Capacity",
  "Production Time",
  "Production DT",
  "AR",
  "PR",
  "QR",
  "OE / OEE",
  "Line Efficiency",
  "",
  "Affected DT",
  "Gross DT",
  "BD Occurrence",
  "Uptime (Affected DT)",
  "MTTR",
  "MTBR",
  "",
  "Uptime (Gross DT)"
];

var MEETING_HEADER_2 = [
  "Month",
  "Date",
  "Shop",
  "Production",
  "Shift",
  "Available Time",
  "Cycle Time",
  "Capacity",
  "Actual Production time",
  "Net DT",
  "AR",
  "PR",
  "QR",
  "OE",
  "LE",
  "",
  "Affected DT",
  "Gross DT",
  "BD Occurrence",
  "Uptime (Affected DT)",
  "MTTR",
  "MTBR",
  "",
  "Uptime (Gross DT)"
];

var ANALYTICS_HEADERS = [
  "Group",
  "Reports",
  "Production",
  "Capacity",
  "Production Time (Min)",
  "Net DT",
  "Affected DT",
  "Gross DT",
  "BD Occurrence",
  "Gross DT Target",
  "Avg AR",
  "Avg PR",
  "Avg QR",
  "Avg OE %",
  "Avg LE %",
  "MTTR Min",
  "MTBR Hrs",
  "Uptime Affected %",
  "Uptime Gross %",
  "Breakdown Loss Min",
];

// ── WEB APP ENTRY POINTS ─────────────────────────────────────────────────────

function doGet(e) {
  try {
    ensureWorkbook();
    var action = (e && e.parameter && e.parameter.action) || "health";

    if (action === "health") {
      ensureWorkbook();
      var rawSheet2 = getOrCreateSimpleSheet(RAW_SHEET_NAME);
      return jsonResponse({ success: true, message: "TATA MOTORS Operations API running", version: "meeting-analytical-2026-06-10", rawRows: Math.max(0, rawSheet2.getLastRow() - 1) });
    }

    if (action === "list") {
      return jsonResponse({ success: true, entries: readEntries() });
    }

    if (action === "meeting") {
      rebuildMeetingReportSheet();
      return jsonResponse({ success: true, rows: buildMeetingRows(readEntries()) });
    }

    if (action === "analytics") {
      rebuildAnalyticalSheet();
      return jsonResponse({ success: true, analytics: buildAnalyticsPayload(readEntries()) });
    }

    // ── NEW: flat row-level data for the Production Intelligence dashboard ──
    // Returns every submitted report as a flat JSON row with all derived columns
    // already computed — matching exactly the column names the dashboard expects.
    // Call: GET ?action=dashboardData
    if (action === "dashboardData") {
      var rows = buildDashboardRows(readEntries());
      return jsonResponse({ success: true, rows: rows, count: rows.length });
    }

    if (action === "missing") {
      var date = (e.parameter && e.parameter.date) || todayString();
      var shift = e.parameter && e.parameter.shift;
      return jsonResponse({ success: true, date: date, missing: getMissingUploads(date, shift) });
    }

    return jsonResponse({ success: false, error: "Unknown action: " + action });
  } catch (err) {
    return jsonResponse({ success: false, error: String(err && err.stack ? err.stack : err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    ensureWorkbook();
    var data = parsePostData(e);
    var action = data.action || "saveReport";

    if (action === "clearAllData") {
      var rawSheet = getOrCreateSheet(RAW_SHEET_NAME, RAW_HEADERS);
      if (rawSheet.getLastRow() > 1) {
        rawSheet.deleteRows(2, rawSheet.getLastRow() - 1);
      }
      // Clear visible presentation sheets too
      try {
        var ss = getSpreadsheet();
        var lossSheet = ss.getSheetByName(LOSS_REPORT_SHEET_NAME);
        if (lossSheet) lossSheet.clearContents();
        var meetingSheet = ss.getSheetByName(MEETING_REPORT_SHEET_NAME);
        if (meetingSheet) meetingSheet.clearContents();
        var analyticsSheet = ss.getSheetByName(ANALYTICAL_SHEET_NAME);
        if (analyticsSheet) analyticsSheet.clearContents();
      } catch(_) {}
      return jsonResponse({ success: true, message: "All data deleted from Google Sheets." });
    }

    if (action === "saveReport") {
      var report = data.report || data;
      var result = saveReport(report);
      sendSubmissionEmail(result.entry, result.mode);
      return jsonResponse({ success: true, mode: result.mode, entry: result.entry });
    }

    if (action === "rebuildSheets") {
      rebuildVisibleSheets();
      return jsonResponse({ success: true, message: "Meeting Excel Sheet and Analytical Sheet rebuilt." });
    }

    if (action === "sendMissingReminder") {
      sendMissingUploadReminder(data.date || todayString(), data.shift || null);
      return jsonResponse({ success: true, message: "Missing-upload reminder sent." });
    }

    if (action === "sendDailyExcelReport") {
      sendDailyExcelReport(data.date || todayString());
      return jsonResponse({ success: true, message: "Excel report email sent." });
    }

    return jsonResponse({ success: false, error: "Unknown action: " + action });
  } catch (err) {
    return jsonResponse({ success: false, error: String(err && err.stack ? err.stack : err) });
  } finally {
    lock.releaseLock();
  }
}

function parsePostData(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  return JSON.parse(e.postData.contents);
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ── SAVE / READ DATA ─────────────────────────────────────────────────────────

function saveReport(rawReport) {
  var report = normalizeReport(rawReport);
  validateLossUsageDetails(report);
  var rawSheet = getOrCreateSheet(RAW_SHEET_NAME, RAW_HEADERS);
  var rawResult = upsertIntoRawSheet(rawSheet, report);
  var rebuildWarning = "";
  try {
    rebuildVisibleSheets();
  } catch (error) {
    // Main Data is the source of truth. A report-formatting issue must not reject a submitted report.
    rebuildWarning = "Report saved, but the visible sheets need rebuilding: " + error.message;
  }
  return { mode: rawResult.mode, entry: rawResult.entry, rebuildWarning: rebuildWarning };
}

function validateLossUsageDetails(report) {
  var details = safeJsonParse(report.lossDetails, {});
  getLossCategories(report.shop).forEach(function (loss) {
    var categoryMinutes = toNumber(report[loss[0]]);
    if (categoryMinutes <= 0) return;
    var rows = Array.isArray(details[loss[0]]) ? details[loss[0]] : [];
    if (!rows.length) throw new Error("Add detail rows for " + loss[1] + ".");
    var detailedMinutes = 0;
    rows.forEach(function (row) {
      if (!toText(row.machine).trim() || toNumber(row.minutes) <= 0) {
        throw new Error("Complete the description and Time fields for " + loss[1] + ".");
      }
      if (loss[0] === "lossBDMaintenance" && !toText(row.remarks).trim()) {
        throw new Error("Enter the Fault / Remark for each " + loss[1] + " detail.");
      }
      detailedMinutes += toNumber(row.minutes);
    });
    if (Math.abs(detailedMinutes - categoryMinutes) > 0.01) {
      throw new Error(loss[1] + " details total (" + detailedMinutes + " min) must equal the entered loss (" + categoryMinutes + " min).");
    }
  });
}

function upsertIntoRawSheet(sheet, report) {
  var key = report.id;
  var rowIndex = findRowByKey(sheet, key);
  var mode = rowIndex ? "updated" : "inserted";
  var sn = rowIndex ? sheet.getRange(rowIndex, 1).getValue() : getNextSN(sheet);
  var nowIso = new Date().toISOString();

  var entry = Object.assign({}, report, {
    sn: sn,
    submittedAt: report.submittedAt || nowIso,
    lastUpdatedAt: nowIso,
  });

  var row = RAW_HEADERS.map(function (header) {
    var prop = RAW_KEY_MAP[header];
    return entry[prop] == null ? "" : entry[prop];
  });

  if (rowIndex) {
    sheet.getRange(rowIndex, 1, 1, RAW_HEADERS.length).setValues([row]);
  } else {
    sheet.appendRow(row);
    rowIndex = sheet.getLastRow();
  }

  formatRawRow(sheet, rowIndex, RAW_HEADERS.length);
  return { mode: mode, entry: entry, rowIndex: rowIndex };
}

function normalizeReport(report) {
  report = report || {};
  var date = normalizeDateString(report.date || todayString());
  var shop = String(report.shop || "").trim().toUpperCase();
  var shift = String(report.shift || SHIFT_ASSIGNMENT[shop] || "").replace("Shift ", "").trim().toUpperCase();

  if (!date) throw new Error("Date is required.");
  if (!shop) throw new Error("Shop is required.");
  if (!shift) throw new Error("Shift is required.");

  return {
    id: buildReportKey(date, shop, shift),
    month: monthLabel(date),
    date: date,
    shop: shop,
    shift: shift,
    shiftCode: shiftCode(shift),
    shiftTime: toText(report.shiftTime || SHIFT_TIME[shift]),
    repName: toText(report.repName || shop + " Shop Representative"),
    actualProduction: toNumber(report.actualProduction),
    timeAvailable: report.timeAvailable !== "" && report.timeAvailable != null
      ? toNumber(report.timeAvailable)
      : calculateAvailableTime(shift, report.hourlyActual),
    cycleTimeSec: configuredNumber(report.cycleTimeSec, 60),
    pr: configuredNumber(report.pr, 1.0),
    qr: configuredNumber(report.qr, getFixedQR(shop)),
    affectedDowntime: toNumber(report.affectedDowntime != null ? report.affectedDowntime : report.affectedDTmin),
    grossDowntime: toNumber(report.grossDowntime != null ? report.grossDowntime : report.grossDTmin),
    bdOccurrence: toNumber(report.bdOccurrence != null ? report.bdOccurrence : report.affectedDowntimeOccurrences),
    grossDTTarget: toNumber(report.grossDTTarget),
    majorBreakdown: toText(report.majorBreakdown),
    safetyIssue: toText(report.safetyIssue),
    sparesConsumed: toText(report.sparesConsumed),
    hourlyPlan: Array.isArray(report.hourlyPlan) ? JSON.stringify(report.hourlyPlan) : (typeof report.hourlyPlan === "string" ? report.hourlyPlan : ""),
    hourlyActual: Array.isArray(report.hourlyActual) ? JSON.stringify(report.hourlyActual) : (typeof report.hourlyActual === "string" ? report.hourlyActual : ""),
    lossShortages: toNumber(report.lossShortages),
    lossQualityBIW: toNumber(report.lossQualityBIW),
    lossBDMaintenance: toNumber(report.lossBDMaintenance),
    lossProcessOthers: toNumber(report.lossProcessOthers),
    lossEngine: toNumber(report.lossEngine),
    lossPaint: toNumber(report.lossPaint),
    lossPPC: toNumber(report.lossPPC),
    lossIPMS: toNumber(report.lossIPMS),
    lossHR: toNumber(report.lossHR),
    lossProject: toNumber(report.lossProject || report.lossPROJECT),
    lossTS: toNumber(report.lossTS),
    lossOthers: toNumber(report.lossOthers),
    lossDetails: typeof report.lossDetails === "string"
      ? report.lossDetails
      : JSON.stringify(report.lossDetails && typeof report.lossDetails === "object" ? report.lossDetails : {}),
    submittedBy: toText(report.submittedBy),
    submittedAt: toText(report.submittedAt || new Date().toISOString()),
    lastUpdatedAt: toText(report.lastUpdatedAt || new Date().toISOString()),
  };
}

function readEntries() {
  var sheet = getOrCreateSheet(RAW_SHEET_NAME, RAW_HEADERS);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  var values = sheet.getRange(2, 1, lastRow - 1, RAW_HEADERS.length).getValues();
  return values
    .filter(function (row) { return row[1] || row[3]; })
    .map(function (row) {
      var entry = {};
      RAW_HEADERS.forEach(function (header, index) {
        var prop = RAW_KEY_MAP[header];
        entry[prop] = row[index];
      });
      entry.date = normalizeDateString(entry.date);
      entry.shop = String(entry.shop || "").toUpperCase();
      entry.shift = String(entry.shift || SHIFT_ASSIGNMENT[entry.shop] || "").replace("Shift ", "").toUpperCase();
      entry.shiftCode = entry.shiftCode || shiftCode(entry.shift);
      entry.id = entry.id || buildReportKey(entry.date, entry.shop, entry.shift);
      entry.affectedDowntimeOccurrences = entry.bdOccurrence;
      entry.hourlyPlan = safeJsonParse(entry.hourlyPlan, []);
      entry.hourlyActual = safeJsonParse(entry.hourlyActual, []);
      entry.lossDetails = safeJsonParse(entry.lossDetails, {});
      return entry;
    });
}

// ── VISIBLE SHEET BUILDERS ──────────────────────────────────────────────────

function rebuildVisibleSheets() {
  var entries = readEntries();
  rebuildLossReportSheet(entries);
  rebuildMeetingReportSheet(entries);
  rebuildAnalyticalSheet(entries);
  hideRawSheetIfPossible();
}

function buildMeetingRows(entries) {
  return (entries || []).map(function (entry) {
    entry = normalizeReport(entry);
    var derived = calcDerived(entry);
    return {
      month: meetingMonth(entry.date),
      date: meetingDate(entry.date),
      shop: entry.shop,
      actualProduction: entry.actualProduction,
      shiftCode: entry.shiftCode,
      timeAvailable: entry.timeAvailable,
      cycleTimeSec: entry.cycleTimeSec,
      capacity: derived.capacity,
      productionTime: derived.productionTime,
      netDt: derived.netDt,
      ar: derived.ar,
      pr: entry.pr,
      qr: entry.qr,
      oe: derived.oePct,
      lineEfficiency: derived.lePct,
      affectedDowntime: entry.affectedDowntime,
      grossDowntime: entry.grossDowntime,
      bdOccurrence: entry.bdOccurrence,
      uptimeAffected: derived.uptimeAffected,
      mttr: derived.mttr,
      mtbf: derived.mtbfHrs,
      grossDTTarget: entry.grossDTTarget,
      uptimeGross: derived.uptimeGross,
      bd: entry.majorBreakdown,
    };
  }).sort(function (a, b) {
    return String(a.date + a.shiftCode + a.shop).localeCompare(String(b.date + b.shiftCode + b.shop));
  });
}

// ── buildDashboardRows ────────────────────────────────────────────────────────
// Returns one row per date+shop combination (shifts aggregated / summed).
// Column names exactly match what production_dashboard.html's getCol() searches for.
function buildDashboardRows(entries) {
  // Group by date+shop key
  var groups = {};
  (entries || []).forEach(function (raw) {
    var entry = normalizeReport(raw);
    var key = entry.date + '|' + entry.shop;
    if (!groups[key]) {
      groups[key] = {
        date: entry.date,
        shop: entry.shop,
        month: meetingMonth(entry.date),
        cycleTimeSec: entry.cycleTimeSec || 0,
        grossDTTarget: entry.grossDTTarget || 0,
        pr: entry.pr,
        qr: entry.qr,
        // accumulators
        actualProduction: 0,
        timeAvailable: 0,
        affectedDowntime: 0,
        grossDowntime: 0,
        bdOccurrence: 0,
        oePctSum: 0,
        lePctSum: 0,
        reportCount: 0,
        bdRemarks: []
      };
    }
    var g = groups[key];
    var derived = calcDerived(entry);
    g.actualProduction  += toNumber(entry.actualProduction);
    g.timeAvailable     += toNumber(entry.timeAvailable);
    g.affectedDowntime  += toNumber(entry.affectedDowntime);
    g.grossDowntime     += toNumber(entry.grossDowntime);
    g.bdOccurrence      += toNumber(entry.bdOccurrence);
    g.oePctSum          += derived.oePct;
    g.lePctSum          += derived.lePct;
    g.reportCount       += 1;
    if (entry.majorBreakdown && String(entry.majorBreakdown).trim()) {
      g.bdRemarks.push(String(entry.majorBreakdown).trim());
    }
    // prefer the largest grossDTTarget seen (TCF-1 = 1589, others = 0)
    if (entry.grossDTTarget > g.grossDTTarget) g.grossDTTarget = entry.grossDTTarget;
  });

  // Flatten + compute derived columns per aggregated row
  var rows = [];
  var keys = Object.keys(groups).sort();
  keys.forEach(function (key) {
    var g = groups[key];
    var n = g.reportCount || 1;

    // Derived aggregates
    var cycle = g.cycleTimeSec || 60;
    var capacity = g.timeAvailable > 0 && cycle > 0
      ? Math.round((g.timeAvailable * 60) / cycle)
      : 0;
    var productionTime = g.actualProduction > 0
      ? Math.round((g.actualProduction * cycle) / 60)
      : 0;
    var netDT = Math.max(g.timeAvailable - productionTime, 0);
    var ar = g.timeAvailable > 0 ? Math.round((productionTime / g.timeAvailable) * 100) / 100 : 0;
    var avgOE = Math.round((g.oePctSum / n) * 100) / 100;
    var avgLE = Math.round((g.lePctSum / n) * 100) / 100;
    // Uptime (Affected DT basis)
    var uptimeAffMin = Math.max(g.timeAvailable - g.affectedDowntime, 0);
    // MTTR = affectedDT / BD occurrences
    var mttr = g.bdOccurrence > 0 ? Math.round((g.affectedDowntime / g.bdOccurrence) * 100) / 100 : 0;
    // MTBF = (avail - affDT) / (bdOccur × 60)
    var mtbf = g.bdOccurrence > 0 ? Math.round((uptimeAffMin / (g.bdOccurrence * 60)) * 100) / 100 : 0;

    // Format date as "02-Apr-26" so the dashboard's toDate() can parse it
    var dateObj = new Date(g.date + 'T00:00:00');
    var dd = String(dateObj.getDate()).padStart(2, '0');
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var mon = months[dateObj.getMonth()];
    var yy = String(dateObj.getFullYear()).slice(2);
    var formattedDate = dd + '-' + mon + '-' + yy;

    rows.push({
      // Identity — column names match dashboard getCol() search patterns
      "Month":                  g.month,
      "Date":                   formattedDate,
      "ShopName":               g.shop,
      // Production
      "Actual Production":      g.actualProduction,
      "Shift":                  g.reportCount,
      "Time (Min)":             g.timeAvailable,
      "Cycle Time (Sec)":       cycle,
      "Capacity":               capacity,
      "Production Time (Min)":  productionTime,
      // Downtime
      "Production DT (Min)":    netDT,        // Col J = Net DT
      "Affected DT (Min)":      g.affectedDowntime,
      "Gross DT (Min)":         g.grossDowntime,
      "BD Occurrence":          g.bdOccurrence,
      // Efficiency ratios
      "AR":                     ar,
      "PR":                     g.pr,
      "QR":                     g.qr,
      "OE":                     avgOE,
      "Line Efficiency":        avgLE,
      // Uptime & reliability
      "Uptime (Min)":           uptimeAffMin,
      "MTTR":                   mttr,
      "MTBF":                   mtbf,
      // Gross DT Target
      "Gross DT (Target)":      g.grossDTTarget,
      // BD text — column Y in the sheet
      "BD":                     g.bdRemarks.join('\n'),
    });
  });

  return rows;
}


function rebuildMeetingReportSheet(optionalEntries) {
  var sheet = getOrCreateSimpleSheet(MEETING_REPORT_SHEET_NAME);
  var entries = optionalEntries || readEntries();
  var rows = buildMeetingRows(entries);

  sheet = resetSheetForRebuild(sheet);
  sheet.getRange(1, 1, 1, MEETING_HEADER_1.length).setValues([MEETING_HEADER_1]);
  sheet.getRange(2, 1, 1, MEETING_HEADER_2.length).setValues([MEETING_HEADER_2]);

  if (rows.length) {
    var values = rows.map(function (row) {
      return [
        row.month,
        row.date,
        row.shop,
        row.actualProduction,
        row.shiftCode,
        row.timeAvailable,
        row.cycleTimeSec,
        "",
        "",
        "",
        "",
        row.pr,
        row.qr,
        "",
        "",
        "",
        row.affectedDowntime,
        row.grossDowntime,
        row.bdOccurrence,
        "",
        "",
        "",
        "",
        "",
      ];
    });
    sheet.getRange(3, 1, values.length, MEETING_HEADER_1.length).setValues(values);
    applyMeetingFormulas(sheet, rows.length);
  }

  styleMeetingSheet(sheet, rows.length);
}

function applyMeetingFormulas(sheet, rowCount) {
  if (!rowCount) return;
  var formulas = [];
  for (var r = 3; r < 3 + rowCount; r++) {
    formulas.push([
      '=IFERROR(ROUND(F' + r + '*60/G' + r + ',0),0)',
      '=IFERROR(ROUND(D' + r + '*G' + r + '/60,0),0)',
      '=IFERROR(ROUND(F' + r + '-I' + r + ',0),0)',
      '=IFERROR(I' + r + '/F' + r + ',0)',
      '=IFERROR(K' + r + '*L' + r + '*M' + r + '*100,0)',
      '=IFERROR(D' + r + '/H' + r + '*100,0)',
      '=IFERROR((F' + r + '-Q' + r + ')/F' + r + ',0)',
      '=IFERROR(Q' + r + '/S' + r + ',0)',
      '=IFERROR(((F' + r + '-Q' + r + ')/S' + r + ')/60,0)',
      '=IFERROR((F' + r + '-R' + r + ')/F' + r + ',0)',
    ]);
  }

  // H:K, N:O, T:V, X use formulas. Formula ranges are applied in blocks.
  var hToK = formulas.map(function (f) { return [f[0], f[1], f[2], f[3]]; });
  var nToO = formulas.map(function (f) { return [f[4], f[5]]; });
  var tToV = formulas.map(function (f) { return [f[6], f[7], f[8]]; });
  var xOnly = formulas.map(function (f) { return [f[9]]; });

  sheet.getRange(3, 8, rowCount, 4).setFormulas(hToK);
  sheet.getRange(3, 14, rowCount, 2).setFormulas(nToO);
  sheet.getRange(3, 20, rowCount, 3).setFormulas(tToV);
  sheet.getRange(3, 24, rowCount, 1).setFormulas(xOnly);
}

var HOUR_SLOTS = {
  A: ["06:30 to 07:30", "07:30 to 08:30", "08:30 to 09:30", "09:30 to 10:30", "10:30 to 11:30", "11:30 to 12:30", "12:30 to 01:30", "01:30 to 02:30", "02:30 to 03:00"],
  B: ["03:00 to 04:00", "04:00 to 05:00", "05:00 to 06:00", "06:00 to 07:00", "07:00 to 08:00", "08:00 to 09:00", "09:00 to 10:00", "10:00 to 11:00", "11:00 to 11:30"],
  C: ["11:30 to 12:30", "12:30 to 01:30", "01:30 to 02:30", "02:30 to 03:30", "03:30 to 04:30", "04:30 to 05:30", "05:30 to 06:30"],
};

function defaultHourlyPlan(capacity, shift) {
  var slots = HOUR_SLOTS[shift] || HOUR_SLOTS.C;
  var total = Math.max(0, Math.round(toNumber(capacity)));
  if (!slots.length) return [];
  var base = Math.floor(total / slots.length);
  var remaining = total - base * slots.length;
  return slots.map(function() {
    var value = base + (remaining > 0 ? 1 : 0);
    remaining -= 1;
    return value;
  });
}

function normalizeHourlyArray(value, shift, fallbackTotal) {
  var slots = HOUR_SLOTS[shift] || HOUR_SLOTS.C;
  var arr = safeJsonParse(value, []);
  if (!Array.isArray(arr)) arr = [];
  var out = slots.map(function(_, i) { return toNumber(arr[i], 0); });
  var hasValues = false;
  for (var i = 0; i < out.length; i++) {
    if (out[i] > 0) {
      hasValues = true;
      break;
    }
  }
  if (!hasValues && fallbackTotal > 0) return defaultHourlyPlan(fallbackTotal, shift);
  return out;
}

function safeJsonParse(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === "object")) return value;
  if (!value) return fallback;
  try { return JSON.parse(value); } catch(e) { return fallback; }
}

function rebuildLossReportSheet(optionalEntries) {
  var sheet = getOrCreateSimpleSheet(LOSS_REPORT_SHEET_NAME);
  var entries = optionalEntries || readEntries();
  
  sheet = resetSheetForRebuild(sheet);
  
  if (!entries.length) return;
  
  // Sort entries to find the single latest one based on lastUpdatedAt
  var sorted = entries.slice().sort(function (a, b) {
    var dateA = new Date(a.lastUpdatedAt || a.submittedAt || 0).getTime();
    var dateB = new Date(b.lastUpdatedAt || b.submittedAt || 0).getTime();
    return dateB - dateA;
  });
  
  var latestEntry = sorted[0];
  var e = normalizeReport(latestEntry);
  var derived = calcDerived(e);
  
  var blockValues = [];
  var slots = HOUR_SLOTS[e.shift] || [];
  var fixedPlanCapacity = calculatePlannedCapacity(e.shift, e.cycleTimeSec);
  var plan = normalizeHourlyArray(latestEntry.hourlyPlan, e.shift, fixedPlanCapacity);
  var actual = normalizeHourlyArray(latestEntry.hourlyActual, e.shift, 0);
  var actualTotal = actual.reduce(function(a, b) { return a + b; }, 0);
  var efficiency = plan.map(function(p, idx) { return p ? Math.round((actual[idx] / p) * 100) + "%" : "0%"; });
  var overallEff = derived.capacity ? Math.round((actualTotal / derived.capacity) * 100) + "%" : "0%";
  var lossCategories = getLossCategories(e.shop);
  function lossLabel(index) { return lossCategories[index] ? lossCategories[index][1] : ""; }
  function lossValue(index) { return lossCategories[index] ? toNumber(latestEntry[lossCategories[index][0]]) : ""; }

  blockValues.push(["For Date", meetingDate(e.date), "", "", "", "Loss Time summary", "DT (Min)"]);
  blockValues.push(["Shop", e.shop || "", "", "", "", lossLabel(0), lossValue(0)]);
  blockValues.push(["Shift", e.shift, "", "", "", lossLabel(1), lossValue(1)]);
  blockValues.push(["", "", "", "", "", lossLabel(2), lossValue(2)]);
  blockValues.push(["Production", "Day", "", "", "", lossLabel(3), lossValue(3)]);
  blockValues.push(["Capacity", derived.capacity, "", "", "", lossLabel(4), lossValue(4)]);
  blockValues.push(["Cycle Time in Sec.", e.cycleTimeSec, "", "", "", lossLabel(5), lossValue(5)]);
  blockValues.push(["Actual Prod. Nos.", e.actualProduction, "", "", "", lossLabel(6), lossValue(6)]);
  blockValues.push([e.shop + " Production Loss", derived.productionLoss, "", "", "", lossLabel(7), lossValue(7)]);
  blockValues.push(["Loss Time in Min", derived.lossTime, "", "", "", lossLabel(8), lossValue(8)]);
  for (var lossIndex = 9; lossIndex < lossCategories.length; lossIndex++) {
    blockValues.push(["", "", "", "", "", lossLabel(lossIndex), lossValue(lossIndex)]);
  }
  blockValues.push(["", "", "", "", "", "Total", derived.lossTime]);
  blockValues.push([]);
  blockValues.push(["Hourly Production Chart"]);
  
  var hourHeaders = ["Hours"].concat(slots).concat(["Total"]);
  var hourPlans = ["Plan"].concat(plan).concat([derived.capacity]);
  var hourActuals = ["Actual"].concat(actual).concat([actualTotal || e.actualProduction]);
  var hourEffs = ["Efficient"].concat(efficiency).concat([overallEff]);
  
  blockValues.push(hourHeaders);
  blockValues.push(hourPlans);
  blockValues.push(hourActuals);
  blockValues.push(hourEffs);
  
  blockValues.push([]);
  blockValues.push(["Breakdown / Remarks", e.majorBreakdown || "—"]);
  var lossDetails = safeJsonParse(latestEntry.lossDetails || e.lossDetails, {});
  var lossUsageRows = [];
  lossCategories.forEach(function (loss) {
    var details = Array.isArray(lossDetails[loss[0]]) ? lossDetails[loss[0]] : [];
    details.forEach(function (detail) {
      lossUsageRows.push([loss[1], toText(detail.machine), toNumber(detail.minutes), toText(detail.remarks)]);
    });
  });
  var lossSummaryInfo = null;
  if (lossUsageRows.length) {
    blockValues.push([]);
    var titleIndex = blockValues.length;
    blockValues.push(["Loss Time Summary in Min"]);
    var headerIndex = blockValues.length;
    blockValues.push(["Category", "Min", "Major Reasons Today"]);
    var categoryIndexes = [];
    var detailIndexes = [];
    lossCategories.forEach(function (loss) {
      var rows = lossUsageRows.filter(function (row) { return row[0] === loss[1]; });
      if (!rows.length) return;
      categoryIndexes.push(blockValues.length);
      blockValues.push([loss[1]]);
      rows.forEach(function (row) {
        detailIndexes.push(blockValues.length);
        blockValues.push([row[1], row[2], row[3] || row[1]]);
      });
    });
    var totalIndex = blockValues.length;
    var lossUsageTotal = lossUsageRows.reduce(function (sum, row) { return sum + toNumber(row[2]); }, 0);
    blockValues.push(["Total", lossUsageTotal, ""]);
    lossSummaryInfo = {
      titleIndex: titleIndex,
      headerIndex: headerIndex,
      categoryIndexes: categoryIndexes,
      detailIndexes: detailIndexes,
      totalIndex: totalIndex
    };
  }
  blockValues.push([]);
  blockValues.push([]);
  
  var rowCount = blockValues.length;
  var colCount = Math.max(7, hourHeaders.length);
  
  if (sheet.getMaxColumns() < colCount) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), colCount - sheet.getMaxColumns());
  }
  
  var range = sheet.getRange(1, 1, rowCount, colCount);
  var paddedValues = blockValues.map(function(row) {
    var arr = [];
    for (var c = 0; c < colCount; c++) {
      arr.push(row[c] !== undefined ? row[c] : "");
    }
    return arr;
  });
  range.setValues(paddedValues);
  
  styleLossReportBlock(sheet, 1, e, derived, slots.length);
  if (lossSummaryInfo) styleLossDescriptionSummary(sheet, 1, lossSummaryInfo);
}

function styleLossReportBlock(sheet, startRow, e, derived, slotCount) {
  var fontName = "Georgia";
  var blockRange = sheet.getRange(startRow, 1, 26, 7 + slotCount);
  blockRange.setFontFamily(fontName).setFontWeight("bold");
  
  sheet.getRange(startRow, 1).setBackground("#f3f4f7");
  sheet.getRange(startRow, 2).setBackground("#fffec5").setHorizontalAlignment("center");
  sheet.getRange(startRow, 2).setNumberFormat("dd-mmm-yy");
  
  sheet.getRange(startRow + 1, 1).setBackground("#e2edf7");
  sheet.getRange(startRow + 1, 2, 1, 3).merge().setHorizontalAlignment("left");
  
  sheet.getRange(startRow + 2, 1).setBackground("#dbe8f4");
  sheet.getRange(startRow + 2, 2, 1, 3).merge().setHorizontalAlignment("left");
  
  sheet.getRange(startRow + 4, 1, 1, 2).setBackground("#f3f4f7").setHorizontalAlignment("center");
  
  sheet.getRange(startRow + 5, 2).setBackground("#fffec5").setHorizontalAlignment("center");
  sheet.getRange(startRow + 6, 2).setBackground("#fffec5").setHorizontalAlignment("center");
  sheet.getRange(startRow + 7, 2, 3, 1).setHorizontalAlignment("center");
  
  sheet.getRange(startRow + 4, 1, 7, 2).setBorder(true, true, true, true, true, true, "#999999", SpreadsheetApp.BorderStyle.SOLID);
  
  sheet.getRange(startRow, 6, 1, 2).setBackground("#f3f4f7").setHorizontalAlignment("center");
  sheet.getRange(startRow, 6, 14, 2).setBorder(true, true, true, true, true, true, "#999999", SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(startRow + 13, 6).setHorizontalAlignment("right");
  sheet.getRange(startRow + 13, 7).setHorizontalAlignment("center");
  
  sheet.getRange(startRow + 15, 1).setFontSize(11);
  
  var hourlyRange = sheet.getRange(startRow + 17, 1, 4, slotCount + 2);
  hourlyRange.setBorder(true, true, true, true, true, true, "#999999", SpreadsheetApp.BorderStyle.SOLID);
  hourlyRange.setHorizontalAlignment("center");
  sheet.getRange(startRow + 17, 1, 4, 1).setHorizontalAlignment("left");
  
  sheet.getRange(startRow + 18, 2, 3, slotCount + 1).setBackground("#fffec5");
  
  sheet.getRange(startRow + 22, 1, 1, 2).setFontSize(10);
  sheet.getRange(startRow + 22, 2, 1, slotCount + 1).merge().setHorizontalAlignment("left").setWrap(true);
  sheet.getRange(startRow + 22, 1, 1, slotCount + 2).setBorder(true, true, true, true, true, true, "#999999", SpreadsheetApp.BorderStyle.SOLID);
}

function styleLossDescriptionSummary(sheet, startRow, info) {
  function rowNumber(index) { return startRow + index; }

  var titleRow = rowNumber(info.titleIndex);
  sheet.getRange(titleRow, 1, 1, 3).merge()
    .setFontFamily("Georgia").setFontWeight("bold").setFontSize(13)
    .setBackground("#f3f4f7").setHorizontalAlignment("left");

  var headerRow = rowNumber(info.headerIndex);
  sheet.getRange(headerRow, 1, 1, 3)
    .setFontFamily("Georgia").setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setBorder(true, true, true, true, true, true, "#999999", SpreadsheetApp.BorderStyle.SOLID);

  info.categoryIndexes.forEach(function (index) {
    sheet.getRange(rowNumber(index), 1, 1, 3).merge()
      .setFontFamily("Georgia").setFontWeight("bold")
      .setBackground("#dbe8f4").setHorizontalAlignment("center")
      .setBorder(true, true, true, true, true, true, "#999999", SpreadsheetApp.BorderStyle.SOLID);
  });

  info.detailIndexes.forEach(function (index) {
    var row = rowNumber(index);
    sheet.getRange(row, 1, 1, 3)
      .setFontFamily("Georgia").setFontWeight("normal").setVerticalAlignment("middle")
      .setBorder(true, true, true, true, true, true, "#999999", SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange(row, 2, 1, 2).setBackground("#fffec5").setWrap(true);
    sheet.getRange(row, 2).setHorizontalAlignment("center");
  });

  var totalRow = rowNumber(info.totalIndex);
  sheet.getRange(totalRow, 1, 1, 3)
    .setFontFamily("Georgia").setFontWeight("bold").setBackground("#bdd7ee")
    .setBorder(true, true, true, true, true, true, "#999999", SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(totalRow, 1).setHorizontalAlignment("right");
  sheet.getRange(totalRow, 2).setHorizontalAlignment("center");
}

function rebuildAnalyticalSheet(optionalEntries) {
  var sheet = getOrCreateSimpleSheet(ANALYTICAL_SHEET_NAME);
  var entries = optionalEntries || readEntries();
  var payload = buildAnalyticsPayload(entries);
  sheet = resetSheetForRebuild(sheet);

  var row = 1;
  row = writeAnalyticsTitle(sheet, row, "TATA MOTORS Analytical Sheet");
  row = writeAnalyticsSection(sheet, row, "1. Shop Wise", ANALYTICS_HEADERS, payload.shopWise);
  row = writeAnalyticsSection(sheet, row, "2. Month Wise", ANALYTICS_HEADERS, payload.monthWise);
  row = writeAnalyticsSection(sheet, row, "3. Day Wise + Sum Up", ANALYTICS_HEADERS, payload.dayWise);
  row = writeAnalyticsSection(sheet, row, "4. Cumulative Losses", ["Date", "Daily Gross DT", "Cumulative Gross DT", "Cumulative Affected DT", "Cumulative BD Occurrence"], payload.cumulativeLosses);
  row = writeAnalyticsSection(sheet, row, "5. Breakdown Losses", ["Date", "Shop", "Shift", "Loss Min", "Affected DT", "BD Occurrence", "MTTR Min", "Breakdown Details"], payload.breakdownLosses);
  row = writeAnalyticsSection(sheet, row, "6. Parameter (MTBR / MTTR / OEE)", ["Shop", "AR", "PR", "QR", "OE %", "Line Efficiency %", "MTTR Min", "MTBR Hrs", "Uptime Affected %", "Uptime Gross %"], payload.parameters);

  styleAnalyticalSheet(sheet);
}

function writeAnalyticsTitle(sheet, row, title) {
  sheet.getRange(row, 1, 1, 6).merge();
  sheet.getRange(row, 1).setValue(title);
  sheet.getRange(row, 1).setBackground("#111827").setFontColor("#ffffff").setFontSize(15).setFontWeight("bold");
  return row + 2;
}

function writeAnalyticsSection(sheet, row, title, headers, rows) {
  sheet.getRange(row, 1, 1, Math.min(headers.length, 8)).merge();
  sheet.getRange(row, 1).setValue(title);
  sheet.getRange(row, 1).setBackground("#1a73e8").setFontColor("#ffffff").setFontWeight("bold");
  row++;

  sheet.getRange(row, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(row, 1, 1, headers.length).setBackground("#dbeafe").setFontWeight("bold").setHorizontalAlignment("center");
  row++;

  if (rows && rows.length) {
    sheet.getRange(row, 1, rows.length, headers.length).setValues(rows);
    row += rows.length;
  } else {
    sheet.getRange(row, 1).setValue("No data");
    row++;
  }
  return row + 2;
}

function buildAnalyticsPayload(entries) {
  entries = (entries || []).map(function (e) { return normalizeReport(e); });
  var shopWiseRows = aggregateRows(entries, function (e) { return e.shop; }, function (e) { return e.shop; });
  var monthWiseRows = aggregateRows(entries, function (e) { return monthSortKey(e.date); }, function (e) { return meetingMonth(e.date); });
  var dayWiseRows = aggregateRows(entries, function (e) { return normalizeDateString(e.date); }, function (e) { return meetingDate(e.date); });

  return {
    shopWise: shopWiseRows.map(analyticsRowValues),
    monthWise: monthWiseRows.map(analyticsRowValues),
    dayWise: dayWiseRows.map(analyticsRowValues),
    cumulativeLosses: buildCumulativeLosses(dayWiseRows),
    breakdownLosses: buildBreakdownLosses(entries),
    parameters: shopWiseRows.map(function (row) {
      return [row.label, row.avgAr, row.avgPr, row.avgQr, row.avgOe, row.avgLe, row.mttr, row.mtbfHrs, row.uptimeAffectedPct, row.uptimeGrossPct];
    }),
  };
}

function aggregateRows(entries, keyFn, labelFn) {
  var grouped = {};
  entries.forEach(function (entry) {
    var key = keyFn(entry);
    if (!key) return;
    if (!grouped[key]) grouped[key] = createAggregate(key, labelFn(entry, key));
    addToAggregate(grouped[key], entry);
  });

  return Object.keys(grouped).sort().map(function (key) { return finalizeAggregate(grouped[key]); });
}

function createAggregate(key, label) {
  return {
    key: key,
    label: label,
    reports: 0,
    production: 0,
    capacity: 0,
    productionTime: 0,
    netDt: 0,
    affectedDt: 0,
    grossDt: 0,
    bdOccurrence: 0,
    grossDTTarget: 0,
    arTotal: 0,
    prTotal: 0,
    qrTotal: 0,
    oeTotal: 0,
    leTotal: 0,
    breakdownLoss: 0,
    availableTime: 0,
  };
}

function addToAggregate(row, entry) {
  var d = calcDerived(entry);
  row.reports += 1;
  row.production += entry.actualProduction;
  row.capacity += d.capacity;
  row.productionTime += d.productionTime;
  row.netDt += d.netDt;
  row.affectedDt += entry.affectedDowntime;
  row.grossDt += entry.grossDowntime;
  row.bdOccurrence += entry.bdOccurrence;
  row.grossDTTarget += entry.grossDTTarget;
  row.arTotal += d.ar;
  row.prTotal += entry.pr;
  row.qrTotal += entry.qr;
  row.oeTotal += d.oePct;
  row.leTotal += d.lePct;
  row.availableTime += entry.timeAvailable;
  if (toText(entry.majorBreakdown).trim() || entry.bdOccurrence > 0) row.breakdownLoss += entry.grossDowntime;
}

function finalizeAggregate(row) {
  row.avgAr = row.reports ? round1(row.arTotal / row.reports) : 0;
  row.avgPr = row.reports ? round1(row.prTotal / row.reports) : 0;
  row.avgQr = row.reports ? round3(row.qrTotal / row.reports) : 0;
  row.avgOe = row.reports ? round1(row.oeTotal / row.reports) : 0;
  row.avgLe = row.reports ? round1(row.leTotal / row.reports) : 0;
  row.mttr = row.bdOccurrence ? round1(row.affectedDt / row.bdOccurrence) : 0;
  row.mtbfHrs = row.bdOccurrence ? round1(Math.max(row.availableTime - row.affectedDt, 0) / (row.bdOccurrence * 60)) : 0;
  row.uptimeAffectedPct = sumAvailableProxy(row) ? round1(((sumAvailableProxy(row) - row.affectedDt) / sumAvailableProxy(row)) * 100) : 0;
  row.uptimeGrossPct = sumAvailableProxy(row) ? round1(((sumAvailableProxy(row) - row.grossDt) / sumAvailableProxy(row)) * 100) : 0;
  return row;
}

function sumAvailableProxy(row) {
  return row.productionTime + row.netDt;
}

function analyticsRowValues(row) {
  return [
    row.label,
    row.reports,
    row.production,
    round1(row.capacity),
    round1(row.productionTime),
    round1(row.netDt),
    row.affectedDt,
    row.grossDt,
    row.bdOccurrence,
    row.grossDTTarget,
    row.avgAr,
    row.avgPr,
    row.avgQr,
    row.avgOe,
    row.avgLe,
    row.mttr,
    row.mtbfHrs,
    row.uptimeAffectedPct,
    row.uptimeGrossPct,
    row.breakdownLoss,
  ];
}

function buildCumulativeLosses(dayRows) {
  var gross = 0;
  var affected = 0;
  var bd = 0;
  return dayRows.map(function (row) {
    gross += row.grossDt;
    affected += row.affectedDt;
    bd += row.bdOccurrence;
    return [row.label, row.grossDt, gross, affected, bd];
  });
}

function buildBreakdownLosses(entries) {
  return entries
    .filter(function (entry) { return toText(entry.majorBreakdown).trim() || entry.bdOccurrence > 0 || entry.grossDowntime > 0; })
    .sort(function (a, b) { return String(b.date + b.shop).localeCompare(String(a.date + a.shop)); })
    .map(function (entry) {
      var derived = calcDerived(entry);
      return [
        meetingDate(entry.date),
        entry.shop,
        "Shift " + entry.shift,
        entry.grossDowntime,
        entry.affectedDowntime,
        entry.bdOccurrence,
        derived.mttr,
        entry.majorBreakdown || "—",
      ];
    });
}

// ── SHEET SETUP / FORMATTING ─────────────────────────────────────────────────

function ensureWorkbook() {
  getOrCreateSheet(RAW_SHEET_NAME, RAW_HEADERS);
  getOrCreateSimpleSheet(LOSS_REPORT_SHEET_NAME);
  getOrCreateSimpleSheet(MEETING_REPORT_SHEET_NAME);
  getOrCreateSimpleSheet(ANALYTICAL_SHEET_NAME);
}

function getSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID.trim()) return SpreadsheetApp.openById(SPREADSHEET_ID.trim());
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("No active spreadsheet found. Bind this script to a Sheet or set SPREADSHEET_ID.");
  return ss;
}

function getOrCreateSimpleSheet(name) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.isSheetHidden && sheet.isSheetHidden()) sheet.showSheet();
  return sheet;
}

function getOrCreateSheet(name, headers) {
  var sheet = getOrCreateSimpleSheet(name);
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }
  var existingWidth = Math.max(sheet.getLastColumn(), headers.length);
  var firstRow = sheet.getRange(1, 1, 1, existingWidth).getValues()[0];
  var currentHeaders = firstRow.slice(0, headers.length).map(function (value) { return String(value || "").trim(); }).join("|");
  var expectedHeaders = headers.join("|");
  var hasUnexpectedHeaders = firstRow.slice(headers.length).some(function (value) { return String(value || "").trim(); });
  if (currentHeaders !== expectedHeaders || hasUnexpectedHeaders) migrateSheetHeaders(sheet, firstRow, headers);
  styleRawSheet(sheet, headers);
  return sheet;
}

function resetSheetForRebuild(sheet) {
  // These are generated views, so recreate them instead of attempting to repair
  // an inconsistent legacy merge range. Main Data is never passed to this helper.
  try {
    sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
    sheet.clear();
    return sheet;
  } catch (error) {
    // Fall through to the replacement path for an unrecoverable legacy merge.
  }

  var spreadsheet = sheet.getParent();
  var name = sheet.getName();
  var index = sheet.getIndex() - 1;
  var activeSheet = spreadsheet.getActiveSheet();

  if (activeSheet && activeSheet.getSheetId() === sheet.getSheetId()) {
    var fallbackSheet = spreadsheet.getSheets().filter(function (candidate) {
      return candidate.getSheetId() !== sheet.getSheetId();
    })[0];
    if (fallbackSheet) spreadsheet.setActiveSheet(fallbackSheet);
  }

  // Some legacy sheets have a corrupted merge definition that even blocks
  // deletion. Rename and hide that tab, then create a clean replacement.
  var archiveName = "__rebuild_backup_" + name + "_" + new Date().getTime();
  sheet.setName(archiveName);
  sheet.hideSheet();
  return spreadsheet.insertSheet(name, Math.max(0, index));
}

function migrateSheetHeaders(sheet, oldHeaders, newHeaders) {
  var lastRow = sheet.getLastRow();
  var oldWidth = oldHeaders.length;
  var aliases = {
    "Breakdown Details": ["Major Breakdown", "BD / Breakdown Details"],
    "BD Occurrence": ["Affected Downtime Occurrence", "Affected Downtime Occurrences"],
    "Time Available (Min)": ["Available Time", "Available Time (Min)", "Total Time (Min)"],
    "Actual Production": ["Production", "Actual Prod. Nos."],
    "Shop Name": ["Shop", "ShopName"],
  };
  var headerIndex = {};

  oldHeaders.forEach(function (header, index) {
    var clean = String(header || "").trim();
    if (clean) headerIndex[clean] = index;
  });

  Object.keys(aliases).forEach(function (target) {
    if (headerIndex[target] != null) return;
    aliases[target].some(function (alias) {
      if (headerIndex[alias] == null) return false;
      headerIndex[target] = headerIndex[alias];
      return true;
    });
  });

  var migratedRows = [];
  if (lastRow > 1 && Object.keys(headerIndex).length) {
    var oldRows = sheet.getRange(2, 1, lastRow - 1, oldWidth).getValues();
    migratedRows = oldRows.map(function (oldRow, rowIndex) {
      var migrated = newHeaders.map(function (header) {
        var index = headerIndex[header];
        return index == null ? "" : oldRow[index];
      });
      var date = migrated[newHeaders.indexOf("Date")];
      var shop = migrated[newHeaders.indexOf("Shop Name")];
      var shift = migrated[newHeaders.indexOf("Shift")];
      var keyIndex = newHeaders.indexOf("Key");
      var snIndex = newHeaders.indexOf("SN");
      if (!migrated[keyIndex] && date && shop && shift) migrated[keyIndex] = buildReportKey(date, shop, shift);
      if (!migrated[snIndex]) migrated[snIndex] = rowIndex + 1;
      return migrated;
    });
  }

  sheet.clearContents();
  sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
  if (migratedRows.length) {
    sheet.getRange(2, 1, migratedRows.length, newHeaders.length).setValues(migratedRows);
  }
}

function styleRawSheet(sheet, headers) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setBackground("#111827").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
  sheet.autoResizeColumns(1, headers.length);
}

function styleMeetingSheet(sheet, rowCount) {
  var totalRows = Math.max(rowCount + 2, 3);
  var totalCols = MEETING_HEADER_1.length;
  try {
    sheet.setFrozenRows(2);
  } catch (error) {
    // A manually merged range can block the freeze boundary; it must not block a report save.
  }
  sheet.getRange(1, 1, 1, totalCols).setBackground("#111827").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle");
  sheet.getRange(2, 1, 1, totalCols).setBackground("#1e3a8a").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle");
  sheet.getRange(1, 1, 2, totalCols).setWrap(true);
  sheet.getRange(1, 1, totalRows, totalCols).setBorder(true, true, true, true, true, true, "#d1d5db", SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(3, 1, Math.max(rowCount, 1), totalCols).setVerticalAlignment("middle");
  if (rowCount) {
    [4, 6, 7, 12, 13, 17, 18, 19].forEach(function (col) {
      sheet.getRange(3, col, rowCount, 1).setBackground("#ffffff");
    });
    [8, 9, 10, 11, 14, 15, 20, 21, 22, 24].forEach(function (col) {
      sheet.getRange(3, col, rowCount, 1).setBackground("#e5e7eb");
    });
    sheet.getRange(3, 16, rowCount, 1).setBackground("#fff200");
    sheet.getRange(3, 1, rowCount, 24).setHorizontalAlignment("center");
    sheet.getRange(3, 1, rowCount, 1).setNumberFormat("mmm''yy");
    sheet.getRange(3, 2, rowCount, 1).setNumberFormat("dd-mmm-yy");
    sheet.getRange(3, 11, rowCount, 3).setNumberFormat("0.0");
    sheet.getRange(3, 14, rowCount, 2).setNumberFormat("0");
    sheet.getRange(3, 20, rowCount, 1).setNumberFormat("0.0");
    sheet.getRange(3, 21, rowCount, 2).setNumberFormat("0.0");
    sheet.getRange(3, 24, rowCount, 1).setNumberFormat("0.0");
  }
  var widths = [80, 100, 110, 120, 70, 120, 120, 100, 140, 130, 70, 70, 70, 70, 110, 70, 130, 120, 120, 180, 120, 120, 70, 180];
  widths.forEach(function (width, idx) { sheet.setColumnWidth(idx + 1, width); });
  sheet.setRowHeights(1, 2, 32);
}

function styleAnalyticalSheet(sheet) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), Math.max(sheet.getLastColumn(), 1)).setWrap(true).setVerticalAlignment("middle");
  sheet.autoResizeColumns(1, Math.max(sheet.getLastColumn(), 1));
  for (var c = 1; c <= Math.max(sheet.getLastColumn(), 1); c++) {
    sheet.setColumnWidth(c, Math.min(Math.max(sheet.getColumnWidth(c), 100), 180));
  }
}

function formatRawRow(sheet, rowIndex, width) {
  var range = sheet.getRange(rowIndex, 1, 1, width);
  range.setBackground(rowIndex % 2 === 0 ? "#f8f9ff" : "#ffffff");
  range.setBorder(false, false, true, false, false, false, "#e0e0e0", SpreadsheetApp.BorderStyle.SOLID);
}

function hideRawSheetIfPossible() {
  try {
    var ss = getSpreadsheet();
    var raw = ss.getSheetByName(RAW_SHEET_NAME);
    var visible = ss.getSheets().filter(function (s) { return !s.isSheetHidden(); });
    if (raw && visible.length > 1 && !raw.isSheetHidden()) raw.hideSheet();
  } catch (err) {
    // Hiding is optional. Do not block submissions if it fails.
  }
}

function findRowByKey(sheet, key) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;
  var keys = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]) === String(key)) return i + 2;
  }
  return null;
}

function getNextSN(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 1;
  var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var max = 0;
  values.forEach(function (row) {
    var n = parseInt(row[0], 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return max + 1;
}

// Optional cleanup if you previously used older versions.
function deleteLegacySheets() {
  var ss = getSpreadsheet();
  ["Shift A", "Shift B", "Shift C", "ShopWise Per Shift", "Main Data"].forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (sheet && name !== RAW_SHEET_NAME) ss.deleteSheet(sheet);
  });
}

// ── EMAILS ───────────────────────────────────────────────────────────────────

function sendSubmissionEmail(entry, mode) {
  if (!ADMIN_EMAIL || ADMIN_EMAIL === "admin@yourcompany.com") return;

  var ssUrl = getSpreadsheet().getUrl();
  var d = calcDerived(entry);
  var verb = mode === "updated" ? "Updated" : "Submitted";
  var subject = "TATA MOTORS: Report " + verb + " — " + entry.shop + " | Shift " + entry.shift + " | " + entry.date;

  var html =
    '<div style="font-family:Arial,sans-serif;background:#f4f6fb;padding:22px">' +
    '<div style="max-width:760px;margin:auto;background:white;border-radius:14px;overflow:hidden;border:1px solid #dde3f2">' +
    '<div style="background:#111827;color:white;padding:22px 26px">' +
    '<h2 style="margin:0">TATA MOTORS Shift Report ' + verb + '</h2>' +
    '<p style="margin:6px 0 0">Converted into Meeting Excel Sheet and Analytical Sheet.</p>' +
    '</div>' +
    '<div style="padding:22px 26px">' +
    '<p><b>Date:</b> ' + entry.date + ' &nbsp; <b>Shop:</b> ' + entry.shop + ' &nbsp; <b>Shift:</b> ' + entry.shift + '</p>' +
    '<table style="width:100%;border-collapse:collapse;font-size:14px">' +
    tableRow("Actual Production", entry.actualProduction) +
    tableRow("Capacity", d.capacity) +
    tableRow("Production Time", d.productionTime) +
    tableRow("Net DT", d.netDt) +
    tableRow("OE %", d.oePct) +
    tableRow("Line Efficiency %", d.lePct) +
    tableRow("Affected DT", entry.affectedDowntime) +
    tableRow("Gross DT", entry.grossDowntime) +
    tableRow("BD Occurrence", entry.bdOccurrence) +
    tableRow("MTTR", d.mttr) +
    tableRow("MTBR Hrs", d.mtbfHrs) +
    tableRow("Breakdown", entry.majorBreakdown || "—") +
    '</table>' +
    '<p style="text-align:center;margin-top:24px"><a href="' + ssUrl + '" style="background:#1a73e8;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Open Google Sheet</a></p>' +
    '</div></div></div>';

  MailApp.sendEmail({ to: ADMIN_EMAIL, subject: subject, htmlBody: html });
}

function tableRow(label, value) {
  return '<tr><td style="padding:9px;border-bottom:1px solid #eee;color:#667085;font-weight:bold">' + label + '</td><td style="padding:9px;border-bottom:1px solid #eee">' + value + '</td></tr>';
}

function sendMissingUploadReminder(date, onlyShift) {
  if (!ADMIN_EMAIL || ADMIN_EMAIL === "admin@yourcompany.com") return;

  date = normalizeDateString(date || todayString());
  var missing = getMissingUploads(date, onlyShift);
  var lines = [];

  Object.keys(missing).forEach(function (shift) {
    if (missing[shift].length) lines.push("Shift " + shift + ": " + missing[shift].join(", "));
  });

  if (!lines.length) return;

  MailApp.sendEmail({
    to: ADMIN_EMAIL,
    subject: "TATA MOTORS Missing Upload Reminder — " + date,
    htmlBody: '<div style="font-family:Arial,sans-serif"><h2>Missing TATA MOTORS Operations Uploads</h2><ul>' + lines.map(function (line) { return '<li>' + line + '</li>'; }).join("") + '</ul><p><a href="' + getSpreadsheet().getUrl() + '">Open Google Sheet</a></p></div>',
  });
}

function sendDailyExcelReport(date) {
  if (!ADMIN_EMAIL || ADMIN_EMAIL === "admin@yourcompany.com") return;

  date = typeof date === "string" ? normalizeDateString(date) : todayString();
  ensureWorkbook();
  rebuildVisibleSheets();

  var ss = getSpreadsheet();
  var xlsxBlob = exportSpreadsheetAsXlsxBlob(ss);
  xlsxBlob.setName("TATA_MOTORS_Meeting_Analytical_" + date + ".xlsx");

  var missing = getMissingUploads(date, null);
  var missingLines = [];
  Object.keys(missing).forEach(function (shift) {
    missingLines.push("Shift " + shift + ": " + (missing[shift].length ? missing[shift].join(", ") : "All uploaded"));
  });

  var html =
    '<div style="font-family:Arial,sans-serif">' +
    '<h2>TATA MOTORS Daily Excel Report</h2>' +
    '<p>Date: <b>' + date + '</b></p>' +
    '<p>The attached workbook contains the visible Meeting Excel Sheet and Analytical Sheet.</p>' +
    '<h3>Upload Status</h3><ul>' + missingLines.map(function (line) { return '<li>' + line + '</li>'; }).join("") + '</ul>' +
    '</div>';

  MailApp.sendEmail({ to: ADMIN_EMAIL, subject: "TATA MOTORS Meeting + Analytical Report — " + date, htmlBody: html, attachments: [xlsxBlob] });
}

function exportSpreadsheetAsXlsxBlob(ss) {
  var url = "https://docs.google.com/spreadsheets/d/" + ss.getId() + "/export?format=xlsx";
  var token = ScriptApp.getOAuthToken();
  var response = UrlFetchApp.fetch(url, { headers: { Authorization: "Bearer " + token } });
  return response.getBlob();
}

// ── MISSING UPLOADS / TRIGGERS ───────────────────────────────────────────────

function getMissingUploads(date, onlyShift) {
  date = normalizeDateString(date || todayString());
  var entries = readEntries().filter(function (entry) { return normalizeDateString(entry.date) === date; });
  var shifts = onlyShift ? [onlyShift] : ["A", "B", "C"];
  var result = {};

  shifts.forEach(function (shift) {
    shift = String(shift).replace("Shift ", "").toUpperCase();
    var expected = SHOPS.filter(function (shop) { return SHIFT_ASSIGNMENT[shop] === shift; });
    var submitted = entries.filter(function (entry) { return String(entry.shift).replace("Shift ", "").toUpperCase() === shift; }).map(function (entry) { return String(entry.shop).toUpperCase(); });
    result[shift] = expected.filter(function (shop) { return submitted.indexOf(shop) === -1; });
  });

  return result;
}

function createDefaultTriggers() {
  deletePlantOpsTriggers();
  ScriptApp.newTrigger("sendDailyExcelReport").timeBased().everyDays(1).atHour(DAILY_EXCEL_REPORT_HOUR).create();
  ScriptApp.newTrigger("sendMissingReminderShiftA").timeBased().everyDays(1).atHour(15).create();
  ScriptApp.newTrigger("sendMissingReminderShiftB").timeBased().everyDays(1).atHour(23).create();
  ScriptApp.newTrigger("sendMissingReminderShiftC").timeBased().everyDays(1).atHour(7).create();
}

function deletePlantOpsTriggers() {
  var names = ["sendDailyExcelReport", "sendMissingReminderShiftA", "sendMissingReminderShiftB", "sendMissingReminderShiftC"];
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (names.indexOf(trigger.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(trigger);
  });
}

function sendMissingReminderShiftA() { sendMissingUploadReminder(todayString(), "A"); }
function sendMissingReminderShiftB() { sendMissingUploadReminder(todayString(), "B"); }
function sendMissingReminderShiftC() { sendMissingUploadReminder(todayString(), "C"); }

// ── CALCULATIONS / UTILITIES ─────────────────────────────────────────────────

function calcDerived(entry) {
  var actual = toNumber(entry.actualProduction);
  var available = toNumber(entry.timeAvailable);
  var cycle = toNumber(entry.cycleTimeSec);
  var pr = configuredNumber(entry.pr, 1.0);
  var qr = configuredNumber(entry.qr, getFixedQR(entry.shop));
  var affected = toNumber(entry.affectedDowntime);
  var gross = toNumber(entry.grossDowntime);
  var bd = toNumber(entry.bdOccurrence != null ? entry.bdOccurrence : entry.affectedDowntimeOccurrences);

  var capacity = available > 0 && cycle > 0 ? round1((available * 60) / cycle) : 0;
  var productionTime = actual > 0 && cycle > 0 ? round1((actual * cycle) / 60) : 0;
  var netDt = round1(available - productionTime);
  var ar = available ? round1(productionTime / available) : 0;
  var oePct = round1(ar * pr * qr * 100);
  var lePct = capacity ? round1((actual / capacity) * 100) : 0;
  var uptimeAffected = available ? round1((available - affected) / available) : 0;
  var operatingTime = Math.max(available - affected, 0);
  var mttr = bd ? round1(affected / bd) : 0;
  var mtbfHrs = bd ? round1(operatingTime / (bd * 60)) : 0;
  var uptimeGross = available ? round1((available - gross) / available) : 0;

  return {
    capacity: capacity,
    productionTime: productionTime,
    netDt: netDt,
    ar: ar,
    oePct: oePct,
    lePct: lePct,
    uptimeAffected: uptimeAffected,
    mttr: mttr,
    mtbfHrs: mtbfHrs,
    affectedDowntime: affected,
    operatingTime: operatingTime,
    uptimeGross: uptimeGross,
  };
}

function buildReportKey(date, shop, shift) {
  return normalizeDateString(date) + "|" + String(shop).toUpperCase() + "|" + String(shift).replace("Shift ", "").toUpperCase();
}

function todayString() {
  return Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd");
}

function normalizeDateString(value) {
  if (!value) return todayString();
  if (Object.prototype.toString.call(value) === "[object Date]") return Utilities.formatDate(value, TIME_ZONE, "yyyy-MM-dd");
  var text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  var parsed = new Date(text);
  if (!isNaN(parsed.getTime())) return Utilities.formatDate(parsed, TIME_ZONE, "yyyy-MM-dd");
  return todayString();
}

function monthLabel(date) {
  var parsed = new Date(normalizeDateString(date) + "T00:00:00");
  return Utilities.formatDate(parsed, TIME_ZONE, "MMM");
}

function meetingMonth(date) {
  var parsed = new Date(normalizeDateString(date) + "T00:00:00");
  return Utilities.formatDate(parsed, TIME_ZONE, "MMM''yy");
}

function meetingDate(date) {
  var parsed = new Date(normalizeDateString(date) + "T00:00:00");
  return Utilities.formatDate(parsed, TIME_ZONE, "dd-MMM-yy");
}

function monthSortKey(date) {
  return normalizeDateString(date).slice(0, 7);
}

function shiftCode(shift) {
  shift = String(shift || "").replace("Shift ", "").toUpperCase();
  if (shift === "A") return 1;
  if (shift === "B") return 2;
  if (shift === "C") return 3;
  return shift;
}

function toNumber(value, fallback) {
  if (fallback == null) fallback = 0;
  var n = Number(value);
  return isNaN(n) || !isFinite(n) ? fallback : n;
}

function configuredNumber(value, fallback) {
  return value === "" || value == null ? fallback : toNumber(value, fallback);
}

function toText(value, fallback) {
  if (fallback == null) fallback = "";
  if (value == null) return fallback;
  return String(value);
}

function round1(value) {
  return Math.round(toNumber(value) * 10) / 10;
}

function round3(value) {
  return Math.round(toNumber(value) * 1000) / 1000;
}
