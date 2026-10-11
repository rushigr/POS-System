import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

import Navbar from "./components/Navbar";
import "./App.css";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Products from "./pages/Products";
import Transactions from "./pages/Transactions";
import Users from "./pages/Users";

function AppContent() {
    const location = useLocation();

    const isLoginPage = location.pathname === "/";

    return (
        <>
            {!isLoginPage && <Navbar />}

            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/pos" element={<POS />} />
                <Route path="/products" element={<Products />} />
                <Route
                    path="/transactions"
                    element={<Transactions />}
                />
                <Route path="/users" element={<Users />} />
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