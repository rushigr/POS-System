import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AuditLog.css";
import API_URL from "../api";
import { authHeaders, getStoredUser } from "../utils/auth";

const ACTION_LABELS = {
    PRODUCT_CREATE: "Product added",
    PRODUCT_UPDATE: "Product updated",
    PRODUCT_DELETE: "Product deleted",
    USER_CREATE: "User created",
    USER_UPDATE: "User updated",
    USER_DELETE: "User deleted",
    TRANSACTION_VOID: "Transaction voided",
    AUDIT_ENTRY_DELETE: "Log entry deleted",
    AUDIT_CLEAR: "Audit log cleared",
    SESSION_HISTORY_CLEAR: "Staff activity cleared"
};

const actionClass = (action) => {
    if (action.endsWith("_CREATE")) return "audit-badge create";
    if (
        action.endsWith("_DELETE") ||
        action.endsWith("_VOID") ||
        action.endsWith("_CLEAR")
    ) {
        return "audit-badge delete";
    }
    return "audit-badge update";
};

const formatValue = (field, value) => {
    if (value === null || value === undefined || value === "") return "—";
    if (field === "price") return `₱${Number(value).toFixed(2)}`;
    return String(value);
};

function AuditLog() {
    const navigate = useNavigate();

    const [logs, setLogs] = useState([]);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [total, setTotal] = useState(0);

    const [entityType, setEntityType] = useState("");
    const [actorInput, setActorInput] = useState("");
    const [actor, setActor] = useState(""); // applied filter

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    // Only the root account can delete log entries.
    const iAmRoot = getStoredUser()?.isRoot === true;

    // what the root user is about to delete: { type: "one", log } | { type: "all" }
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [confirmText, setConfirmText] = useState("");
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState("");

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

    // admin-only page
    useEffect(() => {
        const savedUser = localStorage.getItem("user");

        if (!savedUser) {
            navigate("/");
            return;
        }

        if (JSON.parse(savedUser).role !== "admin") {
            alert("Access denied. Admins only.");
            navigate("/dashboard");
            return;
        }

        loadLogs();
    }, [navigate, loadLogs]);

    const openDelete = (target) => {
        setDeleteTarget(target);
        setConfirmText("");
        setDeleteError("");
    };

    const closeDelete = () => {
        if (!deleting) setDeleteTarget(null);
    };

    const confirmDelete = async () => {
        if (!deleteTarget || deleting) return;

        setDeleting(true);
        setDeleteError("");

        try {
            const isAll = deleteTarget.type === "all";

            const response = await fetch(
                isAll
                    ? `${API_URL}/api/audit`
                    : `${API_URL}/api/audit/${deleteTarget.log._id}`,
                {
                    method: "DELETE",
                    headers: authHeaders({ "Content-Type": "application/json" }),
                    // "Delete all" is limited to the filters currently applied.
                    body: isAll
                        ? JSON.stringify({ confirm: "DELETE", entityType, actor })
                        : undefined
                }
            );

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.message || "Failed to delete");
            }

            setNotice(data.message || "Deleted.");
            setDeleteTarget(null);
            setPage(1);
            await loadLogs();
        } catch (err) {
            setDeleteError(err.message || "Failed to delete");
        } finally {
            setDeleting(false);
        }
    };

    useEffect(() => {
        if (!notice) return undefined;
        const timer = setTimeout(() => setNotice(""), 5000);
        return () => clearTimeout(timer);
    }, [notice]);

    const applyActorFilter = (e) => {
        e.preventDefault();
        setPage(1);
        setActor(actorInput.trim());
    };

    return (
        <div className="audit-page">
            <h1>Audit Log</h1>
            <p className="audit-subtitle">
                A record of every change admins make to products,
                user accounts and voided transactions. {total} entr{total === 1 ? "y" : "ies"}.
            </p>

            <div className="audit-filters">
                <select
                    value={entityType}
                    onChange={(e) => {
                        setPage(1);
                        setEntityType(e.target.value);
                    }}
                >
                    <option value="">All activity</option>
                    <option value="Product">Products</option>
                    <option value="User">Users</option>
                    <option value="Transaction">Transactions</option>
                    <option value="Log">Log deletions</option>
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

                {iAmRoot && (
                    <button
                        type="button"
                        className="audit-delete-all"
                        onClick={() => openDelete({ type: "all" })}
                        disabled={loading || total === 0}
                        title="Root only"
                    >
                        Delete all{entityType || actor ? " matching" : ""} ({total})
                    </button>
                )}
            </div>

            {notice && <p className="audit-notice">{notice}</p>}
            {error && <p className="audit-error">{error}</p>}

            <div className="audit-table-wrap">
                <table className="audit-table">
                    <thead>
                        <tr>
                            <th>When</th>
                            <th>Admin</th>
                            <th>Action</th>
                            <th>Target</th>
                            <th>Changes</th>
                            {iAmRoot && <th>Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={iAmRoot ? 6 : 5} className="audit-empty">Loading...</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan={iAmRoot ? 6 : 5} className="audit-empty">No audit entries found.</td></tr>
                        ) : (
                            logs.map((log) => (
                                <tr key={log._id}>
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
                                    <td>
                                        {log.changes.length === 0 ? "—" : (
                                            <ul className="audit-changes">
                                                {log.changes.map((c, i) => (
                                                    <li key={i}>
                                                        <strong>{c.field}</strong>:{" "}
                                                        <span className="audit-from">
                                                            {formatValue(c.field, c.from)}
                                                        </span>
                                                        {" → "}
                                                        <span className="audit-to">
                                                            {formatValue(c.field, c.to)}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </td>
                                    {iAmRoot && (
                                        <td>
                                            <button
                                                type="button"
                                                className="audit-row-delete"
                                                onClick={() => openDelete({ type: "one", log })}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

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

            {deleteTarget && (
                <div
                    className="audit-modal-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeDelete();
                    }}
                >
                    <div
                        className="audit-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="audit-delete-title"
                    >
                        <h2 id="audit-delete-title">
                            {deleteTarget.type === "all"
                                ? `Delete ${total} log entr${total === 1 ? "y" : "ies"}?`
                                : "Delete this log entry?"}
                        </h2>

                        {deleteTarget.type === "one" ? (
                            <p>
                                <strong>
                                    {ACTION_LABELS[deleteTarget.log.action] ||
                                        deleteTarget.log.action}
                                </strong>
                                {" by "}
                                {deleteTarget.log.actor},{" "}
                                {new Date(deleteTarget.log.createdAt).toLocaleString()}
                            </p>
                        ) : (
                            <p>
                                {entityType || actor
                                    ? "Every entry matching the filters currently applied will be deleted."
                                    : "Every entry in the audit log will be deleted."}
                            </p>
                        )}

                        <p className="audit-modal-warning">
                            This cannot be undone. A single note saying who deleted
                            log entries, and when, is added to the log.
                        </p>

                        {deleteTarget.type === "all" && (
                            <label className="audit-modal-confirm">
                                Type <strong>DELETE</strong> to confirm
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    autoComplete="off"
                                    autoFocus
                                />
                            </label>
                        )}

                        {deleteError && <p className="audit-error">{deleteError}</p>}

                        <div className="audit-modal-actions">
                            <button
                                type="button"
                                className="audit-refresh"
                                onClick={closeDelete}
                                disabled={deleting}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="audit-delete-all"
                                onClick={confirmDelete}
                                disabled={
                                    deleting ||
                                    (deleteTarget.type === "all" && confirmText !== "DELETE")
                                }
                            >
                                {deleting ? "Deleting..." : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AuditLog;