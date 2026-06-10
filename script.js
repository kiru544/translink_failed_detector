const csvInput = document.getElementById('csvFile');
const fileStatus = document.getElementById('fileStatus');
const summary = document.getElementById('summary');
const results = document.getElementById('results');

csvInput.addEventListener('change', handleFileUpload);

async function handleFileUpload(event) {
  const file = event.target.files[0];

  if (!file) {
    fileStatus.textContent = 'No file selected.';
    summary.classList.add('hidden');
    results.innerHTML = '';
    return;
  }

  fileStatus.textContent = `Loaded: ${file.name}`;

  try {
    const text = await file.text();
    const rows = parseCSV(text);
    const transactions = normaliseRows(rows);
    const failedTrips = detectFailedTrips(transactions);
    const reportItems = failedTrips.map(failedTrip => ({
      failedTrip,
      previous: findPreviousTransaction(failedTrip, transactions),
      next: findNextTransaction(failedTrip, transactions)
    }));

    renderSummary(transactions, failedTrips);
    renderResults(reportItems);
  } catch (error) {
    summary.classList.add('hidden');
    results.innerHTML = `<div class="empty">Could not read this CSV file.</div>`;
    console.error(error);
  }
}

function parseCSV(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim() !== '');
  return lines.map(parseCSVLine);
}

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function normaliseRows(rows) {
  return rows
    .slice(1)
    .map((row, index) => {
      const transaction = {
        rowNumber: index + 2,
        date: clean(row[0]),
        startTime: clean(row[1]),
        from: clean(row[2]),
        endTime: clean(row[3]),
        to: clean(row[4]),
        fareText: clean(row[5]),
        creditText: clean(row[6]),
        balanceText: clean(row[7]),
        fare: parseMoney(row[5]),
        credit: parseMoney(row[6]),
        balance: parseMoney(row[7]),
        originalIndex: index
      };

      transaction.displayTime = chooseTransactionTime(transaction.startTime, transaction.endTime);
      transaction.dateTime = parseDateTime(transaction.date, transaction.displayTime);
      return transaction;
    })
    .filter(transaction => transaction.date && transaction.displayTime && transaction.from)
    .sort((a, b) => {
      const timeDifference = safeTime(a.dateTime) - safeTime(b.dateTime);
      return timeDifference || a.originalIndex - b.originalIndex;
    });
}

function clean(value) {
  return String(value ?? '').trim();
}

function chooseTransactionTime(startTime, endTime) {
  if (isUsableTime(startTime)) {
    return startTime;
  }

  if (isUsableTime(endTime)) {
    return endTime;
  }

  return startTime || endTime || '';
}

function isUsableTime(value) {
  const text = clean(value).toLowerCase();

  return text !== '' && text !== 'unknown' && text !== '-';
}

function parseMoney(value) {
  const text = clean(value);
  if (!text) return null;

  const match = text.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function parseDateTime(dateText, timeText) {
  const dateMatch = clean(dateText).match(/^(\d{1,2})\/(\w{3})\/(\d{4})$/i);
  const timeMatch = clean(timeText).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);

  if (!dateMatch || !timeMatch) return null;

  const day = Number(dateMatch[1]);
  const month = monthIndex(dateMatch[2]);
  const year = Number(dateMatch[3]);
  let hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const marker = timeMatch[3]?.toUpperCase();

  if (month === -1) return null;

  if (marker === 'AM' && hour === 12) {
    hour = 0;
  } else if (marker === 'PM' && hour < 12) {
    hour += 12;
  }

  return new Date(year, month, day, hour, minute);
}

function monthIndex(shortMonth) {
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  return months.indexOf(shortMonth.toLowerCase());
}

function safeTime(date) {
  return date instanceof Date && !Number.isNaN(date.getTime())
    ? date.getTime()
    : Number.MAX_SAFE_INTEGER;
}

function detectFailedTrips(transactions) {
  return transactions.filter(isPossibleFailedTrip);
}

function isPossibleFailedTrip(transaction) {
  if (transaction.fare === 0) {
    return false;
  }

  const combinedText = `${transaction.from} ${transaction.to} ${transaction.fareText}`.toLowerCase();

  const hasDefaultFareAmount = transaction.fare === 2.5;
  const hasFailedText = combinedText.includes('failed');

  return hasDefaultFareAmount || hasFailedText;
}

function findPreviousTransaction(failedTrip, transactions) {
  const index = transactions.findIndex(transaction => transaction.rowNumber === failedTrip.rowNumber);
  if (index <= 0) return null;
  return transactions[index - 1];
}

function findNextTransaction(failedTrip, transactions) {
  const index = transactions.findIndex(transaction => transaction.rowNumber === failedTrip.rowNumber);
  if (index === -1 || index >= transactions.length - 1) return null;
  return transactions[index + 1];
}

function renderSummary(transactions, failedTrips) {
  const totalExtra = failedTrips.reduce((total, transaction) => total + (transaction.fare || 0), 0);

  summary.innerHTML = `
    <div class="summary-grid">
      <div class="stat">
        <strong>${transactions.length}</strong>
        <span>Total records</span>
      </div>
      <div class="stat">
        <strong>${failedTrips.length}</strong>
        <span>Possible failed/default fares</span>
      </div>
      <div class="stat">
        <strong>${formatMoney(totalExtra)}</strong>
        <span>Total detected charge</span>
      </div>
    </div>
  `;

  summary.classList.remove('hidden');
}

function renderResults(reportItems) {
  if (reportItems.length === 0) {
    results.innerHTML = '<div class="empty">No failed/default-fare trips detected.</div>';
    return;
  }

  results.innerHTML = reportItems.map((item, index) => `
    <article class="card">
      <h2>Detected issue ${index + 1} <span class="badge">Possible failed trip</span></h2>
      ${renderTransaction('Failed/default-fare record', item.failedTrip)}
      <div class="transaction-list">
        ${renderTransaction('Closest record before', item.previous)}
        ${renderTransaction('Closest record after', item.next)}
      </div>
    </article>
  `).join('');
}

function renderTransaction(title, transaction) {
  if (!transaction) {
    return `
      <div class="transaction">
        <h3>${escapeHtml(title)}</h3>
        <p class="muted">No nearby record found.</p>
      </div>
    `;
  }

  return `
    <div class="transaction">
      <h3>${escapeHtml(title)}</h3>
      <p><strong>Date/time:</strong> ${escapeHtml(formatDateTime(transaction))}</p>
      <p><strong>From:</strong> ${escapeHtml(transaction.from || '-')}</p>
      <p><strong>To:</strong> ${escapeHtml(transaction.to || '-')}</p>
      <p><strong>Fare:</strong> ${escapeHtml(transaction.fareText || '-')}</p>
    </div>
  `;
}

function formatDateTime(transaction) {
  return `${transaction.date} ${transaction.displayTime || transaction.startTime || transaction.endTime || 'Unknown'}`;
}

function formatMoney(value) {
  return `$${value.toFixed(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
