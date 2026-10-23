import { useCallback, useEffect, useState } from "react";
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

    const loadLogs = useCallback(async () => {
        const savedUser = localStorage.getItem("user");
        const user = savedUser ? JSON.parse(savedUser) : null;

        setLoading(true);
        setError("");

        try {
            const params = new URLSearchParams({ page, limit: 25 });
            if (entityType) params.set("entityType", entityType);
            if (actor) params.set("actor", actor);

            const response = await fetch(
                `${API_URL}/api/audit?${params.toString()}`,
                { headers: { "x-username": user?.username || "" } }
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
            </div>

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
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="5" className="audit-empty">Loading...</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan="5" className="audit-empty">No audit entries found.</td></tr>
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
        </div>
    );
}

export default AuditLog;