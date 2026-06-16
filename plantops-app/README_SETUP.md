# TATA MOTORS Operations Portal Setup

## 1. Open project in Cursor

Open the full `PLATFORM_V4` folder in Cursor.

## 2. Install frontend

```bash
cd plantops-app
npm install
npm run dev
```

Open the localhost URL shown by Vite.

## 3. Logins

Admin:

```txt
admin / Admin@2024
```

Shop rep examples:

```txt
tcf1 / TCF1@2024
engine / ENGINE@2024
x1 / X1@2024
```

## 4. Setup Google Sheet backend

Create a Google Sheet, then open:

```txt
Extensions → Apps Script
```

Delete the default code and paste all code from:

```txt
PLATFORM_V4/PlantOps_AppScript.gs
```

Change:

```js
var ADMIN_EMAIL = "admin@yourcompany.com";
```

to your real email.

## 5. Create sheets

Run this Apps Script function once:

```js
ensureWorkbook
```

Then run:

```js
rebuildVisibleSheets
```

The system creates:

```txt
Meeting Excel Sheet
Analytical Sheet
Main Data
```

`Main Data` is hidden after the visible sheets exist.

## 6. Deploy backend

In Apps Script:

```txt
Deploy → New deployment → Web app
```

Use:

```txt
Execute as: Me
Who has access: Anyone
```

Copy the Web App URL ending in `/exec`.

## 7. Connect frontend

In the React app, login as admin, go to:

```txt
Settings
```

Paste the Apps Script Web App URL, click:

```txt
Save URL → Test Connection → Load Sheet Data
```

## 8. Testing the flow

1. Login as a shop rep.
2. Fill the shop data entry form.
3. Submit.
4. The backend updates hidden `Main Data`.
5. The backend rebuilds:
   - `Meeting Excel Sheet`
   - `Analytical Sheet`
6. Login as admin and view both tabs.

## 9. Excel formulas in Meeting Excel Sheet

The meeting sheet formula columns are:

```txt
H Capacity = F * 60 / G
I Production Time = D * G / 60
J Net DT = F - I
K AR = I / F
N OE = K * L * M * 100
O Line Efficiency = D / H * 100
T Uptime Affected = (F - Q) / F
U MTTR = Q / S
V MTBF Hrs = ((F - Q) / S) / 60
X Uptime Gross = (F - R) / F
```

## 10. Email reminders and daily Excel report

Run this Apps Script function once:

```js
createDefaultTriggers
```

This enables:

```txt
Daily Excel report email
Missing upload reminder for Shift A
Missing upload reminder for Shift B
Missing upload reminder for Shift C
```

The daily email attaches the Google Sheet as `.xlsx` with the visible Meeting and Analytical sheets.
