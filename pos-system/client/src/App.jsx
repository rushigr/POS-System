import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

import Navbar from "./components/Navbar";
import "./App.css";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Products from "./pages/Products";
import Transactions from "./pages/Transactions";
import Users from "./pages/Users";
import AuditLog from "./pages/AuditLog";

function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
        return null;
    }
}

function ProtectedPage({ children, adminOnly = false }) {
    const location = useLocation();
    const user = getCurrentUser();

    if (!user || !user.username) {
        return <Navigate to="/" replace state={{ from: location }} />;
    }

    if (user.role !== "admin" && user.role !== "cashier") {
        return <Navigate to="/" replace />;
    }

    // Cashiers must remain on the POS page even if they type another URL.
    if (user.role === "cashier" && location.pathname !== "/pos") {
        return <Navigate to="/pos" replace />;
    }

    if (adminOnly && user.role !== "admin") {
        return <Navigate to="/pos" replace />;
    }

    return children;
}

function AppContent() {
    const location = useLocation();
    const user = getCurrentUser();
    const isLoginPage = location.pathname === "/" && !user;

    // If an existing session visits the login URL, send it to the right home page.
    if (location.pathname === "/" && user?.role === "cashier") {
        return <Navigate to="/pos" replace />;
    }
    if (location.pathname === "/" && user?.role === "admin") {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <>
            {!isLoginPage && <Navbar />}

            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/dashboard" element={<ProtectedPage adminOnly><Dashboard /></ProtectedPage>} />
                <Route path="/pos" element={<ProtectedPage><POS /></ProtectedPage>} />
                <Route path="/products" element={<ProtectedPage adminOnly><Products /></ProtectedPage>} />
                <Route path="/transactions" element={<ProtectedPage adminOnly><Transactions /></ProtectedPage>} />
                <Route path="/users" element={<ProtectedPage adminOnly><Users /></ProtectedPage>} />
                <Route path="/audit" element={<ProtectedPage adminOnly><AuditLog /></ProtectedPage>} />
                <Route path="*" element={<Navigate to={user?.role === "cashier" ? "/pos" : user?.role === "admin" ? "/dashboard" : "/"} replace />} />
            </Routes>
        </>
    );
}

function App() {
    return (
        <BrowserRouter>
            <AppContent />
        </BrowserRouter>
    );
}

export default App;