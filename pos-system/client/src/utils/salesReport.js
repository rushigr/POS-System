// Pure helpers for the Dashboard: date ranges, bucketing, product ranking
// and the plain-English summary. No React in here, so it is easy to test.

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_MS = 24 * 60 * 60 * 1000;

export const UNIT = { year: "year", month: "month", week: "week", day: "day" };

export const currency = (value) =>
    `₱${Number(value || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;

/* ---------- date helpers (viewer's local time) ---------- */

const pad = (n) => String(n).padStart(2, "0");

export const toDateValue = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toMonthValue = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export const fromDateValue = (v) => {
    const [y, m, d] = v.split("-").map(Number);
    return new Date(y, m - 1, d);
};
export const fromMonthValue = (v) => {
    const [y, m] = v.split("-").map(Number);
    return new Date(y, m - 1, 1);
};

export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Weeks run Monday to Sunday.
export const startOfWeek = (d) => {
    const s = startOfDay(d);
    s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
    return s;
};

export const addDays = (d, n) => {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
};

// Add months, keeping the day of month where possible (Jan 31 + 1 -> Feb 28).
export const addMonths = (d, n) => {
    const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
    const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(d.getDate(), last));
    return target;
};

export const shortDate = (d) => `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;

const longDate = (d) =>
    d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

const hourLabel = (h) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;

/* ---------- ranges ---------- */

// Returns [start, end) for the chosen period type.
export function getRange(mode, anchor) {
    const y = anchor.getFullYear();
    const m = anchor.getMonth();

    if (mode === "year") return [new Date(y, 0, 1), new Date(y + 1, 0, 1)];
    if (mode === "month") return [new Date(y, m, 1), new Date(y, m + 1, 1)];
    if (mode === "week") {
        const s = startOfWeek(anchor);
        return [s, addDays(s, 7)];
    }
    const s = startOfDay(anchor);
    return [s, addDays(s, 1)];
}

export function getPreviousRange(mode, [start]) {
    if (mode === "year") return [new Date(start.getFullYear() - 1, 0, 1), start];
    if (mode === "month") return [new Date(start.getFullYear(), start.getMonth() - 1, 1), start];
    if (mode === "week") return [addDays(start, -7), start];
    return [addDays(start, -1), start];
}

export function shiftAnchor(mode, anchor, direction) {
    if (mode === "year") return addMonths(anchor, 12 * direction);
    if (mode === "month") return addMonths(anchor, direction);
    if (mode === "week") return addDays(anchor, 7 * direction);
    return addDays(anchor, direction);
}

export function rangeName(mode, [start, end]) {
    if (mode === "year") return String(start.getFullYear());
    if (mode === "month") {
        return start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    if (mode === "week") {
        const last = addDays(end, -1);
        return `${shortDate(start)} – ${shortDate(last)}, ${last.getFullYear()}`;
    }
    return longDate(start);
}

/* ---------- totals, buckets, ranking ---------- */

const itemQty = (item) => Number(item.quantity) || 1;

export function totalsOf(txns) {
    const sales = txns.reduce((sum, t) => sum + (Number(t.total) || 0), 0);
    const items = txns.reduce(
        (sum, t) => sum + (t.items || []).reduce((s, i) => s + itemQty(i), 0),
        0
    );
    return {
        sales: Math.round(sales * 100) / 100,
        count: txns.length,
        items,
        average: txns.length ? sales / txns.length : 0
    };
}

// Products ranked by quantity sold (ties broken by revenue, then name).
export function rankProducts(txns) {
    const map = new Map();

    txns.forEach((t) => {
        (t.items || []).forEach((item) => {
            const name = item.name || "Unknown product";
            const qty = itemQty(item);
            const entry = map.get(name) || { name, quantity: 0, revenue: 0 };
            entry.quantity += qty;
            entry.revenue += (Number(item.price) || 0) * qty;
            map.set(name, entry);
        });
    });

    return [...map.values()]
        .map((p) => ({ ...p, revenue: Math.round(p.revenue * 100) / 100 }))
        .sort(
            (a, b) =>
                b.quantity - a.quantity ||
                b.revenue - a.revenue ||
                a.name.localeCompare(b.name)
        );
}

function bucketIndex(mode, date, start) {
    if (mode === "year") return date.getMonth();
    if (mode === "month") return date.getDate() - 1;
    if (mode === "week") return Math.round((startOfDay(date) - start) / DAY_MS);
    return date.getHours();
}

// One bar per month (year), day (month / week) or hour (day).
export function buildBuckets(mode, txns, [start]) {
    const y = start.getFullYear();
    const m = start.getMonth();
    let buckets;

    if (mode === "year") {
        buckets = Array.from({ length: 12 }, (_, i) => ({
            label: MONTHS_SHORT[i],
            full: new Date(y, i, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })
        }));
    } else if (mode === "month") {
        const days = new Date(y, m + 1, 0).getDate();
        buckets = Array.from({ length: days }, (_, i) => {
            const d = new Date(y, m, i + 1);
            return { label: String(i + 1), full: longDate(d) };
        });
    } else if (mode === "week") {
        buckets = Array.from({ length: 7 }, (_, i) => {
            const d = addDays(start, i);
            return { label: `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()}`, full: longDate(d) };
        });
    } else {
        buckets = Array.from({ length: 24 }, (_, h) => ({
            label: hourLabel(h),
            full: `${hourLabel(h)} – ${hourLabel((h + 1) % 24)}`,
            hour: h
        }));
    }

    buckets = buckets.map((b) => ({ ...b, sales: 0, count: 0 }));

    txns.forEach((t) => {
        const bucket = buckets[bucketIndex(mode, t.date, start)];
        if (bucket) {
            bucket.sales += Number(t.total) || 0;
            bucket.count += 1;
        }
    });

    buckets.forEach((b) => (b.sales = Math.round(b.sales * 100) / 100));

    if (mode === "day") {
        // Show 8 AM–9 PM by default, widening if sales fall outside that.
        const active = buckets.filter((b) => b.count > 0).map((b) => b.hour);
        const from = Math.min(8, ...active);
        const to = Math.max(21, ...active);
        buckets = buckets.filter((b) => b.hour >= from && b.hour <= to);
    }

    return buckets;
}

/* ---------- segments for the best-seller tables ---------- */

// Mon–Sun weeks, clipped to the month so the rows add up to the month total.
export function weekSegments(year, month) {
    const first = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 1);
    const segments = [];
    let cursor = first;

    while (cursor < monthEnd) {
        const nextMonday = addDays(startOfWeek(cursor), 7);
        const end = nextMonday < monthEnd ? nextMonday : monthEnd;
        segments.push({
            label: `Week ${segments.length + 1}`,
            dates: `${shortDate(cursor)} – ${shortDate(addDays(end, -1))}`,
            start: cursor,
            end
        });
        cursor = end;
    }
    return segments;
}

export function monthSegments(year) {
    return Array.from({ length: 12 }, (_, i) => ({
        label: new Date(year, i, 1).toLocaleDateString("en-US", { month: "long" }),
        dates: String(year),
        start: new Date(year, i, 1),
        end: new Date(year, i + 1, 1)
    }));
}

export function bestSellerRows(segments, parsed) {
    return segments.map((seg) => {
        const txns = parsed.filter((t) => t.date >= seg.start && t.date < seg.end);
        const ranked = rankProducts(txns);
        const totals = totalsOf(txns);

        return {
            label: seg.label,
            dates: seg.dates,
            best: ranked[0] || null,
            runnerUp: ranked[1] || null,
            sales: totals.sales,
            count: totals.count
        };
    });
}

/* ---------- summary statements ---------- */

// Each statement is a list of parts: plain strings, or { b: "bold text" }.
function buildSummary({ mode, name, prevName, totals, prevTotals, bestBucket, activeDays, ranked, inProgress }) {
    const unit = UNIT[mode];
    const out = [];
    const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

    if (totals.count === 0) {
        out.push(["No sales were recorded for ", { b: name }, "."]);
        if (prevTotals.sales > 0) {
            out.push([
                `The previous ${unit} (${prevName}) had `,
                { b: currency(prevTotals.sales) },
                " in sales."
            ]);
        }
        return out;
    }

    out.push([
        "Total sales for ",
        { b: name },
        inProgress ? " are " : " were ",
        { b: currency(totals.sales) },
        ` from ${plural(totals.count, "transaction")}, with ${plural(totals.items, "item")} sold and an average sale of `,
        { b: currency(totals.average) },
        "."
    ]);

    // vs previous period
    if (prevTotals.sales > 0) {
        const pct = ((totals.sales - prevTotals.sales) / prevTotals.sales) * 100;
        const tail = `compared with the previous ${unit} (${prevName}: ${currency(prevTotals.sales)}). Transactions went from ${prevTotals.count} to ${totals.count}.`;

        if (Math.abs(pct) < 0.05) {
            out.push([`Sales are essentially unchanged ${tail}`]);
        } else {
            out.push([
                "Sales are ",
                { b: `${pct > 0 ? "up" : "down"} ${Math.abs(pct).toFixed(1)}%` },
                ` ${tail}`
            ]);
        }

        if (inProgress) {
            out.push([
                `Note: this ${unit} is still in progress, so it is being compared against a full previous ${unit}.`
            ]);
        }
    } else {
        out.push([`There were no sales in the previous ${unit} to compare against.`]);
    }

    // best month / day / hour inside the period
    if (bestBucket && bestBucket.sales > 0) {
        const label = { year: "best month", month: "best day", week: "best day", day: "busiest hour" }[mode];
        const share = totals.sales > 0 ? (bestBucket.sales / totals.sales) * 100 : 0;

        out.push([
            `The ${label} was `,
            { b: bestBucket.full },
            " with ",
            { b: currency(bestBucket.sales) },
            ` (${share.toFixed(0)}% of the ${unit}'s sales) from ${plural(bestBucket.count, "transaction")}.`
        ]);
    }

    if (mode !== "day" && activeDays > 0) {
        out.push([
            `Sales were recorded on ${plural(activeDays, "day")}, averaging `,
            { b: currency(totals.sales / activeDays) },
            " per trading day."
        ]);
    }

    // best seller
    if (ranked.length > 0) {
        const top = ranked[0];
        const share = totals.items > 0 ? (top.quantity / totals.items) * 100 : 0;
        const parts = [
            "Best seller: ",
            { b: top.name },
            ` with ${top.quantity} sold, earning `,
            { b: currency(top.revenue) },
            ` (${share.toFixed(0)}% of items sold).`
        ];

        if (ranked[1] && ranked[1].quantity === top.quantity) {
            parts.push(` It tied on quantity with ${ranked[1].name}, and is ranked first on sales value.`);
        } else if (ranked.length > 1) {
            const next = ranked.slice(1, 3).map((p) => `${p.name} (${p.quantity})`).join(", ");
            parts.push(` Next: ${next}.`);
        }
        out.push(parts);

        const topRevenue = [...ranked].sort((a, b) => b.revenue - a.revenue)[0];
        if (topRevenue.name !== top.name) {
            out.push([
                "By revenue, ",
                { b: topRevenue.name },
                " earned the most at ",
                { b: currency(topRevenue.revenue) },
                `, even though ${top.name} sold more units.`
            ]);
        }
    }

    return out;
}

/* ---------- everything the dashboard needs for one period ---------- */

export function analyzePeriod(mode, anchor, parsed, now = new Date()) {
    const range = getRange(mode, anchor);
    const prevRange = getPreviousRange(mode, range);

    const inRange = ([s, e]) => parsed.filter((t) => t.date >= s && t.date < e);

    const txns = inRange(range);
    const prevTxns = inRange(prevRange);

    const totals = totalsOf(txns);
    const prevTotals = totalsOf(prevTxns);
    const buckets = buildBuckets(mode, txns, range);
    const ranked = rankProducts(txns);

    const bestBucket = buckets.reduce(
        (best, b) => (b.sales > (best?.sales ?? 0) ? b : best),
        null
    );
    const activeDays = new Set(txns.map((t) => toDateValue(t.date))).size;
    const inProgress = now >= range[0] && now < range[1];
    const name = rangeName(mode, range);
    const prevName = rangeName(mode, prevRange);

    return {
        name,
        prevName,
        totals,
        prevTotals,
        buckets,
        bestBucket,
        ranked,
        inProgress,
        summary: buildSummary({
            mode, name, prevName, totals, prevTotals,
            bestBucket, activeDays, ranked, inProgress
        })
    };
}