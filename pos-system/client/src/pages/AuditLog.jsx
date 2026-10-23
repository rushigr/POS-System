import { Fragment, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AuditLog.css";
import API_URL from "../api";

const ACTION_LABELS = {
    PRODUCT_CREATE: "Product added",
    PRODUCT_UPDATE: "Product updated",
    PRODUCT_DELETE: "Product deleted",
    USER_CREATE: "User created",
    USER_UPDATE: "User updated",
    USER_DELETE: "User deleted",
    TRANSACTION_VOID: "Transaction voided"
};

const REASON_MAX = 200;

const actionClass = (action) => {
    if (action.endsWith("_CREATE")) return "audit-badge create";
    if (action.endsWith("_DELETE") || action.endsWith("_VOID")) {
        return "audit-badge delete";
    }
    return "audit-badge update";
};

const formatValue = (field, value) => {
    if (value === null || value === undefined || value === "") return "—";
    if (field === "price") return `₱${Number(value).toFixed(2)}`;
    return String(value);
};

const getUser = () => {
    try {
        return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
        return null;
    }
};

const authHeaders = () => ({ "x-username": getUser()?.username || "" });

const pad = (n) => String(n).padStart(2, "0");

// local calendar date -> "YYYY-MM-DD" (what <input type="date"> uses)
const toDateValue = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return toDateValue(d);
};

// Whole local days -> exact timestamps, so the shop's timezone is respected.
const rangeParams = (params, from, to) => {
    if (from) params.set("from", new Date(`${from}T00:00:00`).toISOString());
    if (to) params.set("to", new Date(`${to}T23:59:59.999`).toISOString());
};

function DateRangeFilter({ label, from, to, onChange }) {
    const today = toDateValue(new Date());

    return (
        <div className="audit-range">
            <span className="audit-range-label">{label}</span>
            <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => onChange(e.target.value, to)}
                aria-label="From date"
            />
            <span>to</span>
            <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => onChange(from, e.target.value)}
                aria-label="To date"
            />
            <button type="button" className="audit-chip" onClick={() => onChange(today, today)}>
                Today
            </button>
            <button type="button" className="audit-chip" onClick={() => onChange(daysAgo(6), today)}>
                Last 7 days
            </button>
            <button type="button" className="audit-chip" onClick={() => onChange(daysAgo(29), today)}>
                Last 30 days
            </button>
            {(from || to) && (
                <button type="button" className="audit-chip clear" onClick={() => onChange("", "")}>
                    Clear
                </button>
            )}
        </div>
    );
}

function ChangesList({ changes }) {
    if (!changes || changes.length === 0) return "—";

    return (
        <ul className="audit-changes">
            {changes.map((c, i) => (
                <li key={i}>
                    <strong>{c.field}</strong>:{" "}
                    <span className="audit-from">{formatValue(c.field, c.from)}</span>
                    {" → "}
                    <span className="audit-to">{formatValue(c.field, c.to)}</span>
                </li>
            ))}
        </ul>
    );
}

function Pagination({ page, pages, loading, setPage }) {
    return (
        <div className="audit-pagination">
            <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1 || loading}
            >
                Previous
            </button>
            <span>Page {page} of {pages}</span>
            <button
                onClick={() => setPage((p) => Math.min(p + 1, pages))}
                disabled={page >= pages || loading}
            >
                Next
            </button>
        </div>
    );
}

function AuditLog() {
    const navigate = useNavigate();

    const [tab, setTab] = useState("audit"); // "audit" | "deletions"

    /* ---------- audit entries ---------- */
    const [logs, setLogs] = useState([]);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [total, setTotal] = useState(0);

    const [sort, setSort] = useState("desc"); // "desc" = newest first
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [entityType, setEntityType] = useState("");
    const [actorInput, setActorInput] = useState("");
    const [actor, setActor] = useState(""); // applied filter

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    /* ---------- selection + delete dialog ---------- */
    const [selected, setSelected] = useState([]);
    const [showDelete, setShowDelete] = useState(false);
    const [reason, setReason] = useState("");
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState("");
    const [notice, setNotice] = useState("");

    /* ---------- deletion log ---------- */
    const [deletions, setDeletions] = useState([]);
    const [dPage, setDPage] = useState(1);
    const [dPages, setDPages] = useState(1);
    const [dSort, setDSort] = useState("desc");
    const [dFrom, setDFrom] = useState("");
    const [dTo, setDTo] = useState("");
    const [dTotal, setDTotal] = useState(0);
    const [dLoading, setDLoading] = useState(false);
    const [dError, setDError] = useState("");
    const [openDeletion, setOpenDeletion] = useState(null);

    const loadLogs = useCallback(async () => {
        setError("");

        if (from && to && from > to) {
            setError("The 'from' date must be on or before the 'to' date.");
            return;
        }

        setLoading(true);

        try {
            const params = new URLSearchParams({ page, limit: 25, sort });
            rangeParams(params, from, to);
            if (entityType) params.set("entityType", entityType);
            if (actor) params.set("actor", actor);

            const response = await fetch(
                `${API_URL}/api/audit?${params.toString()}`,
                { headers: authHeaders() }
            );

            if (!response.ok) throw new Error("Failed to load audit log");

            const data = await response.json();

            // an out-of-date backend ignores ?sort= and never echoes it back
            if (data.sort !== sort) {
                setError("The server did not apply the sort order. Make sure the latest backend (auditRoutes.js) is deployed and restarted.");
            }

            setLogs(data.logs);
            setPages(data.pages);
            setTotal(data.total);
        } catch (err) {
            console.error(err);
            setError("Could not load the audit log.");
        } finally {
            setLoading(false);
        }
    }, [page, sort, from, to, entityType, actor]);

    const loadDeletions = useCallback(async () => {
        setDError("");

        if (dFrom && dTo && dFrom > dTo) {
            setDError("The 'from' date must be on or before the 'to' date.");
            return;
        }

        setDLoading(true);

        try {
            const params = new URLSearchParams({ page: dPage, limit: 25, sort: dSort });
            rangeParams(params, dFrom, dTo);

            const response = await fetch(
                `${API_URL}/api/audit/deletions?${params.toString()}`,
                { headers: authHeaders() }
            );

            if (!response.ok) throw new Error("Failed to load deletion log");

            const data = await response.json();

            if (data.sort !== dSort) {
                setDError("The server did not apply the sort order. Make sure the latest backend (auditRoutes.js) is deployed and restarted.");
            }

            setDeletions(data.deletions);
            setDPages(data.pages);
            setDTotal(data.total);
        } catch (err) {
            console.error(err);
            setDError("Could not load the deletion log.");
        } finally {
            setDLoading(false);
        }
    }, [dPage, dSort, dFrom, dTo]);

    // admin-only page
    useEffect(() => {
        const user = getUser();

        if (!user) {
            navigate("/");
            return;
        }

        if (user.role !== "admin") {
            alert("Access denied. Admins only.");
            navigate("/dashboard");
            return;
        }

        if (tab === "audit") loadLogs();
        else loadDeletions();
    }, [navigate, tab, loadLogs, loadDeletions]);

    const toggleSort = () => {
        setPage(1);
        setSelected([]);
        setSort((s) => (s === "desc" ? "asc" : "desc"));
    };

    const toggleDSort = () => {
        setDPage(1);
        setOpenDeletion(null);
        setDSort((s) => (s === "desc" ? "asc" : "desc"));
    };

    const changeRange = (nextFrom, nextTo) => {
        setPage(1);
        setSelected([]);
        setFrom(nextFrom);
        setTo(nextTo);
    };

    const changeDRange = (nextFrom, nextTo) => {
        setDPage(1);
        setOpenDeletion(null);
        setDFrom(nextFrom);
        setDTo(nextTo);
    };

    const applyActorFilter = (e) => {
        e.preventDefault();
        setPage(1);
        setSelected([]);
        setActor(actorInput.trim());
    };

    /* ---------- selection helpers ---------- */

    const pageIds = logs.map((l) => l._id);
    const allSelected =
        pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

    const toggleOne = (id) =>
        setSelected((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );

    const toggleAll = () =>
        setSelected(allSelected ? [] : pageIds);

    // selection belongs to the page the admin is looking at
    const changePage = (updater) => {
        setSelected([]);
        setPage(updater);
    };

    const openDeleteDialog = () => {
        setReason("");
        setDeleteError("");
        setShowDelete(true);
    };

    const closeDeleteDialog = () => {
        if (!deleting) setShowDelete(false);
    };

    const confirmDelete = async (e) => {
        e.preventDefault();

        if (!reason.trim()) {
            setDeleteError("Please enter a reason.");
            return;
        }

        setDeleting(true);
        setDeleteError("");

        try {
            const response = await fetch(`${API_URL}/api/audit/delete`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...authHeaders()
                },
                body: JSON.stringify({ ids: selected, reason: reason.trim() })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                setDeleteError(data.message || "Failed to delete entries.");
                return;
            }

            setShowDelete(false);
            setSelected([]);
            setNotice(`${data.message}. A permanent record was saved in the Deletion Log.`);

            // if that emptied the current page, step back one
            if (selected.length >= logs.length && page > 1) {
                setPage(page - 1);
            } else {
                loadLogs();
            }
        } catch (err) {
            console.error(err);
            setDeleteError("We couldn't reach the server. Please try again.");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="audit-page">
            <h1>{tab === "audit" ? "Audit Log" : "Deletion Log"}</h1>

            <div className="audit-tabs" role="tablist">
                <button
                    role="tab"
                    aria-selected={tab === "audit"}
                    className={tab === "audit" ? "audit-tab active" : "audit-tab"}
                    onClick={() => { setNotice(""); setTab("audit"); }}
                >
                    Audit Log
                </button>
                <button
                    role="tab"
                    aria-selected={tab === "deletions"}
                    className={tab === "deletions" ? "audit-tab active" : "audit-tab"}
                    onClick={() => { setNotice(""); setTab("deletions"); }}
                >
                    Deletion Log
                </button>
            </div>

            {notice && <p className="audit-notice">{notice}</p>}

            {tab === "audit" ? (
                <>
                    <p className="audit-subtitle">
                        A record of every change admins make to products,
                        user accounts and voided transactions. {total} entr{total === 1 ? "y" : "ies"}.
                    </p>

                    <div className="audit-filters">
                        <select
                            value={entityType}
                            onChange={(e) => {
                                setPage(1);
                                setSelected([]);
                                setEntityType(e.target.value);
                            }}
                        >
                            <option value="">All activity</option>
                            <option value="Product">Products</option>
                            <option value="User">Users</option>
                            <option value="Transaction">Transactions</option>
                        </select>

                        <select
                            value={sort}
                            onChange={(e) => {
                                setPage(1);
                                setSelected([]);
                                setSort(e.target.value);
                            }}
                            aria-label="Sort by date"
                        >
                            <option value="desc">Newest first</option>
                            <option value="asc">Oldest first</option>
                        </select>

                        <form onSubmit={applyActorFilter} className="audit-actor-form">
                            <input
                                type="text"
                                placeholder="Filter by admin username"
                                value={actorInput}
                                onChange={(e) => setActorInput(e.target.value)}
                            />
                            <button type="submit">Apply</button>
                        </form>

                        <button className="audit-refresh" onClick={loadLogs}>
                            Refresh
                        </button>

                        <button
                            className="audit-delete-btn"
                            onClick={openDeleteDialog}
                            disabled={selected.length === 0}
                        >
                            Delete selected{selected.length > 0 ? ` (${selected.length})` : ""}
                        </button>
                    </div>

                    <DateRangeFilter
                        label="Logged between"
                        from={from}
                        to={to}
                        onChange={changeRange}
                    />

                    {error && <p className="audit-error">{error}</p>}

                    <div className="audit-table-wrap">
                        <table className="audit-table">
                            <thead>
                                <tr>
                                    <th className="audit-check-col">
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            onChange={toggleAll}
                                            disabled={logs.length === 0}
                                            aria-label="Select all entries on this page"
                                        />
                                    </th>
                                    <th
                                        className="audit-sortable"
                                        onClick={toggleSort}
                                        aria-sort={sort === "asc" ? "ascending" : "descending"}
                                        title="Click to reverse the date order"
                                    >
                                        When {sort === "asc" ? "▲" : "▼"}
                                    </th>
                                    <th>Admin</th>
                                    <th>Action</th>
                                    <th>Target</th>
                                    <th>Changes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="6" className="audit-empty">Loading...</td></tr>
                                ) : logs.length === 0 ? (
                                    <tr><td colSpan="6" className="audit-empty">No audit entries found.</td></tr>
                                ) : (
                                    logs.map((log) => (
                                        <tr
                                            key={log._id}
                                            className={selected.includes(log._id) ? "audit-row-selected" : ""}
                                        >
                                            <td className="audit-check-col">
                                                <input
                                                    type="checkbox"
                                                    checked={selected.includes(log._id)}
                                                    onChange={() => toggleOne(log._id)}
                                                    aria-label="Select entry"
                                                />
                                            </td>
                                            <td className="audit-when">
                                                {new Date(log.createdAt).toLocaleString()}
                                            </td>
                                            <td><strong>{log.actor}</strong></td>
                                            <td>
                                                <span className={actionClass(log.action)}>
                                                    {ACTION_LABELS[log.action] || log.action}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="audit-entity">{log.entityType}</span>
                                                <br />
                                                {log.entityName || "—"}
                                            </td>
                                            <td><ChangesList changes={log.changes} /></td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <Pagination page={page} pages={pages} loading={loading} setPage={changePage} />
                </>
            ) : (
                <>
                    <p className="audit-subtitle">
                        A permanent record of every audit entry an admin deleted, who
                        deleted it, why, and a full copy of what was removed. These records
                        can't be edited or deleted. {dTotal} deletion{dTotal === 1 ? "" : "s"}.
                    </p>

                    <div className="audit-filters">
                        <select
                            value={dSort}
                            onChange={(e) => {
                                setDPage(1);
                                setOpenDeletion(null);
                                setDSort(e.target.value);
                            }}
                            aria-label="Sort by date"
                        >
                            <option value="desc">Newest first</option>
                            <option value="asc">Oldest first</option>
                        </select>

                        <button className="audit-refresh" onClick={loadDeletions}>
                            Refresh
                        </button>
                    </div>

                    <DateRangeFilter
                        label="Deleted between"
                        from={dFrom}
                        to={dTo}
                        onChange={changeDRange}
                    />

                    {dError && <p className="audit-error">{dError}</p>}

                    <div className="audit-table-wrap">
                        <table className="audit-table">
                            <thead>
                                <tr>
                                    <th
                                        className="audit-sortable"
                                        onClick={toggleDSort}
                                        aria-sort={dSort === "asc" ? "ascending" : "descending"}
                                        title="Click to reverse the date order"
                                    >
                                        When {dSort === "asc" ? "▲" : "▼"}
                                    </th>
                                    <th>Deleted by</th>
                                    <th>Reason</th>
                                    <th>Entries</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {dLoading ? (
                                    <tr><td colSpan="5" className="audit-empty">Loading...</td></tr>
                                ) : deletions.length === 0 ? (
                                    <tr><td colSpan="5" className="audit-empty">No audit entries have been deleted.</td></tr>
                                ) : (
                                    deletions.map((d) => {
                                        const open = openDeletion === d._id;

                                        return (
                                            <Fragment key={d._id}>
                                                <tr>
                                                    <td className="audit-when">
                                                        {new Date(d.createdAt).toLocaleString()}
                                                    </td>
                                                    <td><strong>{d.actor}</strong></td>
                                                    <td>{d.reason}</td>
                                                    <td>{d.deletedCount}</td>
                                                    <td>
                                                        <button
                                                            className="audit-refresh"
                                                            onClick={() => setOpenDeletion(open ? null : d._id)}
                                                        >
                                                            {open ? "Hide" : "View entries"}
                                                        </button>
                                                    </td>
                                                </tr>
                                                {open && (
                                                    <tr className="audit-deleted-detail">
                                                        <td colSpan="5">
                                                            <table className="audit-table audit-nested">
                                                                <thead>
                                                                    <tr>
                                                                        <th>Originally logged</th>
                                                                        <th>Admin</th>
                                                                        <th>Action</th>
                                                                        <th>Target</th>
                                                                        <th>Changes</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {d.entries.map((e) => (
                                                                        <tr key={e.originalId}>
                                                                            <td className="audit-when">
                                                                                {e.createdAt ? new Date(e.createdAt).toLocaleString() : "—"}
                                                                            </td>
                                                                            <td>{e.actor}</td>
                                                                            <td>
                                                                                <span className={actionClass(e.action || "")}>
                                                                                    {ACTION_LABELS[e.action] || e.action}
                                                                                </span>
                                                                            </td>
                                                                            <td>
                                                                                <span className="audit-entity">{e.entityType}</span>
                                                                                <br />
                                                                                {e.entityName || "—"}
                                                                            </td>
                                                                            <td><ChangesList changes={e.changes} /></td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <Pagination page={dPage} pages={dPages} loading={dLoading} setPage={setDPage} />
                </>
            )}

            {showDelete && (
                <div className="audit-modal-backdrop" onClick={closeDeleteDialog}>
                    <form
                        className="audit-modal"
                        onClick={(e) => e.stopPropagation()}
                        onSubmit={confirmDelete}
                    >
                        <h2>Delete {selected.length} audit entr{selected.length === 1 ? "y" : "ies"}?</h2>
                        <p>
                            This removes them from the Audit Log. A permanent copy, along
                            with your name and the reason below, is saved in the Deletion Log.
                        </p>

                        <label htmlFor="audit-delete-reason">Reason (required)</label>
                        <textarea
                            id="audit-delete-reason"
                            value={reason}
                            maxLength={REASON_MAX}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. Test entries created during setup"
                            rows={3}
                            autoFocus
                        />
                        <span className="audit-char-count">{reason.length}/{REASON_MAX}</span>

                        {deleteError && <p className="audit-error">{deleteError}</p>}

                        <div className="audit-modal-actions">
                            <button
                                type="button"
                                className="audit-refresh"
                                onClick={closeDeleteDialog}
                                disabled={deleting}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="audit-delete-btn"
                                disabled={deleting || !reason.trim()}
                            >
                                {deleting ? "Deleting..." : "Delete permanently"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

export default AuditLog;