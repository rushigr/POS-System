// Keep this file in sync with client/src/utils/passwordStrength.js
// The server check is the one that actually protects the system;
// the client check only gives instant feedback.

const BLOCKED_WORDS = [
    "password", "qwerty", "123456", "111111", "letmein",
    "welcome", "admin", "iloveyou", "ramen", "houdo"
];

function evaluatePassword(password = "", username = "") {
    const lower = password.toLowerCase();
    const u = username.trim().toLowerCase();

    const classes = [
        /[a-z]/.test(password),
        /[A-Z]/.test(password),
        /\d/.test(password),
        /[^A-Za-z0-9]/.test(password)
    ].filter(Boolean).length;

    const checks = {
        length: password.length >= 8,
        long: password.length >= 12,
        notCommon: !BLOCKED_WORDS.some((w) => lower.includes(w)),
        noUsername: u.length < 3 || !lower.includes(u)
    };

    let score = 0;
    if (checks.length) score++;
    if (checks.long) score++;
    if (classes >= 3) score++;
    if (classes === 4) score++;

    if (!checks.length) score = Math.min(score, 1);
    if (!checks.notCommon || !checks.noUsername) score = Math.min(score, 1);
    if (!password) score = 0;

    return { checks, score };
}

// Returns an error message, or null if the password is acceptable.
function validatePassword(password, username) {
    const { checks, score } = evaluatePassword(password, username);

    if (!checks.length) return "Password must be at least 8 characters";
    if (!checks.notCommon) return "Password is too common or predictable";
    if (!checks.noUsername) return "Password must not contain the username";
    if (score < 2) {
        return "Password is too weak. Make it longer or mix upper/lowercase letters, numbers and symbols";
    }
    return null;
}

module.exports = { evaluatePassword, validatePassword };