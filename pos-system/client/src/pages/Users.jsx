import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Users.css";
import API_URL from "../api";
import { evaluatePassword } from "../utils/passwordStrength";

const formatSessionDateTime = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString();
};

const formatSessionDuration = (startValue, endValue) => {
    const start = new Date(startValue).getTime();
    const end = new Date(endValue).getTime();

    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
        return "—";
    }

    const totalSeconds = Math.floor((end - start) / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
};

function Users() {
    const navigate = useNavigate();

    const [users, setUsers] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [sessionsLoading, setSessionsLoading] = useState(true);
    const [sessionsError, setSessionsError] = useState("");
    const [sessionClock, setSessionClock] = useState(Date.now());
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("cashier");
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    // The change waiting for the admin's confirmation, or null.
    const [pending, setPending] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const passwordResult = useMemo(
        () => evaluatePassword(password, username),
        [password, username]
    );

    const getCurrentUser = () => {
        try {
            return JSON.parse(localStorage.getItem("user"));
        } catch {
            return null;
        }
    };

    const getHeaders = () => {
        const user = getCurrentUser();

        return {
            "Content-Type": "application/json",
            "x-username": user?.username || ""
        };
    };

    const isSelf = (user) => {
        const me = getCurrentUser();
        return me?.id === user._id || me?._id === user._id;
    };

    const loadUsers = async () => {
        try {
            const response = await fetch(`${API_URL}/api/users`, {
                headers: getHeaders()
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Failed to load users");
            }

            setUsers(data);
            setError("");
        } catch (error) {
            setError(error.message || "Unable to load users.");
        } finally {
            setLoading(false);
        }
    };

    const loadSessions = async () => {
        setSessionsLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/sessions`, {
                headers: getHeaders()
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Failed to load session activity");
            }

            setSessions(Array.isArray(data.sessions) ? data.sessions : []);
            setSessionsError("");
        } catch (error) {
            setSessionsError(error.message || "Unable to load session activity.");
        } finally {
            setSessionsLoading(false);
        }
    };

    useEffect(() => {
        const user = getCurrentUser();

        if (!user) {
            navigate("/");
            return;
        }

        if (user.role !== "admin") {
            alert("Access denied. Admins only.");
            navigate("/dashboard");
            return;
        }

        loadUsers();
        loadSessions();

        // Refresh active/offline status every 15 seconds while this page is open.
        const sessionRefresh = setInterval(() => {
            loadSessions();
        }, 15000);

        return () => clearInterval(sessionRefresh);
    }, [navigate]);

    // Update elapsed session durations while the admin watches this page.
    useEffect(() => {
        const timer = setInterval(() => setSessionClock(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Success banner disappears on its own.
    useEffect(() => {
        if (!success) return;
        const timer = setTimeout(() => setSuccess(""), 4000);
        return () => clearTimeout(timer);
    }, [success]);

    const clearForm = () => {
        setEditingId(null);
        setUsername("");
        setPassword("");
        setRole("cashier");
        setShowPassword(false);
    };

    /* ---------- step 1: build a summary and ask for confirmation ---------- */

    const handleSubmit = (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        const cleanUsername = username.trim();
        const passwordProvided = password.trim().length > 0;

        if (passwordProvided && !passwordResult.acceptable) {
            setError("Please choose a stronger password.");
            return;
        }

        const payload = { username: cleanUsername, role };
        if (passwordProvided) payload.password = password;

        if (editingId) {
            const original = users.find((u) => u._id === editingId);
            const changes = [];

            if (original.username !== cleanUsername) {
                changes.push({
                    label: "Username",
                    from: original.username,
                    to: cleanUsername
                });
            }

            if (original.role !== role) {
                changes.push({
                    label: "Role",
                    from: original.role,
                    to: role
                });
            }

            if (passwordProvided) {
                changes.push({
                    label: "Password",
                    from: "••••••••",
                    to: "New password"
                });
            }

            if (changes.length === 0) {
                setError("No changes to save.");
                return;
            }

            let warning = "";
            if (original.role !== "admin" && role === "admin") {
                warning =
                    "This gives the user full admin access, including managing products and users.";
            } else if (original.role === "admin" && role !== "admin") {
                warning =
                    "This removes the user's admin access.";
            }

            setPending({
                type: "update",
                title: `Update "${original.username}"?`,
                confirmLabel: "Save Changes",
                userId: editingId,
                payload,
                changes,
                warning
            });
        } else {
            setPending({
                type: "create",
                title: "Create this user?",
                confirmLabel: "Create User",
                payload,
                changes: [
                    { label: "Username", to: cleanUsername },
                    { label: "Role", to: role },
                    { label: "Password", to: "Set" }
                ],
                warning:
                    role === "admin"
                        ? "This account will have full admin access."
                        : ""
            });
        }
    };

    const handleEdit = (user) => {
        setEditingId(user._id);
        setUsername(user.username);
        setRole(user.role);
        setPassword("");
        setShowPassword(false);
        setError("");
        setSuccess("");

        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleDelete = (user) => {
        setError("");
        setSuccess("");

        setPending({
            type: "delete",
            title: `Delete "${user.username}"?`,
            confirmLabel: "Delete User",
            userId: user._id,
            changes: [
                { label: "Username", from: user.username },
                { label: "Role", from: user.role }
            ],
            warning:
                "This permanently removes the account and cannot be undone.",
            danger: true
        });
    };

    /* ---------- step 2: actually send it after the admin confirms ---------- */

    const confirmPending = async () => {
        if (!pending || submitting) return;

        setSubmitting(true);
        setError("");

        try {
            let url = `${API_URL}/api/users`;
            let method = "POST";
            let body;

            if (pending.type === "update") {
                url = `${API_URL}/api/users/${pending.userId}`;
                method = "PUT";
                body = JSON.stringify(pending.payload);
            } else if (pending.type === "create") {
                body = JSON.stringify(pending.payload);
            } else {
                url = `${API_URL}/api/users/${pending.userId}`;
                method = "DELETE";
            }

            const response = await fetch(url, {
                method,
                headers: getHeaders(),
                body
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Request failed");
            }

            setSuccess(data.message);

            if (pending.type !== "delete" || pending.userId === editingId) {
                clearForm();
            }

            await loadUsers();
        } catch (error) {
            setError(error.message || "Something went wrong.");
        } finally {
            setSubmitting(false);
            setPending(null);
        }
    };

    /* ---------- password strength UI ---------- */

    const { checks } = passwordResult;

    const requirements = [
        { label: "At least 8 characters", met: checks.length },
        { label: "12+ characters (recommended)", met: checks.long },
        { label: "Upper and lowercase letters", met: checks.mixedCase },
        { label: "A number", met: checks.number },
        { label: "A symbol (! @ # ? ...)", met: checks.symbol },
        {
            label: "Not a common word or the username",
            met: checks.notCommon && checks.noUsername
        }
    ];

    const passwordBlocksSubmit =
        password.length > 0 && !passwordResult.acceptable;

    return (
        <div className="users-page">
            <h1>User Management</h1>

            <div className="user-form-container">
                <h2>{editingId ? "Edit User" : "Create User"}</h2>

                <form className="user-form" onSubmit={handleSubmit}>
                    <div className="user-form-field">
                        <label htmlFor="username">Username</label>

                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter username"
                            required
                        />
                    </div>

                    <div className="user-form-field">
                        <label htmlFor="password">Password</label>

                        <div className="pw-input-wrap">
                            <input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={
                                    editingId
                                        ? "Leave blank to keep current password"
                                        : "Enter password"
                                }
                                required={!editingId}
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                className="pw-toggle"
                                onClick={() => setShowPassword((s) => !s)}
                            >
                                {showPassword ? "Hide" : "Show"}
                            </button>
                        </div>

                        {password.length > 0 && (
                            <div className="pw-meter" aria-live="polite">
                                <div className="pw-bars">
                                    {[1, 2, 3, 4].map((level) => (
                                        <span
                                            key={level}
                                            className={
                                                passwordResult.score >= level
                                                    ? `pw-bar on level-${passwordResult.score}`
                                                    : "pw-bar"
                                            }
                                        />
                                    ))}
                                </div>

                                <span
                                    className={`pw-label level-${passwordResult.score}`}
                                >
                                    {passwordResult.label}
                                </span>

                                <ul className="pw-checklist">
                                    {requirements.map((r) => (
                                        <li
                                            key={r.label}
                                            className={r.met ? "met" : ""}
                                        >
                                            {r.met ? "✓" : "○"} {r.label}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    <div className="user-form-field">
                        <label htmlFor="role">Role</label>

                        <select
                            id="role"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                        >
                            <option value="cashier">Cashier</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>

                    <div className="user-form-actions">
                        <button
                            type="submit"
                            disabled={passwordBlocksSubmit}
                            title={
                                passwordBlocksSubmit
                                    ? "Choose a stronger password first"
                                    : ""
                            }
                        >
                            {editingId ? "Update User" : "Create User"}
                        </button>

                        {editingId && (
                            <button
                                type="button"
                                className="user-cancel-button"
                                onClick={clearForm}
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {success && <p className="users-success">{success}</p>}
            {error && <p className="users-error">{error}</p>}

            <h2>Existing Users</h2>

            {loading ? (
                <p>Loading users...</p>
            ) : users.length === 0 ? (
                <p>No users found.</p>
            ) : (
                <div className="users-table-container">
                    <table className="users-table">
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Role</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {users.map((user) => (
                                <tr key={user._id}>
                                    <td>{user.username}</td>

                                    <td>
                                        <span
                                            className={`role-badge ${user.role}`}
                                        >
                                            {user.role}
                                        </span>
                                    </td>

                                    <td>
                                        <div className="user-actions">
                                            <button
                                                type="button"
                                                className="user-edit-button"
                                                onClick={() => handleEdit(user)}
                                            >
                                                Edit
                                            </button>

                                            <button
                                                type="button"
                                                className="user-delete-button"
                                                onClick={() => handleDelete(user)}
                                                disabled={isSelf(user)}
                                                title={
                                                    isSelf(user)
                                                        ? "You cannot delete your own account"
                                                        : "Delete user"
                                                }
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ---------- STAFF SESSION ACTIVITY ---------- */}
            <section className="session-activity-section">
                <div className="session-activity-header">
                    <div>
                        <h2>Staff Activity</h2>
                        <p>
                            Recent login sessions, active duration, and offline time.
                            Status refreshes every 15 seconds.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="session-refresh-button"
                        onClick={loadSessions}
                        disabled={sessionsLoading}
                    >
                        {sessionsLoading ? "Refreshing..." : "Refresh"}
                    </button>
                </div>

                <div className="session-stat-cards">
                    <div className="session-stat-card">
                        <span className="session-stat-label">Online now</span>
                        <strong>
                            {sessions.filter((session) => session.status === "active").length}
                        </strong>
                    </div>
                    <div className="session-stat-card">
                        <span className="session-stat-label">Recent sessions</span>
                        <strong>{sessions.length}</strong>
                    </div>
                    <div className="session-stat-card">
                        <span className="session-stat-label">Offline sessions</span>
                        <strong>
                            {sessions.filter((session) => session.status === "offline").length}
                        </strong>
                    </div>
                </div>

                {sessionsError && (
                    <p className="session-activity-error">{sessionsError}</p>
                )}

                {sessionsLoading && sessions.length === 0 ? (
                    <p className="session-empty-state">Loading staff activity...</p>
                ) : sessions.length === 0 ? (
                    <p className="session-empty-state">
                        No recorded login sessions yet. New sessions will appear after users sign in.
                    </p>
                ) : (
                    <div className="session-table-container">
                        <table className="session-table">
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th>Login time</th>
                                    <th>Active duration</th>
                                    <th>Last activity</th>
                                    <th>Offline time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sessions.map((session) => {
                                    const durationEnd = session.offlineAt || new Date(sessionClock);
                                    const offlineLabel = session.offlineAt
                                        ? `${session.endedBy === "inactivity" ? "≈ " : ""}${formatSessionDateTime(session.offlineAt)}`
                                        : "—";

                                    return (
                                        <tr key={session._id}>
                                            <td className="session-username">{session.username}</td>
                                            <td>
                                                <span className={`role-badge ${session.role}`}>
                                                    {session.role}
                                                </span>
                                            </td>
                                            <td>
                                                <span
                                                    className={`session-status-badge ${session.status}`}
                                                >
                                                    <span className="session-status-dot" />
                                                    {session.status === "active" ? "Online" : "Offline"}
                                                </span>
                                            </td>
                                            <td>{formatSessionDateTime(session.loginAt)}</td>
                                            <td className="session-duration">
                                                {formatSessionDuration(session.loginAt, durationEnd)}
                                            </td>
                                            <td>{formatSessionDateTime(session.lastSeenAt)}</td>
                                            <td>
                                                {offlineLabel}
                                                {session.endedBy === "inactivity" && session.offlineAt && (
                                                    <small className="session-time-note">Estimated from last heartbeat</small>
                                                )}
                                                {session.endedBy === "logout" && session.offlineAt && (
                                                    <small className="session-time-note">Logged out</small>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <p className="session-activity-footnote">
                    Browser closures and lost connections are detected after 90 seconds without a heartbeat,
                    so those offline times are estimates. Clicking Logout records the server time of logout.
                </p>
            </section>

            {/* ---------- CONFIRMATION MODAL ---------- */}
            {pending && (
                <div
                    className="user-confirm-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !submitting) {
                            setPending(null);
                        }
                    }}
                >
                    <div
                        className="user-confirm-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="user-confirm-title"
                    >
                        <h2 id="user-confirm-title">{pending.title}</h2>

                        <div className="user-confirm-changes">
                            {pending.changes.map((c) => (
                                <div className="user-confirm-row" key={c.label}>
                                    <span className="user-confirm-label">
                                        {c.label}
                                    </span>

                                    <span className="user-confirm-value">
                                        {c.from !== undefined &&
                                        c.to !== undefined ? (
                                            <>
                                                <span className="user-confirm-from">
                                                    {c.from}
                                                </span>
                                                {" → "}
                                                <strong>{c.to}</strong>
                                            </>
                                        ) : (
                                            <strong>{c.to ?? c.from}</strong>
                                        )}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {pending.warning && (
                            <p
                                className={
                                    pending.danger
                                        ? "user-confirm-warning danger"
                                        : "user-confirm-warning"
                                }
                            >
                                {pending.warning}
                            </p>
                        )}

                        <div className="user-confirm-actions">
                            <button
                                type="button"
                                className="user-cancel-button"
                                onClick={() => setPending(null)}
                                disabled={submitting}
                            >
                                Go Back
                            </button>

                            <button
                                type="button"
                                className={
                                    pending.danger
                                        ? "user-delete-button"
                                        : "user-confirm-button"
                                }
                                onClick={confirmPending}
                                disabled={submitting}
                            >
                                {submitting
                                    ? "Working..."
                                    : pending.confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Users;