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
    const [dTotal, setDTotal] = useState(0);
    const [dLoading, setDLoading] = useState(false);
    const [dError, setDError] = useState("");
    const [openDeletion, setOpenDeletion] = useState(null);

    const loadLogs = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const params = new URLSearchParams({ page, limit: 25 });
            if (entityType) params.set("entityType", entityType);
            if (actor) params.set("actor", actor);

            const response = await fetch(
                `${API_URL}/api/audit?${params.toString()}`,
                { headers: authHeaders() }
            );

            if (!response.ok) throw new Error("Failed to load audit log");

            const data = await response.json();
            setLogs(data.logs);
            setPages(data.pages);
            setTotal(data.total);
        } catch (err) {
            console.error(err);
            setError("Could not load the audit log.");
        } finally {
            setLoading(false);
        }
    }, [page, entityType, actor]);

    const loadDeletions = useCallback(async () => {
        setDLoading(true);
        setDError("");

        try {
            const params = new URLSearchParams({ page: dPage, limit: 25 });

            const response = await fetch(
                `${API_URL}/api/audit/deletions?${params.toString()}`,
                { headers: authHeaders() }
            );

            if (!response.ok) throw new Error("Failed to load deletion log");

            const data = await response.json();
            setDeletions(data.deletions);
            setDPages(data.pages);
            setDTotal(data.total);
        } catch (err) {
            console.error(err);
            setDError("Could not load the deletion log.");
        } finally {
            setDLoading(false);
        }
    }, [dPage]);

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
                                    <th>When</th>
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
                        <button className="audit-refresh" onClick={loadDeletions}>
                            Refresh
                        </button>
                    </div>

                    {dError && <p className="audit-error">{dError}</p>}

                    <div className="audit-table-wrap">
                        <table className="audit-table">
                            <thead>
                                <tr>
                                    <th>When</th>
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