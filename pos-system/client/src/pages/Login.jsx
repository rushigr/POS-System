import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import API_URL from "../api";

function Login() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
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

    const handleLogin = async (event) => {
        event.preventDefault();
        setError("");
        setLoading(true);

        try {
            const response = await fetch(`${API_URL}/api/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ username: username.trim(), password })
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message || "Login failed. Check your details and try again.");
                return;
            }

            localStorage.setItem("user", JSON.stringify(data.user));
            navigate(data.user?.role === "cashier" ? "/pos" : "/dashboard", {
                replace: true
            });
        } catch (requestError) {
            console.error(requestError);
            setError("We couldn't connect to the server. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="login-page">
            <section className="login-showcase" aria-label="Houdo Ramen staff portal">
                <div className="login-brand-row">
                    <div className="login-brand-mark" aria-hidden="true">🍜</div>
                    <div className="login-brand-copy">
                        <span className="login-brand-name">Houdo Ramen</span>
                        <span className="login-brand-caption">POINT OF SALE</span>
                    </div>
                </div>

                <div className="login-showcase-content">
                    <span className="login-eyebrow">
                        <span className="login-eyebrow-dot" /> THE HEART OF THE COUNTER
                    </span>
                    <h1>
                        Good food.
                        <br />
                        <span>Great service.</span>
                    </h1>
                    <p className="login-showcase-description">
                        Your counter, your team, your next great bowl. Sign in to keep
                        every order running smoothly.
                    </p>

                    <div className="login-ramen-art" aria-hidden="true">
                        <span className="ramen-steam ramen-steam-one" />
                        <span className="ramen-steam ramen-steam-two" />
                        <span className="ramen-steam ramen-steam-three" />
                        <div className="ramen-bowl">
                            <span className="ramen-bowl-rim" />
                            <span className="ramen-noodles">〰 〰 〰</span>
                            <span className="ramen-topping ramen-topping-one" />
                            <span className="ramen-topping ramen-topping-two" />
                            <span className="ramen-topping ramen-topping-three" />
                        </div>
                        <span className="ramen-art-spark ramen-art-spark-one">✦</span>
                        <span className="ramen-art-spark ramen-art-spark-two">✧</span>
                    </div>
                </div>

                <div className="login-showcase-footer">
                    <span className="login-footer-check" aria-hidden="true">✓</span>
                    <span>Staff access only</span>
                    <span className="login-footer-divider" />
                    <span>Made for smooth service</span>
                </div>
            </section>

            <section className="login-panel" aria-label="Sign in">
                <div className="login-card">
                    <div className="login-card-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none">
                            <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="1.8" />
                            <path d="M4.5 20c.7-3.4 3.3-5.2 7.5-5.2s6.8 1.8 7.5 5.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                    </div>

                    <p className="login-form-eyebrow">WELCOME BACK</p>
                    <h2>Sign in to your account</h2>
                    <p className="login-form-description">
                        Enter your staff credentials to continue.
                    </p>

                    <form className="login-form" onSubmit={handleLogin}>
                        <div className="login-field">
                            <label htmlFor="login-username">Username</label>
                            <div className="login-input-wrap">
                                <svg className="login-input-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                    <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="1.7" />
                                    <path d="M4.5 20c.7-3.4 3.3-5.2 7.5-5.2s6.8 1.8 7.5 5.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                                </svg>
                                <input
                                    id="login-username"
                                    type="text"
                                    value={username}
                                    onChange={(event) => setUsername(event.target.value)}
                                    placeholder="Enter your username"
                                    autoComplete="username"
                                    autoCapitalize="none"
                                    spellCheck="false"
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="login-field">
                            <label htmlFor="login-password">Password</label>
                            <div className="login-input-wrap">
                                <svg className="login-input-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                    <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
                                    <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                                </svg>
                                <input
                                    id="login-password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    placeholder="Enter your password"
                                    autoComplete="current-password"
                                    required
                                    disabled={loading}
                                />
                                <button
                                    className="login-password-toggle"
                                    type="button"
                                    onClick={() => setShowPassword((current) => !current)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    aria-pressed={showPassword}
                                    disabled={loading}
                                >
                                    {showPassword ? (
                                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                            <path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                                            <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.2 0 8.5 4.4 9.5 6.5a1 1 0 0 1 0 1A14 14 0 0 1 18 16M6.2 6.3A15 15 0 0 0 2.5 11.5a1 1 0 0 0 0 1C3.5 14.6 6.8 19 12 19c1.1 0 2.1-.2 3-.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    ) : (
                                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                            <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                                            <circle cx="12" cy="12" r="2.8" stroke="currentColor" strokeWidth="1.7" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="login-error" role="alert" aria-live="polite">
                                <span className="login-error-mark" aria-hidden="true">!</span>
                                <span>{error}</span>
                            </div>
                        )}

                        <button className="login-button" type="submit" disabled={loading}>
                            {loading ? (
                                <>
                                    <span className="login-spinner" aria-hidden="true" />
                                    Signing you in...
                                </>
                            ) : (
                                <>
                                    Sign in
                                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                        <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="login-secure-note">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
                            <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                        <span>Authorized staff access</span>
                    </div>
                </div>

                <p className="login-copyright">© {new Date().getFullYear()} Houdo Ramen · Staff Portal</p>
            </section>
        </main>
    );
}

export default Login;
