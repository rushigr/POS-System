// Shared helpers for the signed-in user. The login response (including the
// signed token) is kept in localStorage under "user".

export function getStoredUser() {
    try {
        const user = JSON.parse(localStorage.getItem("user") || "null");
        return user && typeof user === "object" ? user : null;
    } catch {
        return null;
    }
}

// Headers for API calls. Pass extras, e.g. authHeaders({ "Content-Type": "application/json" }).
export function authHeaders(extra = {}) {
    const user = getStoredUser();

    return user?.token
        ? { ...extra, Authorization: `Bearer ${user.token}` }
        : { ...extra };
}

export const isRoot = (user) => user?.isRoot === true;