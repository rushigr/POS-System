// Keep this file in sync with server/utils/passwordStrength.js

const BLOCKED_WORDS = [
    "password", "qwerty", "123456", "111111", "letmein",
    "welcome", "admin", "iloveyou", "ramen", "houdo"
];

export const STRENGTH_LABELS = ["Too weak", "Weak", "Fair", "Good", "Strong"];

export function evaluatePassword(password = "", username = "") {
    const lower = password.toLowerCase();
    const u = username.trim().toLowerCase();

    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);
    const classes = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;

    const checks = {
        length: password.length >= 8,
        long: password.length >= 12,
        mixedCase: hasLower && hasUpper,
        number: hasNumber,
        symbol: hasSymbol,
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

    return {
        checks,
        score,
        label: STRENGTH_LABELS[score],
        acceptable:
            checks.length && checks.notCommon && checks.noUsername && score >= 2
    };
}