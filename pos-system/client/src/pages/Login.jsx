import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import API_URL from "../api";

function Login() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    // Already signed in on this device: route each role to its home page.
    useEffect(() => {
        try {
            const savedUser = JSON.parse(localStorage.getItem("user") || "null");
            if (savedUser?.role === "admin") {
                navigate("/dashboard", { replace: true });
            } else if (savedUser?.role === "cashier") {
                navigate("/pos", { replace: true });
            }
        } catch {
            localStorage.removeItem("user");
        }
    }, [navigate]);

    const handleLogin = async (e) => {
        e.preventDefault();

        setError("");
        setLoading(true);
        // hawbdfjhsbfhabdfhbadhfkb

        try {
            const response = await fetch(
                `${API_URL}/api/auth/login`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        username,
                        password
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                setError(data.message || "Login failed");
                return;
            }

            localStorage.setItem(
                "user",
                JSON.stringify(data.user)
            );

            navigate(data.user?.role === "cashier" ? "/pos" : "/dashboard", { replace: true });

        } catch (error) {
            console.error(error);
            setError("Unable to connect to the server.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <h1>POS System</h1>

                <form
                    className="login-form"
                    onSubmit={handleLogin}
                >
                    <div>
                        <label>Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) =>
                                setUsername(e.target.value)
                            }
                            placeholder="Enter username"
                            required
                        />
                    </div>

                    <div>
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) =>
                                setPassword(e.target.value)
                            }
                            placeholder="Enter password"
                            required
                        />
                    </div>

                    {error && (
                        <p className="login-error">
                            {error}
                        </p>
                    )}

                    <button
                        className="login-button"
                        type="submit"
                        disabled={loading}
                    >
                        {loading
                            ? "Logging in..."
                            : "Login"}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default Login;