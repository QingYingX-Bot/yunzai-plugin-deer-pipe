export const MONTH_HISTORY_KEY = 'monthHistory';

export function getMonthKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

export function getPreviousMonthDate(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth() - 1, 1);
}

function hasMonthRecords(userData = {}) {
    return Object.keys(userData).some(key => {
        if (key === 'lastSignMonth' || key === MONTH_HISTORY_KEY) return false;
        if (!isNaN(key)) return Number(userData[key] || 0) > 0;
        if (key.startsWith('w_')) return Number(userData[key] || 0) > 0;
        return false;
    });
}

function getLegacyMonthKey(lastSignMonth, date = new Date()) {
    const currentMonth = date.getMonth() + 1;
    const year = lastSignMonth > currentMonth ? date.getFullYear() - 1 : date.getFullYear();
    return `${year}-${String(lastSignMonth).padStart(2, '0')}`;
}

export function snapshotMonthData(userData = {}) {
    const snapshot = { lastSignMonth: userData.lastSignMonth };
    for (const key in userData) {
        if (key === 'lastSignMonth' || key === MONTH_HISTORY_KEY) continue;
        if (!isNaN(key) || key.startsWith('w_')) {
            snapshot[key] = userData[key];
        }
    }
    return snapshot;
}

export function ensureCurrentMonthData(deerData, userId, date = new Date()) {
    const currentMonth = date.getMonth() + 1;
    const userKey = String(userId);
    const userData = deerData[userKey];

    if (!userData) {
        deerData[userKey] = { lastSignMonth: currentMonth, [MONTH_HISTORY_KEY]: {} };
        return deerData[userKey];
    }

    if (!userData[MONTH_HISTORY_KEY]) {
        userData[MONTH_HISTORY_KEY] = {};
    }

    if (userData.lastSignMonth !== currentMonth) {
        if (userData.lastSignMonth && hasMonthRecords(userData)) {
            const historyKey = getLegacyMonthKey(userData.lastSignMonth, date);
            userData[MONTH_HISTORY_KEY][historyKey] = snapshotMonthData(userData);
        }
        deerData[userKey] = {
            lastSignMonth: currentMonth,
            [MONTH_HISTORY_KEY]: userData[MONTH_HISTORY_KEY]
        };
    }

    return deerData[userKey];
}

export function getUserMonthData(userData, date = new Date()) {
    if (!userData) return null;

    const targetMonth = date.getMonth() + 1;
    if (userData.lastSignMonth === targetMonth) {
        return userData;
    }

    return userData[MONTH_HISTORY_KEY]?.[getMonthKey(date)] || null;
}
