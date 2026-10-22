import { useEffect, useMemo, useState } from "react";
import "./Transactions.css";
import API_URL from "../api";

const PAGE_SIZE = 50;

/* ---------- formatting ---------- */

const peso = (n) =>
    `₱${Number(n || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;

const pad = (n) => String(n).padStart(2, "0");

const toDateValue = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const toMonthValue = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

const fromDateValue = (v) => {
    const [y, m, d] = v.split("-").map(Number);
    return new Date(y, m - 1, d);
};

const fromMonthValue = (v) => {
    const [y, m] = v.split("-").map(Number);
    return new Date(y, m - 1, 1);
};

const shortDate = (d) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

/* ---------- date ranges (all in the viewer's local time) ---------- */

const startOfDay = (d) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Weeks run Monday to Sunday.
const startOfWeek = (d) => {
    const s = startOfDay(d);
    s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
    return s;
};

const addDays = (d, n) => {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
};

const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);

// Returns [start, end) or [null, null] for "all".
function getRange(mode, anchor) {
    if (mode === "day") {
        const s = startOfDay(anchor);
        return [s, addDays(s, 1)];
    }
    if (mode === "week") {
        const s = startOfWeek(anchor);
        return [s, addDays(s, 7)];
    }
    if (mode === "month") {
        const s = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
        return [s, addMonths(s, 1)];
    }
    return [null, null];
}

function rangeLabel(mode, anchor) {
    const [start, end] = getRange(mode, anchor);

    if (mode === "day") {
        return start.toLocaleDateString(undefined, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    }
    if (mode === "week") {
        const last = addDays(end, -1);
        return `${shortDate(start)} – ${shortDate(last)}, ${last.getFullYear()}`;
    }
    if (mode === "month") {
        return start.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric"
        });
    }
    return "All transactions";
}

/* ---------- one expandable transaction ---------- */

function TransactionRow({ transaction, open, onToggle }) {
    const items = transaction.items || [];
    const itemCount = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
    const created = new Date(transaction.createdAt);

    return (
        <div className={open ? "txn-row open" : "txn-row"}>
            <button
                type="button"
                className="txn-summary-bar"
                onClick={onToggle}
                aria-expanded={open}
            >
                <span className="txn-chevron" aria-hidden="true">▸</span>

                <span className="txn-main">
                    <strong>{transaction.transactionNumber}</strong>
                    <span className="txn-meta">
                        {created.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit"
                        })}{" "}
                        · {transaction.cashier} · {itemCount} item
                        {itemCount === 1 ? "" : "s"}
                    </span>
                </span>

                <strong className="txn-total">{peso(transaction.total)}</strong>
            </button>

            {open && (
                <div className="txn-details">
                    <div className="txn-table-wrap">
                        <table className="txn-items">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Qty</th>
                                    <th>Price</th>
                                    <th>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, index) => (
                                    <tr key={index}>
                                        <td>{item.name}</td>
                                        <td>{item.quantity}</td>
                                        <td>{peso(item.price)}</td>
                                        <td>{peso(item.price * item.quantity)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <dl className="txn-facts">
                        <div><dt>Date</dt><dd>{created.toLocaleString()}</dd></div>
                        <div><dt>Cashier</dt><dd>{transaction.cashier}</dd></div>
                        <div><dt>Payment</dt><dd>{transaction.paymentMethod}</dd></div>
                        <div><dt>Subtotal</dt><dd>{peso(transaction.subtotal)}</dd></div>
                        <div><dt>Amount paid</dt><dd>{peso(transaction.amountPaid)}</dd></div>
                        <div><dt>Change</dt><dd>{peso(transaction.change)}</dd></div>
                        <div className="txn-fact-total">
                            <dt>Total</dt><dd>{peso(transaction.total)}</dd>
                        </div>
                    </dl>
                </div>
            )}
        </div>
    );
}

/* ---------- page ---------- */

function Transactions() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [mode, setMode] = useState("all"); // all | day | week | month
    const [anchor, setAnchor] = useState(() => new Date());
    const [sort, setSort] = useState("newest");
    const [search, setSearch] = useState("");

    const [openIds, setOpenIds] = useState(() => new Set());
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    useEffect(() => {
        fetch(`${API_URL}/api/transactions`)
            .then((response) => {
                if (!response.ok) throw new Error("Failed to load");
                return response.json();
            })
            .then(setTransactions)
            .catch((err) => {
                console.error(err);
                setError("Could not load transactions.");
            })
            .finally(() => setLoading(false));
    }, []);

    // Start from the first page whenever the view changes.
    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [mode, anchor, sort, search]);

    /* ----- filter + sort ----- */

    const filtered = useMemo(() => {
        const [start, end] = getRange(mode, anchor);
        const term = search.trim().toLowerCase();

        const list = transactions.filter((t) => {
            const when = new Date(t.createdAt);
            if (start && (when < start || when >= end)) return false;

            if (term) {
                const haystack = `${t.transactionNumber} ${t.cashier}`.toLowerCase();
                if (!haystack.includes(term)) return false;
            }
            return true;
        });

        list.sort((a, b) => {
            if (sort === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
            if (sort === "highest") return b.total - a.total;
            if (sort === "lowest") return a.total - b.total;
            return new Date(b.createdAt) - new Date(a.createdAt); // newest
        });

        return list;
    }, [transactions, mode, anchor, sort, search]);

    const stats = useMemo(() => {
        const sales = filtered.reduce((sum, t) => sum + (t.total || 0), 0);
        return {
            count: filtered.length,
            sales,
            average: filtered.length ? sales / filtered.length : 0
        };
    }, [filtered]);

    const visible = filtered.slice(0, visibleCount);

    // Group by day only when sorting by date.
    const groups = useMemo(() => {
        if (sort !== "newest" && sort !== "oldest") {
            return [{ key: "all", label: null, items: visible, total: null }];
        }

        const map = new Map();
        visible.forEach((t) => {
            const d = new Date(t.createdAt);
            const key = toDateValue(d);
            if (!map.has(key)) {
                map.set(key, {
                    key,
                    label: d.toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric"
                    }),
                    items: [],
                    total: 0
                });
            }
            const group = map.get(key);
            group.items.push(t);
            group.total += t.total || 0;
        });
        return [...map.values()];
    }, [visible, sort]);

    /* ----- handlers ----- */

    const toggle = (id) => {
        setOpenIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const shift = (direction) => {
        if (mode === "day") setAnchor((a) => addDays(a, direction));
        else if (mode === "week") setAnchor((a) => addDays(a, 7 * direction));
        else if (mode === "month") setAnchor((a) => addMonths(a, direction));
    };

    const periodTabs = [
        ["all", "All"],
        ["day", "Day"],
        ["week", "Week"],
        ["month", "Month"]
    ];

    return (
        <div className="txn-page">
            <h1>Transaction History</h1>

            {/* ----- controls ----- */}
            <div className="txn-controls">
                <div className="txn-tabs" role="tablist">
                    {periodTabs.map(([value, label]) => (
                        <button
                            key={value}
                            role="tab"
                            aria-selected={mode === value}
                            className={mode === value ? "txn-tab active" : "txn-tab"}
                            onClick={() => setMode(value)}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div className="txn-filter-row">
                    <input
                        type="text"
                        className="txn-search"
                        placeholder="Search transaction no. or cashier"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />

                    <select
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                        aria-label="Sort transactions"
                    >
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                        <option value="highest">Highest total</option>
                        <option value="lowest">Lowest total</option>
                    </select>
                </div>

                {mode !== "all" && (
                    <div className="txn-period-nav">
                        <button onClick={() => shift(-1)} aria-label="Previous">‹</button>

                        <div className="txn-period-label">
                            <strong>{rangeLabel(mode, anchor)}</strong>

                            {mode === "month" ? (
                                <input
                                    type="month"
                                    value={toMonthValue(anchor)}
                                    onChange={(e) =>
                                        e.target.value &&
                                        setAnchor(fromMonthValue(e.target.value))
                                    }
                                />
                            ) : (
                                <input
                                    type="date"
                                    value={toDateValue(anchor)}
                                    onChange={(e) =>
                                        e.target.value &&
                                        setAnchor(fromDateValue(e.target.value))
                                    }
                                />
                            )}
                        </div>

                        <button onClick={() => shift(1)} aria-label="Next">›</button>
                        <button
                            className="txn-today"
                            onClick={() => setAnchor(new Date())}
                        >
                            Today
                        </button>
                    </div>
                )}
            </div>

            {/* ----- summary ----- */}
            <div className="txn-stats">
                <div>
                    <span>Transactions</span>
                    <strong>{stats.count}</strong>
                </div>
                <div>
                    <span>Total sales</span>
                    <strong>{peso(stats.sales)}</strong>
                </div>
                <div>
                    <span>Average sale</span>
                    <strong>{peso(stats.average)}</strong>
                </div>
            </div>

            {filtered.length > 0 && (
                <div className="txn-bulk">
                    <button
                        onClick={() =>
                            setOpenIds(new Set(visible.map((t) => t._id)))
                        }
                    >
                        Expand all
                    </button>
                    <button onClick={() => setOpenIds(new Set())}>
                        Collapse all
                    </button>
                </div>
            )}

            {/* ----- list ----- */}
            {loading ? (
                <p className="txn-empty">Loading transactions...</p>
            ) : error ? (
                <p className="txn-error">{error}</p>
            ) : filtered.length === 0 ? (
                <p className="txn-empty">
                    No transactions found for this selection.
                </p>
            ) : (
                <>
                    {groups.map((group) => (
                        <section key={group.key} className="txn-group">
                            {group.label && (
                                <header className="txn-group-header">
                                    <h3>{group.label}</h3>
                                    <span>
                                        {group.items.length} sale
                                        {group.items.length === 1 ? "" : "s"} ·{" "}
                                        <strong>{peso(group.total)}</strong>
                                    </span>
                                </header>
                            )}

                            {group.items.map((t) => (
                                <TransactionRow
                                    key={t._id}
                                    transaction={t}
                                    open={openIds.has(t._id)}
                                    onToggle={() => toggle(t._id)}
                                />
                            ))}
                        </section>
                    ))}

                    {filtered.length > visible.length && (
                        <div className="txn-more">
                            <button
                                onClick={() =>
                                    setVisibleCount((c) => c + PAGE_SIZE)
                                }
                            >
                                Show more ({filtered.length - visible.length}{" "}
                                remaining)
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default Transactions;