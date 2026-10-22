import { useEffect, useMemo, useState } from "react";
import "./Transactions.css";
import API_URL from "../api";
import Receipt from "../components/Receipt";

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

// Returns [start, end) or [null, null] for "all". For "custom", either end
// may be null (open-ended); `custom` holds yyyy-mm-dd strings, both inclusive.
function getRange(mode, anchor, custom = { from: "", to: "" }) {
    if (mode === "custom") {
        return [
            custom.from ? fromDateValue(custom.from) : null,
            custom.to ? addDays(fromDateValue(custom.to), 1) : null
        ];
    }
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

const fullDate = (d) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function rangeLabel(mode, anchor, custom) {
    const [start, end] = getRange(mode, anchor, custom);

    if (mode === "custom") {
        const last = end ? addDays(end, -1) : null;

        if (start && last) {
            return start.getTime() === last.getTime()
                ? fullDate(start)
                : `${fullDate(start)} – ${fullDate(last)}`;
        }
        if (start) return `From ${fullDate(start)}`;
        if (last) return `Up to ${fullDate(last)}`;
        return "All transactions";
    }

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

function TransactionRow({ transaction, open, onToggle, canVoid, onVoid, onReceipt }) {
    const voided = transaction.status === "voided";
    const items = transaction.items || [];
    const itemCount = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
    const created = new Date(transaction.createdAt);

    return (
        <div
            className={
                (open ? "txn-row open" : "txn-row") +
                (voided ? " voided" : "")
            }
        >
            <button
                type="button"
                className="txn-summary-bar"
                onClick={onToggle}
                aria-expanded={open}
            >
                <span className="txn-chevron" aria-hidden="true">▸</span>

                <span className="txn-main">
                    <strong>
                        {transaction.transactionNumber}
                        {voided && <span className="txn-badge">VOIDED</span>}
                    </strong>
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
                                        <td>
                                            {item.name}
                                            {item.notes?.trim() && (
                                                <div className="txn-item-note">
                                                    Note: {item.notes}
                                                </div>
                                            )}
                                        </td>
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
                        {Number(transaction.discountAmount || 0) > 0 && (
                            <div>
                                <dt>
                                    {({
                                        senior_citizen: "Senior Citizen",
                                        pwd: "PWD",
                                        custom: "Custom"
                                    })[transaction.discountType] || "Discount"} ({Number(transaction.discountRate || 0)}%)
                                </dt>
                                <dd className="txn-discount-value">−{peso(transaction.discountAmount)}</dd>
                            </div>
                        )}
                        <div><dt>Amount paid</dt><dd>{peso(transaction.amountPaid)}</dd></div>
                        <div><dt>Change</dt><dd>{peso(transaction.change)}</dd></div>
                        <div className="txn-fact-total">
                            <dt>Total</dt><dd>{peso(transaction.total)}</dd>
                        </div>
                    </dl>

                    {voided && (
                        <div className="txn-void-info">
                            <strong>Voided</strong>
                            {transaction.voidedBy && ` by ${transaction.voidedBy}`}
                            {transaction.voidedAt &&
                                ` on ${new Date(transaction.voidedAt).toLocaleString()}`}
                            {transaction.voidReason && (
                                <>
                                    <br />
                                    Reason: {transaction.voidReason}
                                </>
                            )}
                        </div>
                    )}

                    <div className="txn-actions">
                        <button
                            type="button"
                            className="txn-receipt-btn"
                            onClick={() => onReceipt(transaction)}
                        >
                            View / Print receipt
                        </button>
                        {canVoid && !voided && (
                            <button
                                type="button"
                                className="txn-void-btn"
                                onClick={() => onVoid(transaction)}
                            >
                                Void transaction
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ---------- page ---------- */

function Transactions() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [receiptTransaction, setReceiptTransaction] = useState(null);
    const [error, setError] = useState("");

    const [mode, setMode] = useState("all"); // all | day | week | month
    const [anchor, setAnchor] = useState(() => new Date());
    const [sort, setSort] = useState("newest");
    const [search, setSearch] = useState("");

    // custom period (mode "custom"): yyyy-mm-dd, both inclusive, either may be empty
    const [customFrom, setCustomFrom] = useState("");
    const [customTo, setCustomTo] = useState("");

    const changeFrom = (value) => {
        setCustomFrom(value);
        if (value && customTo && value > customTo) setCustomTo(value);
    };

    const changeTo = (value) => {
        setCustomTo(value);
        if (value && customFrom && value < customFrom) setCustomFrom(value);
    };

    const custom = useMemo(
        () => ({ from: customFrom, to: customTo }),
        [customFrom, customTo]
    );

    const [openIds, setOpenIds] = useState(() => new Set());
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    // void flow (admins only)
    const [voidTarget, setVoidTarget] = useState(null);
    const [voidReason, setVoidReason] = useState("");
    const [voidError, setVoidError] = useState("");
    const [voiding, setVoiding] = useState(false);

    const currentUser = (() => {
        try {
            return JSON.parse(localStorage.getItem("user"));
        } catch {
            return null;
        }
    })();
    const isAdmin = currentUser?.role === "admin";

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
    }, [mode, anchor, sort, search, customFrom, customTo]);

    /* ----- filter + sort ----- */

    const filtered = useMemo(() => {
        const [start, end] = getRange(mode, anchor, custom);
        const term = search.trim().toLowerCase();

        const list = transactions.filter((t) => {
            const when = new Date(t.createdAt);
            if (start && when < start) return false;
            if (end && when >= end) return false;

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
    }, [transactions, mode, anchor, sort, search, custom]);

    // Voided transactions stay in the list but never count toward sales.
    const stats = useMemo(() => {
        const valid = filtered.filter((t) => t.status !== "voided");
        const sales = valid.reduce((sum, t) => sum + (t.total || 0), 0);
        return {
            count: valid.length,
            voided: filtered.length - valid.length,
            sales,
            average: valid.length ? sales / valid.length : 0
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
            if (t.status !== "voided") group.total += t.total || 0;
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

    const openVoid = (transaction) => {
        setVoidTarget(transaction);
        setVoidReason("");
        setVoidError("");
    };

    const closeVoid = () => {
        if (!voiding) setVoidTarget(null);
    };

    const confirmVoid = async () => {
        const reason = voidReason.trim();

        if (!reason) return setVoidError("Please enter a reason.");

        setVoiding(true);
        setVoidError("");

        try {
            const response = await fetch(
                `${API_URL}/api/transactions/${voidTarget._id}/void`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-username": currentUser?.username || ""
                    },
                    body: JSON.stringify({ reason })
                }
            );

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.message || "Failed to void transaction");
            }

            setTransactions((prev) =>
                prev.map((t) => (t._id === data._id ? data : t))
            );
            setVoidTarget(null);
        } catch (err) {
            console.error(err);
            setVoidError(err.message || "Failed to void transaction");
        } finally {
            setVoiding(false);
        }
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
        ["month", "Month"],
        ["custom", "Custom"]
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

                {mode === "custom" && (
                    <div className="txn-custom">
                        <label className="txn-custom-field">
                            <span>From</span>
                            <input
                                type="date"
                                value={customFrom}
                                max={customTo || undefined}
                                onChange={(e) => changeFrom(e.target.value)}
                                aria-label="Start date"
                            />
                        </label>

                        <label className="txn-custom-field">
                            <span>To</span>
                            <input
                                type="date"
                                value={customTo}
                                min={customFrom || undefined}
                                onChange={(e) => changeTo(e.target.value)}
                                aria-label="End date"
                            />
                        </label>

                        <button
                            type="button"
                            className="txn-today"
                            onClick={() => {
                                setCustomFrom("");
                                setCustomTo("");
                            }}
                            disabled={!customFrom && !customTo}
                        >
                            Clear
                        </button>

                        <strong className="txn-custom-label">
                            {rangeLabel(mode, anchor, custom)}
                        </strong>
                    </div>
                )}

                {mode !== "all" && mode !== "custom" && (
                    <div className="txn-period-nav">
                        <button onClick={() => shift(-1)} aria-label="Previous">‹</button>

                        <div className="txn-period-label">
                            <strong>{rangeLabel(mode, anchor, custom)}</strong>

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
                {stats.voided > 0 && (
                    <div>
                        <span>Voided</span>
                        <strong>{stats.voided}</strong>
                    </div>
                )}
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
                                        {group.items.filter((t) => t.status !== "voided").length} sale
                                        {group.items.filter((t) => t.status !== "voided").length === 1 ? "" : "s"} ·{" "}
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
                                    canVoid={isAdmin}
                                    onVoid={openVoid}
                                    onReceipt={setReceiptTransaction}
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

            {/* ----- receipt preview / print ----- */}
            {receiptTransaction && (
                <Receipt
                    transaction={receiptTransaction}
                    onClose={() => setReceiptTransaction(null)}
                />
            )}

            {/* ----- void confirmation ----- */}
            {voidTarget && (
                <div
                    className="txn-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeVoid();
                    }}
                >
                    <div
                        className="txn-modal"
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="txn-void-title"
                    >
                        <h2 id="txn-void-title">
                            Void {voidTarget.transactionNumber}?
                        </h2>

                        <p>
                            This removes the {peso(voidTarget.total)} sale from
                            all totals and reports. The record is kept and
                            this cannot be undone.
                        </p>

                        <label>
                            Reason (required)
                            <textarea
                                value={voidReason}
                                onChange={(e) => setVoidReason(e.target.value)}
                                maxLength={200}
                                rows={3}
                                placeholder="e.g. Wrong item rung up"
                                autoFocus
                            />
                        </label>

                        {voidError && (
                            <p className="txn-modal-error">{voidError}</p>
                        )}

                        <div className="txn-modal-actions">
                            <button
                                type="button"
                                className="txn-modal-cancel"
                                onClick={closeVoid}
                                disabled={voiding}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="txn-void-btn solid"
                                onClick={confirmVoid}
                                disabled={voiding}
                            >
                                {voiding ? "Voiding..." : "Void transaction"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Transactions;