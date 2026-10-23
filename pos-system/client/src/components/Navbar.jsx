import { useEffect, useRef, useState } from "react";
import {
    Link,
    useLocation,
    useNavigate
} from "react-router-dom";

import API_URL from "../api";
import { authHeaders, getStoredUser } from "../utils/auth";
import "./Navbar.css";

const readStoredUser = getStoredUser;

function Navbar() {
    const location = useLocation();
    const navigate = useNavigate();
    const user = readStoredUser();
    const [menuOpen, setMenuOpen] = useState(false);

    const stopHeartbeatRef = useRef(null);
    const heartbeatPromiseRef = useRef(null);
    const userId = user?.id;
    const username = user?.username;
    const storedSessionId = user?.sessionId;
    const isAdmin = user?.role === "admin";
    const isCashier = user?.role === "cashier";
    const roleLabel = user?.isRoot
        ? "Root"
        : isAdmin ? "Admin" : isCashier ? "Cashier" : "User";
    const homePath = isCashier ? "/pos" : "/dashboard";

    // Close the mobile menu after navigating to another page.
    useEffect(() => {
        setMenuOpen(false);
    }, [location.pathname]);

    // Keep the session alive while this signed-in browser is active. If a
    // browser closes unexpectedly, the backend marks it offline after timeout.
    useEffect(() => {
        if (!username) return undefined;

        let stopped = false;
        let inFlight = false;
        let sessionId = storedSessionId || "";

        const sendHeartbeat = () => {
            if (stopped || inFlight) return heartbeatPromiseRef.current;

            const currentUser = readStoredUser();
            if (!currentUser?.username) return null;

            sessionId = currentUser.sessionId || sessionId;
            inFlight = true;

            const task = (async () => {
                try {
                    const response = await fetch(`${API_URL}/api/sessions/heartbeat`, {
                        method: "POST",
                        headers: authHeaders({ "Content-Type": "application/json" }),
                        body: JSON.stringify({ sessionId })
                    });

                    // The login token expired or the account was removed.
                    if (response.status === 401) {
                        stopped = true;
                        localStorage.removeItem("user");
                        navigate("/", { replace: true });
                        return;
                    }

                    if (!response.ok) return;
                    const data = await response.json();

                    if (data.sessionId) {
                        sessionId = data.sessionId;
                        const latestUser = readStoredUser();

                        if (latestUser?.username === currentUser.username) {
                            localStorage.setItem(
                                "user",
                                JSON.stringify({ ...latestUser, sessionId })
                            );
                        }
                    }
                } catch {
                    // Network interruptions are tolerated; the next heartbeat retries.
                }
            })();

            heartbeatPromiseRef.current = task;
            task.finally(() => {
                inFlight = false;
                if (heartbeatPromiseRef.current === task) {
                    heartbeatPromiseRef.current = null;
                }
            });

            return task;
        };

        sendHeartbeat();
        const intervalId = setInterval(sendHeartbeat, 20000);
        stopHeartbeatRef.current = () => {
            stopped = true;
            clearInterval(intervalId);
        };

        return () => {
            stopped = true;
            clearInterval(intervalId);
            if (stopHeartbeatRef.current) stopHeartbeatRef.current = null;
        };
        // Username/ID identify the current login; session ID can refresh after inactivity.
    }, [userId, username, storedSessionId]);

    const handleLogout = async () => {
        if (stopHeartbeatRef.current) {
            stopHeartbeatRef.current();
            stopHeartbeatRef.current = null;
        }

        // Let an in-flight heartbeat finish first, so we end the newest session ID.
        try {
            if (heartbeatPromiseRef.current) {
                await heartbeatPromiseRef.current;
            }
        } catch {
            // Continue with local logout even if the heartbeat failed.
        }

        const currentUser = readStoredUser();

        try {
            if (currentUser?.username && currentUser?.sessionId) {
                await fetch(`${API_URL}/api/sessions/logout`, {
                    method: "POST",
                    headers: authHeaders({ "Content-Type": "application/json" }),
                    body: JSON.stringify({ sessionId: currentUser.sessionId }),
                    keepalive: true
                });
            }
        } catch {
            // Local logout should still work if the backend is unreachable.
        } finally {
            localStorage.removeItem("user");
            navigate("/", { replace: true });
        }
    };

    const linkClass = (path) =>
        location.pathname === path ? "nav-link active" : "nav-link";

    return (
        <nav className={`navbar${menuOpen ? " menu-open" : ""}`}>
            <div className="navbar-topbar">
                <div className="navbar-brand">
                    <Link to={homePath} aria-label="Houdo Ramen home">
                        <span className="navbar-brand-mark" aria-hidden="true">H</span>
                        <span className="navbar-brand-text">
                            <strong>Houdo Ramen</strong>
                            <small>POINT OF SALE</small>
                        </span>
                    </Link>
                </div>

                {user && (
                    <div className="navbar-account" title={`${roleLabel}: ${user.username}`}>
                        <span className="navbar-account-avatar" aria-hidden="true">
                            {(user.username || roleLabel).slice(0, 1).toUpperCase()}
                        </span>
                        <span className="navbar-account-copy">
                            <span className="navbar-account-role">{roleLabel}</span>
                            <strong className="navbar-account-name">{user.username}</strong>
                        </span>
                    </div>
                )}

                <button
                    type="button"
                    className="navbar-menu-toggle"
                    onClick={() => setMenuOpen((open) => !open)}
                    aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
                    aria-expanded={menuOpen}
                    aria-controls="main-navigation-links"
                >
                    <span className="navbar-menu-icon" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                    </span>
                </button>
            </div>

            <div
                id="main-navigation-links"
                className={`navbar-links${menuOpen ? " is-open" : ""}`}
            >
                {/* Cashiers see the POS and their own transactions only. */}
                {isAdmin && (
                    <Link to="/dashboard" className={linkClass("/dashboard")}>
                        Dashboard
                    </Link>
                )}

                {(isAdmin || isCashier) && (
                    <Link to="/pos" className={linkClass("/pos")}>
                        POS
                    </Link>
                )}

                {isCashier && (
                    <Link to="/transactions" className={linkClass("/transactions")}>
                        My Transactions
                    </Link>
                )}

                {isAdmin && (
                    <>
                        <Link to="/products" className={linkClass("/products")}>
                            Products
                        </Link>
                        <Link to="/transactions" className={linkClass("/transactions")}>
                            Transactions
                        </Link>
                        <Link to="/users" className={linkClass("/users")}>
                            Users
                        </Link>
                        <Link to="/audit" className={linkClass("/audit")}>
                            Audit Log
                        </Link>
                    </>
                )}

                <button
                    type="button"
                    className="logout-button"
                    onClick={handleLogout}
                >
                    Log out
                </button>
            </div>
        </nav>
    );
}

export default Navbar;