import { useEffect, useRef } from "react";
import {
    Link,
    useLocation,
    useNavigate
} from "react-router-dom";

import API_URL from "../api";
import "./Navbar.css";

function Navbar() {
    const location = useLocation();
    const navigate = useNavigate();

    const savedUser = localStorage.getItem("user");
    let user = null;

    try {
        user = savedUser ? JSON.parse(savedUser) : null;
    } catch {
        user = null;
    }

    const stopHeartbeatRef = useRef(null);
    const heartbeatPromiseRef = useRef(null);
    const userId = user?.id;
    const username = user?.username;
    const storedSessionId = user?.sessionId;

    // Keep the session alive while this signed-in browser is active. If a
    // browser closes unexpectedly, the backend marks it offline after timeout.
    useEffect(() => {
        if (!username) return undefined;

        let stopped = false;
        let inFlight = false;
        let sessionId = storedSessionId || "";

        const sendHeartbeat = () => {
            if (stopped || inFlight) return heartbeatPromiseRef.current;

            let currentUser;
            try {
                currentUser = JSON.parse(localStorage.getItem("user") || "null");
            } catch {
                currentUser = null;
            }

            if (!currentUser?.username) return null;
            sessionId = currentUser.sessionId || sessionId;
            inFlight = true;

            const task = (async () => {
                try {
                    const response = await fetch(`${API_URL}/api/sessions/heartbeat`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "x-username": currentUser.username
                        },
                        body: JSON.stringify({ sessionId })
                    });

                    if (!response.ok) return;
                    const data = await response.json();

                    if (data.sessionId) {
                        sessionId = data.sessionId;
                        let latestUser;
                        try {
                            latestUser = JSON.parse(
                                localStorage.getItem("user") || "null"
                            );
                        } catch {
                            latestUser = null;
                        }

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
        // Username/ID identify the current login; session ID may be refreshed
        // inside this effect after an inactivity timeout.
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

        let currentUser = null;
        try {
            currentUser = JSON.parse(localStorage.getItem("user") || "null");
        } catch {
            currentUser = null;
        }

        try {
            if (currentUser?.username && currentUser?.sessionId) {
                await fetch(`${API_URL}/api/sessions/logout`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-username": currentUser.username
                    },
                    body: JSON.stringify({ sessionId: currentUser.sessionId }),
                    keepalive: true
                });
            }
        } catch {
            // Local logout should still work if the backend is unreachable.
        } finally {
            localStorage.removeItem("user");
            navigate("/");
        }
    };

    return (
        <nav className="navbar">

            <div className="navbar-brand">
                <Link to="/dashboard">
                    Houdo Ramen
                </Link>
            </div>

            <div className="navbar-links">

                {/* Dashboard */}
                <Link
                    to="/dashboard"
                    className={
                        location.pathname === "/dashboard"
                            ? "nav-link active"
                            : "nav-link"
                    }
                >
                    Dashboard
                </Link>

                {/* POS */}
                <Link
                    to="/pos"
                    className={
                        location.pathname === "/pos"
                            ? "nav-link active"
                            : "nav-link"
                    }
                >
                    POS
                </Link>

                {/* Products - ADMIN ONLY */}
                {user?.role === "admin" && (
                    <Link
                        to="/products"
                        className={
                            location.pathname === "/products"
                                ? "nav-link active"
                                : "nav-link"
                        }
                    >
                        Products
                    </Link>
                )}

                {/* Transactions */}
                <Link
                    to="/transactions"
                    className={
                        location.pathname === "/transactions"
                            ? "nav-link active"
                            : "nav-link"
                    }
                >
                    Transactions
                </Link>

                {/* Users */}
                {user?.role === "admin" && (
                    <Link
                        to="/users"
                        className={
                            location.pathname === "/users"
                                ? "nav-link active"
                                : "nav-link"
                        }
                    >
                        Users
                    </Link>
                )}

                {/* Audit Log - ADMIN ONLY */}
                {user?.role === "admin" && (
                    <Link
                        to="/audit"
                        className={
                            location.pathname === "/audit"
                                ? "nav-link active"
                                : "nav-link"
                        }
                    >
                        Audit Log
                    </Link>
                )}

                {/* Current User */}
                {user && (
                    <span className="navbar-username">
                        {user.username}
                    </span>
                )}

                {/* Logout */}
                <button
                    className="logout-button"
                    onClick={handleLogout}
                >
                    Logout
                </button>

            </div>
        </nav>
    );
}

export default Navbar;