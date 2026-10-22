import {
    Link,
    useLocation,
    useNavigate
} from "react-router-dom";

import "./Navbar.css";

function Navbar() {
    const location = useLocation();
    const navigate = useNavigate();

    const savedUser = localStorage.getItem("user");

    const user = savedUser
        ? JSON.parse(savedUser)
        : null;

    const handleLogout = () => {
        localStorage.removeItem("user");
        navigate("/");
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