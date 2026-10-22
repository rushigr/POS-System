import { useEffect, useMemo, useState } from "react";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip
} from "recharts";
import "./Dashboard.css";

import API_URL from "../api";
import {
    addDays,
    addMonths,
    analyzePeriod,
    bestSellerRows,
    currency,
    customGranularity,
    customSegments,
    fromDateValue,
    fromMonthValue,
    monthSegments,
    shiftAnchor,
    toDateValue,
    toMonthValue,
    weekSegments
} from "../utils/salesReport";

const MODES = [
    ["year", "Year"],
    ["month", "Month"],
    ["week", "Week"],
    ["day", "Day"],
    ["custom", "Custom"]
];

// Quick picks for the custom period. `to` is always today.
const PRESETS = [
    ["Last 7 days", (today) => addDays(today, -6)],
    ["Last 30 days", (today) => addDays(today, -29)],
    ["Last 90 days", (today) => addDays(today, -89)],
    ["Year to date", (today) => new Date(today.getFullYear(), 0, 1)]
];

const compact = new Intl.NumberFormat("en-PH", {
    notation: "compact",
    maximumFractionDigits: 1
});

const CHART_TITLES = {
    year: "Sales by Month",
    month: "Sales by Day",
    week: "Sales by Day of the Week",
    day: "Sales by Hour",
    custom: "Sales by Day"
};

function Dashboard() {
    const [transactions, setTransactions] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [mode, setMode] = useState("month"); // year | month | week | day
    const [anchor, setAnchor] = useState(() => new Date());
    const [bestBy, setBestBy] = useState("week"); // week | month

    // custom period, as yyyy-mm-dd strings (both ends inclusive)
    const [customFrom, setCustomFrom] = useState(() =>
        toDateValue(addDays(new Date(), -29))
    );
    const [customTo, setCustomTo] = useState(() => toDateValue(new Date()));

    const changeFrom = (value) => {
        if (!value) return;
        setCustomFrom(value);
        if (value > customTo) setCustomTo(value); // keep From <= To
    };

    const changeTo = (value) => {
        if (!value) return;
        setCustomTo(value);
        if (value < customFrom) setCustomFrom(value);
    };

    const applyPreset = (startFn) => {
        const today = new Date();
        setCustomFrom(toDateValue(startFn(today)));
        setCustomTo(toDateValue(today));
    };

    // [start, end) -- end is the day AFTER the chosen "To" date
    const customRange = useMemo(
        () => [fromDateValue(customFrom), addDays(fromDateValue(customTo), 1)],
        [customFrom, customTo]
    );

    useEffect(() => {
        let cancelled = false;

        async function loadDashboard() {
            setLoading(true);
            setError("");

            try {
                const [transactionResponse, productResponse] =
                    await Promise.all([
                        fetch(`${API_URL}/api/transactions`),
                        fetch(`${API_URL}/api/products`)
                    ]);

                if (!transactionResponse.ok || !productResponse.ok) {
                    throw new Error("Failed to load dashboard data.");
                }

                const [transactionData, productData] = await Promise.all([
                    transactionResponse.json(),
                    productResponse.json()
                ]);

                if (!cancelled) {
                    setTransactions(transactionData);
                    setProducts(productData);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(
                        "Unable to load reports. Check that the backend is running."
                    );
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadDashboard();

        return () => {
            cancelled = true;
        };
    }, []);

    // Parse each date once; drop records with a bad date.
    const parsed = useMemo(
        () =>
            transactions
                .filter((t) => t.status !== "voided") // voided sales don't count
                .map((t) => ({ ...t, date: new Date(t.createdAt) }))
                .filter((t) => !Number.isNaN(t.date.getTime())),
        [transactions]
    );

    const report = useMemo(
        () =>
            analyzePeriod(
                mode,
                anchor,
                parsed,
                undefined,
                mode === "custom" ? customRange : null
            ),
        [mode, anchor, parsed, customRange]
    );

    const topProducts = report.ranked.slice(0, 10);

    const yearOptions = useMemo(() => {
        const thisYear = new Date().getFullYear();
        const earliest = parsed.reduce(
            (min, t) => Math.min(min, t.date.getFullYear()),
            thisYear
        );
        const latest = Math.max(thisYear, anchor.getFullYear());
        const years = [];
        for (let y = latest; y >= Math.min(earliest, anchor.getFullYear()); y--) {
            years.push(y);
        }
        return years;
    }, [parsed, anchor]);

    const bestSellers = useMemo(() => {
        if (mode === "custom") {
            return {
                subtitle:
                    bestBy === "week"
                        ? "Mon–Sun weeks inside the selected period, trimmed to its start and end dates."
                        : "Calendar months inside the selected period, trimmed to its start and end dates.",
                rows: bestSellerRows(customSegments(customRange, bestBy), parsed)
            };
        }

        const year = anchor.getFullYear();
        const month = anchor.getMonth();

        const segments =
            bestBy === "week" ? weekSegments(year, month) : monthSegments(year);

        return {
            subtitle:
                bestBy === "week"
                    ? `Mon–Sun weeks of ${anchor.toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric"
                      })}, trimmed to the month so rows add up to the month total.`
                    : `Every month of ${year}.`,
            rows: bestSellerRows(segments, parsed)
        };
    }, [mode, bestBy, anchor, parsed, customRange]);

    const delta =
        report.prevTotals.sales > 0
            ? ((report.totals.sales - report.prevTotals.sales) /
                  report.prevTotals.sales) *
              100
            : null;

    const unit = mode;

    return (
        <div className="dsh-page">
            <header className="dsh-header">
                <div>
                    <h1>Sales Dashboard</h1>
                    <p>Sales performance and product reports</p>
                </div>
            </header>

            {/* ---------- period controls ---------- */}
            <div className="dsh-controls">
                <div className="dsh-tabs" role="tablist">
                    {MODES.map(([value, label]) => (
                        <button
                            key={value}
                            role="tab"
                            aria-selected={mode === value}
                            className={
                                mode === value ? "dsh-tab active" : "dsh-tab"
                            }
                            onClick={() => setMode(value)}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {mode === "custom" ? (
                    <div className="dsh-custom">
                        <label className="dsh-custom-field">
                            <span>From</span>
                            <input
                                type="date"
                                value={customFrom}
                                max={customTo}
                                onChange={(e) => changeFrom(e.target.value)}
                                aria-label="Start date"
                            />
                        </label>

                        <label className="dsh-custom-field">
                            <span>To</span>
                            <input
                                type="date"
                                value={customTo}
                                min={customFrom}
                                onChange={(e) => changeTo(e.target.value)}
                                aria-label="End date"
                            />
                        </label>

                        <div className="dsh-presets">
                            {PRESETS.map(([label, startFn]) => (
                                <button
                                    key={label}
                                    type="button"
                                    className="dsh-preset"
                                    onClick={() => applyPreset(startFn)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                <div className="dsh-nav">
                    <button
                        onClick={() => setAnchor((a) => shiftAnchor(mode, a, -1))}
                        aria-label={`Previous ${unit}`}
                    >
                        ‹
                    </button>

                    <div className="dsh-nav-label">
                        <strong>{report.name}</strong>

                        {mode === "year" && (
                            <select
                                value={anchor.getFullYear()}
                                onChange={(e) =>
                                    setAnchor((a) =>
                                        addMonths(
                                            a,
                                            (Number(e.target.value) -
                                                a.getFullYear()) *
                                                12
                                        )
                                    )
                                }
                                aria-label="Select year"
                            >
                                {yearOptions.map((y) => (
                                    <option key={y} value={y}>
                                        {y}
                                    </option>
                                ))}
                            </select>
                        )}

                        {mode === "month" && (
                            <input
                                type="month"
                                value={toMonthValue(anchor)}
                                onChange={(e) =>
                                    e.target.value &&
                                    setAnchor(fromMonthValue(e.target.value))
                                }
                                aria-label="Select month"
                            />
                        )}

                        {(mode === "week" || mode === "day") && (
                            <input
                                type="date"
                                value={toDateValue(anchor)}
                                onChange={(e) =>
                                    e.target.value &&
                                    setAnchor(fromDateValue(e.target.value))
                                }
                                aria-label="Select date"
                            />
                        )}
                    </div>

                    <button
                        onClick={() => setAnchor((a) => shiftAnchor(mode, a, 1))}
                        aria-label={`Next ${unit}`}
                    >
                        ›
                    </button>

                    <button
                        className="dsh-today"
                        onClick={() => setAnchor(new Date())}
                    >
                        Today
                    </button>
                </div>
                )}
            </div>

            {mode === "custom" && (
                <p className="dsh-range-note">
                    Showing <strong>{report.name}</strong>
                </p>
            )}

            {error && <p className="dsh-error">{error}</p>}

            {loading ? (
                <p>Loading sales reports...</p>
            ) : (
                <>
                    {/* ---------- cards ---------- */}
                    <div className="dsh-cards">
                        <div className="dsh-card">
                            <h2>{currency(report.totals.sales)}</h2>
                            <p>Total Sales</p>
                            {delta !== null && (
                                <span
                                    className={
                                        delta >= 0
                                            ? "dsh-delta up"
                                            : "dsh-delta down"
                                    }
                                >
                                    {delta >= 0 ? "▲" : "▼"}{" "}
                                    {Math.abs(delta).toFixed(1)}% vs previous{" "}
                                    {unit}
                                </span>
                            )}
                        </div>

                        <div className="dsh-card">
                            <h2>{report.totals.count}</h2>
                            <p>Transactions</p>
                        </div>

                        <div className="dsh-card">
                            <h2>{report.totals.items}</h2>
                            <p>Items Sold</p>
                        </div>

                        <div className="dsh-card">
                            <h2>{currency(report.totals.average)}</h2>
                            <p>Average Sale</p>
                        </div>

                        <div className="dsh-card">
                            <h2>{products.length}</h2>
                            <p>Products in Catalog</p>
                        </div>
                    </div>

                    {/* ---------- summary statements ---------- */}
                    <section className="dsh-section dsh-summary-section">
                        <h2>Report Summary</h2>

                        <ul className="dsh-summary">
                            {report.summary.map((statement, i) => (
                                <li key={i}>
                                    {statement.map((part, j) =>
                                        typeof part === "string" ? (
                                            <span key={j}>{part}</span>
                                        ) : (
                                            <strong key={j}>{part.b}</strong>
                                        )
                                    )}
                                </li>
                            ))}
                        </ul>
                    </section>

                    {/* ---------- sales chart ---------- */}
                    <section className="dsh-section">
                        <h2>
                            {mode === "custom" &&
                            customGranularity(customRange) === "month"
                                ? "Sales by Month"
                                : CHART_TITLES[mode]}
                        </h2>
                        <p className="dsh-description">
                            {report.name}
                            {report.bestBucket &&
                                " · the highest bar is highlighted in green."}
                        </p>

                        <div className="dsh-chart">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={report.buckets}
                                    margin={{ top: 10, right: 16, left: 0, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />

                                    <XAxis
                                        dataKey="label"
                                        tick={{ fontSize: 12 }}
                                        interval={
                                            mode === "month"
                                                ? 1
                                                : mode === "custom"
                                                  ? Math.max(
                                                        0,
                                                        Math.ceil(report.buckets.length / 15) - 1
                                                    )
                                                  : 0
                                        }
                                    />

                                    <YAxis
                                        tickFormatter={(v) => `₱${compact.format(v)}`}
                                        width={60}
                                    />

                                    <Tooltip
                                        formatter={(value, name, item) => [
                                            `${currency(value)} (${item.payload.count} transaction${
                                                item.payload.count === 1 ? "" : "s"
                                            })`,
                                            "Sales"
                                        ]}
                                        labelFormatter={(label, payload) =>
                                            payload?.[0]?.payload?.full || label
                                        }
                                    />

                                    <Bar
                                        dataKey="sales"
                                        name="Sales"
                                        radius={[5, 5, 0, 0]}
                                    >
                                        {report.buckets.map((bucket) => (
                                            <Cell
                                                key={bucket.full}
                                                fill={
                                                    bucket === report.bestBucket
                                                        ? "#16a34a"
                                                        : "#2563eb"
                                                }
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </section>

                    {/* ---------- top products for the period ---------- */}
                    <section className="dsh-section">
                        <h2>Top Products</h2>
                        <p className="dsh-description">
                            Ranked by quantity sold in {report.name} (top 10).
                        </p>

                        {topProducts.length === 0 ? (
                            <p className="dsh-empty">
                                No product sales found for this {unit}.
                            </p>
                        ) : (
                            <div
                                className="dsh-chart"
                                style={{
                                    height: Math.max(
                                        240,
                                        topProducts.length * 38 + 50
                                    )
                                }}
                            >
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={topProducts}
                                        layout="vertical"
                                        margin={{ top: 5, right: 24, left: 8, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" allowDecimals={false} />
                                        <YAxis
                                            type="category"
                                            dataKey="name"
                                            width={150}
                                            tick={{ fontSize: 12 }}
                                        />
                                        <Tooltip
                                            formatter={(value, name, item) => [
                                                `${value} sold · ${currency(
                                                    item.payload.revenue
                                                )}`,
                                                "Quantity"
                                            ]}
                                        />
                                        <Bar
                                            dataKey="quantity"
                                            name="Quantity Sold"
                                            fill="#16a34a"
                                            radius={[0, 5, 5, 0]}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </section>

                    {/* ---------- best seller per week / month ---------- */}
                    <section className="dsh-section">
                        <div className="dsh-section-head">
                            <div>
                                <h2>
                                    Best Sellers by{" "}
                                    {bestBy === "week" ? "Week" : "Month"}
                                </h2>
                                <p className="dsh-description">
                                    {bestSellers.subtitle}
                                </p>
                            </div>

                            <div className="dsh-tabs">
                                {[
                                    ["week", "By Week"],
                                    ["month", "By Month"]
                                ].map(([value, label]) => (
                                    <button
                                        key={value}
                                        className={
                                            bestBy === value
                                                ? "dsh-tab active"
                                                : "dsh-tab"
                                        }
                                        onClick={() => setBestBy(value)}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="dsh-table-wrap">
                            <table className="dsh-table">
                                <thead>
                                    <tr>
                                        <th>{bestBy === "week" ? "Week" : "Month"}</th>
                                        <th>Best Seller</th>
                                        <th>Qty</th>
                                        <th>Product Sales</th>
                                        <th>Runner-up</th>
                                        <th>Total Sales</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bestSellers.rows.map((row) => (
                                        <tr
                                            key={row.label}
                                            className={row.best ? "" : "dsh-row-empty"}
                                        >
                                            <td>
                                                <strong>{row.label}</strong>
                                                {(bestBy === "week" || mode === "custom") && (
                                                    <span className="dsh-dates">
                                                        {row.dates}
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                {row.best ? (
                                                    <strong>{row.best.name}</strong>
                                                ) : (
                                                    "No sales"
                                                )}
                                            </td>
                                            <td>{row.best ? row.best.quantity : "—"}</td>
                                            <td>
                                                {row.best
                                                    ? currency(row.best.revenue)
                                                    : "—"}
                                            </td>
                                            <td>
                                                {row.runnerUp
                                                    ? `${row.runnerUp.name} (${row.runnerUp.quantity})`
                                                    : "—"}
                                            </td>
                                            <td>{currency(row.sales)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}

export default Dashboard;