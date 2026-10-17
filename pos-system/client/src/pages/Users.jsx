import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Users.css";
import API_URL from "../api";

function Users() {
    const navigate = useNavigate();

    const [users, setUsers] = useState([]);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("cashier");
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

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

    const loadUsers = async () => {
        try {
            const response = await fetch(
                "${API_URL}/api/users",
                {
                    headers: getHeaders()
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to load users"
                );
            }

            setUsers(data);
            setError("");
        } catch (error) {
            setError(error.message || "Unable to load users.");
        } finally {
            setLoading(false);
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
    }, [navigate]);

    const clearForm = () => {
        setEditingId(null);
        setUsername("");
        setPassword("");
        setRole("cashier");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        const userData = {
            username,
            role
        };

        // Password is required for new accounts.
        if (!editingId || password.trim()) {
            userData.password = password;
        }

        try {
            const response = await fetch(
                editingId
                    ? `${API_URL}/api/users/${editingId}`
                    : "${API_URL}/api/users",
                {
                    method: editingId ? "PUT" : "POST",
                    headers: getHeaders(),
                    body: JSON.stringify(userData)
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to save user"
                );
            }

            alert(data.message);
            clearForm();
            await loadUsers();
        } catch (error) {
            setError(error.message || "Failed to save user.");
        }
    };

    const handleEdit = (user) => {
        setEditingId(user._id);
        setUsername(user.username);
        setRole(user.role);
        setPassword("");
        setError("");

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    };

    const handleDelete = async (user) => {
        if (
            !window.confirm(
                `Are you sure you want to delete "${user.username}"?`
            )
        ) {
            return;
        }

        setError("");

        try {
            const response = await fetch(
                `${API_URL}/api/users/${user._id}`,
                {
                    method: "DELETE",
                    headers: getHeaders()
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to delete user"
                );
            }

            alert(data.message);
            await loadUsers();
        } catch (error) {
            setError(error.message || "Failed to delete user.");
        }
    };

    return (
        <div className="users-page">
            <h1>User Management</h1>

            <div className="user-form-container">
                <h2>
                    {editingId ? "Edit User" : "Create User"}
                </h2>

                <form
                    className="user-form"
                    onSubmit={handleSubmit}
                >
                    <div className="user-form-field">
                        <label htmlFor="username">
                            Username
                        </label>

                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) =>
                                setUsername(e.target.value)
                            }
                            placeholder="Enter username"
                            required
                        />
                    </div>

                    <div className="user-form-field">
                        <label htmlFor="password">
                            Password
                        </label>

                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) =>
                                setPassword(e.target.value)
                            }
                            placeholder={
                                editingId
                                    ? "Leave blank to keep current password"
                                    : "Enter password"
                            }
                            required={!editingId}
                            autoComplete="new-password"
                        />
                    </div>

                    <div className="user-form-field">
                        <label htmlFor="role">
                            Role
                        </label>

                        <select
                            id="role"
                            value={role}
                            onChange={(e) =>
                                setRole(e.target.value)
                            }
                        >
                            <option value="cashier">
                                Cashier
                            </option>
                            <option value="admin">
                                Admin
                            </option>
                        </select>
                    </div>

                    <div className="user-form-actions">
                        <button type="submit">
                            {editingId
                                ? "Update User"
                                : "Create User"}
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

            {error && (
                <p className="users-error">{error}</p>
            )}

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
                                                onClick={() =>
                                                    handleEdit(user)
                                                }
                                            >
                                                Edit
                                            </button>

                                            <button
                                                type="button"
                                                className="user-delete-button"
                                                onClick={() =>
                                                    handleDelete(user)
                                                }
                                                disabled={
                                                    getCurrentUser()
                                                        ?.id === user._id ||
                                                    getCurrentUser()
                                                        ?._id === user._id
                                                }
                                                title={
                                                    getCurrentUser()
                                                        ?.id === user._id ||
                                                    getCurrentUser()
                                                        ?._id === user._id
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
        </div>
    );
}

export default Users;