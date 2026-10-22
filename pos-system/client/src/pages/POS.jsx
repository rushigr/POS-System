import { useEffect, useMemo, useRef, useState } from "react";
import "./POS.css";
import API_URL from "../api";

const CATEGORIES = ["All", "Ramen", "Rice Meal", "Snacks", "Add-Ons"];
const QUICK_CASH = [100, 200, 500, 1000];
const MAX_QTY = 99;

// Built-in keypad. "back" and "clear" are functions, "enter" depends on mode.
const NUMPAD_KEYS = [
    { key: "7" }, { key: "8" }, { key: "9" },
    { key: "back", label: "⌫", name: "Backspace", cls: "np-fn" },
    { key: "4" }, { key: "5" }, { key: "6" },
    { key: "clear", label: "C", name: "Clear", cls: "np-fn" },
    { key: "1" }, { key: "2" }, { key: "3" },
    { key: "enter", cls: "np-enter" },
    { key: "0" }, { key: "00" }, { key: "." }
];

const peso = (n) => `₱${Number(n || 0).toFixed(2)}`;
const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const DISCOUNT_TYPES = [
    { value: "none", label: "No discount", rate: 0, description: "Regular order total" },
    { value: "senior_citizen", label: "Senior Citizen", rate: 20, description: "20% discount" },
    { value: "pwd", label: "PWD", rate: 20, description: "20% discount" },
    { value: "custom", label: "Other discount", rate: null, description: "Enter a custom percentage" }
];

const discountTypeLabel = (type) => {
    const option = DISCOUNT_TYPES.find((item) => item.value === type);
    return option?.label || "Discount";
};

const getDiscountRate = (type, customRate) => {
    if (type === "senior_citizen" || type === "pwd") return 20;
    if (type === "custom") {
        const parsed = Number(customRate);
        return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0;
    }
    return 0;
};

// Shows the product photo, or a coloured initial tile if there's no
// image or the URL fails to load.
function ProductImage({ product }) {
    const [failed, setFailed] = useState(false);

    if (product.image && !failed) {
        return (
            <img
                className="product-img"
                src={product.image}
                alt={product.name}
                loading="lazy"
                onError={() => setFailed(true)}
            />
        );
    }

    return (
        <div className="product-fallback">
            {product.name.charAt(0).toUpperCase()}
        </div>
    );
}

function POS() {
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]); // Cart lines include lineId, product details, quantity, and notes.
    const [amountPaid, setAmountPaid] = useState("");

    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");

    const [showConfirmation, setShowConfirmation] = useState(false);
    const [showDiscountModal, setShowDiscountModal] = useState(false);
    const [discountType, setDiscountType] = useState("none");
    const [customDiscountRate, setCustomDiscountRate] = useState("10");
    const [pendingDiscountType, setPendingDiscountType] = useState("none");
    const [pendingCustomDiscountRate, setPendingCustomDiscountRate] = useState("10");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [openNoteId, setOpenNoteId] = useState(null);

    // What the keypad is typing into: the payment, or one cart line's quantity.
    const [target, setTarget] = useState("paid"); // "paid" | cart item _id
    // true = the next digit replaces the current value (like a calculator)
    const [fresh, setFresh] = useState(true);
    // phones: the order panel is a bottom sheet
    const [cartOpen, setCartOpen] = useState(false);

    useEffect(() => {
        fetch(`${API_URL}/api/products`)
            .then((r) => {
                if (!r.ok) throw new Error("Failed to load products");
                return r.json();
            })
            .then(setProducts)
            .catch(console.error);
    }, []);

    /* ---------- cart ---------- */

    const addToCart = (product) => {
        setCart((prev) => {
            // Merge into the normal, uncustomized line. If the existing line has
            // special instructions, create a separate line so a second serving
            // can have different instructions (for example, regular + less spicy).
            const existing = prev.find(
                (i) => i._id === product._id && !(i.notes || "").trim()
            );

            if (existing) {
                return prev.map((i) =>
                    i.lineId === existing.lineId
                        ? { ...i, quantity: Math.min(MAX_QTY, i.quantity + 1) }
                        : i
                );
            }

            return [
                ...prev,
                {
                    lineId: `${product._id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    _id: product._id,
                    name: product.name,
                    price: Number(product.price),
                    quantity: 1,
                    notes: ""
                }
            ];
        });
    };

    const changeQuantity = (lineId, delta) => {
        setCart((prev) =>
            prev
                .map((i) =>
                    i.lineId === lineId
                        ? {
                              ...i,
                              quantity: Math.min(MAX_QTY, i.quantity + delta)
                          }
                        : i
                )
                .filter((i) => i.quantity > 0)
        );
    };

    const setQuantity = (lineId, quantity) =>
        setCart((prev) =>
            prev.map((i) => (i.lineId === lineId ? { ...i, quantity } : i))
        );

    const updateItemNote = (lineId, notes) =>
        setCart((prev) =>
            prev.map((i) => (i.lineId === lineId ? { ...i, notes } : i))
        );

    const clearCart = () => {
        setCart([]);
        setOpenNoteId(null);
        setAmountPaid("");
        setTarget("paid");
        setFresh(true);
        setDiscountType("none");
        setCustomDiscountRate("10");
        setShowDiscountModal(false);
    };

    const subtotal = roundMoney(
        cart.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0)
    );
    const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);
    const discountRate = getDiscountRate(discountType, customDiscountRate);
    const discountAmount = Math.min(
        subtotal,
        roundMoney((subtotal * discountRate) / 100)
    );
    const total = roundMoney(Math.max(0, subtotal - discountAmount));
    const paid = amountPaid === "" ? 0 : Number(amountPaid);
    const change = paid >= total ? roundMoney(paid - total) : 0;

    const pendingDiscountRate = getDiscountRate(
        pendingDiscountType,
        pendingCustomDiscountRate
    );
    const pendingDiscountAmount = Math.min(
        subtotal,
        roundMoney((subtotal * pendingDiscountRate) / 100)
    );
    const pendingTotal = roundMoney(Math.max(0, subtotal - pendingDiscountAmount));

    const openDiscountSelector = () => {
        setPendingDiscountType(discountType);
        setPendingCustomDiscountRate(customDiscountRate);
        setShowDiscountModal(true);
    };

    const applyDiscount = () => {
        const rate = getDiscountRate(
            pendingDiscountType,
            pendingCustomDiscountRate
        );

        if (pendingDiscountType === "custom" && pendingCustomDiscountRate.trim() === "") {
            alert("Enter a discount percentage from 0 to 100.");
            return;
        }

        if (
            pendingDiscountType === "custom" &&
            (!Number.isFinite(Number(pendingCustomDiscountRate)) ||
                Number(pendingCustomDiscountRate) < 0 ||
                Number(pendingCustomDiscountRate) > 100)
        ) {
            alert("Discount percentage must be between 0 and 100.");
            return;
        }

        if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
            alert("Discount percentage must be between 0 and 100.");
            return;
        }

        setDiscountType(rate === 0 ? "none" : pendingDiscountType);
        if (pendingDiscountType === "custom") {
            setCustomDiscountRate(String(rate));
        }
        setShowDiscountModal(false);
    };

    const quantityInCart = useMemo(() => {
        const map = {};
        cart.forEach((i) => {
            map[i._id] = (map[i._id] || 0) + i.quantity;
        });
        return map;
    }, [cart]);

    /* ---------- keypad ---------- */

    // The cart line being edited, or null when the keypad types the payment.
    const activeLine =
        target === "paid" ? null : cart.find((i) => i.lineId === target) || null;

    const selectLine = (item) => {
        setTarget(item.lineId);
        setFresh(true);
    };

    const selectPayment = () => {
        setTarget("paid");
        setFresh(true);
    };

    const quickCash = (value) => {
        setAmountPaid(value);
        setTarget("paid");
        setFresh(true);
    };

    const pressKey = (key) => {
        /* ----- editing a quantity ----- */
        if (activeLine) {
            const id = activeLine.lineId;
            const digits = String(activeLine.quantity);

            if (key === "enter") return selectPayment();

            if (key === "clear") {
                setQuantity(id, 1);
                setFresh(true);
                return;
            }

            if (key === "back") {
                setQuantity(id, digits.length > 1 ? Number(digits.slice(0, -1)) : 1);
                setFresh(digits.length <= 1);
                return;
            }

            if (/^\d+$/.test(key)) {
                const next = ((fresh ? "" : digits) + key).replace(/^0+/, "");
                if (!next || Number(next) > MAX_QTY) return;
                setQuantity(id, Number(next));
                setFresh(false);
            }
            return; // "." means nothing for a quantity
        }

        /* ----- typing the amount paid ----- */
        if (key === "enter") return openConfirmation();

        if (key === "clear") {
            setAmountPaid("");
            setFresh(false);
            return;
        }

        if (key === "back") {
            setAmountPaid((prev) => prev.slice(0, -1));
            setFresh(false);
            return;
        }

        const base = fresh ? "" : amountPaid;
        let next;

        if (key === ".") {
            next = base.includes(".") ? base : (base || "0") + ".";
        } else {
            next = (base + key).replace(/^0+(?=\d)/, ""); // no leading zeros
        }

        // up to 7 whole digits and 2 decimals
        if (!/^\d{0,7}(\.\d{0,2})?$/.test(next)) return;

        setAmountPaid(next);
        setFresh(false);
    };

    // Physical keyboard (desktop) drives the same keypad.
    const handlePhysicalKey = (e) => {
        if (showConfirmation || e.ctrlKey || e.metaKey || e.altKey) return;

        const tag = e.target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

        let key = null;
        if (/^[0-9]$/.test(e.key) || e.key === ".") key = e.key;
        else if (e.key === "Backspace") key = "back";
        else if (e.key === "Delete" || e.key === "Escape") key = "clear";

        if (!key) return;

        e.preventDefault();
        pressKey(key);
    };

    const keyHandlerRef = useRef(handlePhysicalKey);

    useEffect(() => {
        keyHandlerRef.current = handlePhysicalKey;
    });

    useEffect(() => {
        const onKey = (e) => keyHandlerRef.current(e);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // Stop the page behind the phone order sheet from scrolling.
    useEffect(() => {
        document.body.style.overflow = cartOpen ? "hidden" : "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [cartOpen]);

    /* ---------- checkout ---------- */

    const openConfirmation = () => {
        if (cart.length === 0) return alert("Cart is empty.");
        if (total > 0 && (amountPaid === "" || paid < total)) {
            return alert("Please enter a sufficient payment amount.");
        }
        setShowConfirmation(true);
    };

    const checkout = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            const savedUser = localStorage.getItem("user");
            const user = savedUser ? JSON.parse(savedUser) : null;

            const transaction = {
                transactionNumber: `TRX-${Date.now()}-${Math.floor(
                    Math.random() * 1000
                )}`,
                cashier: user?.username || "Unknown",
                sessionId: user?.sessionId || null,
                items: cart.map((i) => ({
                    name: i.name,
                    price: i.price,
                    quantity: i.quantity,
                    notes: (i.notes || "").trim()
                })),
                subtotal,
                discountType,
                discountRate,
                discountAmount,
                total,
                amountPaid: paid,
                change,
                paymentMethod: "Cash"
            };

            const response = await fetch(`${API_URL}/api/transactions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(transaction)
            });

            if (!response.ok) throw new Error("Checkout failed");

            alert("Transaction completed!");
            setShowConfirmation(false);
            clearCart();
            setCartOpen(false);
        } catch (error) {
            console.error(error);
            alert("Failed to complete transaction. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    /* ---------- filtering ---------- */

    const filteredProducts = products
        .filter((p) => {
            const matchesSearch = p.name
                .toLowerCase()
                .includes(search.toLowerCase());
            const matchesCategory =
                selectedCategory === "All" || p.category === selectedCategory;
            return matchesSearch && matchesCategory;
        })
        .sort((a, b) => {
            const ca = CATEGORIES.indexOf(a.category);
            const cb = CATEGORIES.indexOf(b.category);
            return ca !== cb ? ca - cb : a.name.localeCompare(b.name);
        });

    return (
        <div className={cartOpen ? "pos-page cart-open" : "pos-page"}>
            {/* dims the catalog behind the order sheet on phones */}
            <div
                className="cart-backdrop"
                onClick={() => setCartOpen(false)}
            />

            {/* ============ LEFT: ORDER ============ */}
            <section className="cart-panel">
                <header className="cart-header">
                    <div>
                        <h2>Current Order</h2>
                        <span className="cart-sub">
                            {itemCount} item{itemCount === 1 ? "" : "s"}
                        </span>
                    </div>
                    <div className="cart-header-actions">
                        <button
                            className="btn-ghost"
                            onClick={clearCart}
                            disabled={cart.length === 0}
                        >
                            Clear
                        </button>
                        <button
                            className="cart-close"
                            onClick={() => setCartOpen(false)}
                            aria-label="Close order"
                        >
                            ✕
                        </button>
                    </div>
                </header>

                <div className="cart-table-head">
                    <span>Item</span>
                    <span>Qty</span>
                    <span>Total</span>
                </div>

                <div className="cart-items">
                    {cart.length === 0 ? (
                        <p className="cart-empty">
                            Tap a product to add it to the order.
                        </p>
                    ) : (
                        cart.map((item) => (
                            <div className="cart-line" key={item.lineId}>
                                <div
                                    className={
                                        activeLine?.lineId === item.lineId
                                            ? "cart-row active"
                                            : "cart-row"
                                    }
                                >
                                    <div className="cart-row-name">
                                        <strong>{item.name}</strong>
                                        <span>{peso(item.price)}</span>
                                    </div>

                                    <div className="qty-control">
                                        <button
                                            className="qty-step"
                                            onClick={() =>
                                                changeQuantity(item.lineId, -1)
                                            }
                                            aria-label={`Decrease ${item.name}`}
                                        >
                                            −
                                        </button>
                                        <button
                                            className="qty-value"
                                            onClick={() => selectLine(item)}
                                            aria-label={`Edit quantity of ${item.name}`}
                                        >
                                            {item.quantity}
                                        </button>
                                        <button
                                            className="qty-step"
                                            onClick={() =>
                                                changeQuantity(item.lineId, 1)
                                            }
                                            aria-label={`Increase ${item.name}`}
                                        >
                                            +
                                        </button>
                                    </div>

                                    <strong className="cart-row-total">
                                        {peso(item.price * item.quantity)}
                                    </strong>
                                </div>

                                <div className="cart-note-section">
                                    {item.notes.trim() && openNoteId !== item.lineId ? (
                                        <p className="cart-note-preview">
                                            <strong>Note:</strong> {item.notes}
                                        </p>
                                    ) : null}

                                    <button
                                        type="button"
                                        className="cart-note-toggle"
                                        onClick={() =>
                                            setOpenNoteId((current) =>
                                                current === item.lineId ? null : item.lineId
                                            )
                                        }
                                    >
                                        {openNoteId === item.lineId
                                            ? "Close special instructions"
                                            : item.notes.trim()
                                                ? "Edit special instructions"
                                                : "+ Add special instructions"}
                                    </button>

                                    {openNoteId === item.lineId && (
                                        <div className="cart-note-editor">
                                            <label htmlFor={`note-${item.lineId}`}>
                                                Special instructions
                                                {item.quantity > 1
                                                    ? ` (applies to all ${item.quantity} in this line)`
                                                    : ""}
                                            </label>
                                            <textarea
                                                id={`note-${item.lineId}`}
                                                rows="2"
                                                maxLength={300}
                                                value={item.notes}
                                                placeholder="e.g. Less spicy, less garlic..."
                                                onChange={(e) =>
                                                    updateItemNote(item.lineId, e.target.value)
                                                }
                                            />
                                            <div className="cart-note-editor-footer">
                                                <span>{item.notes.length}/300</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setOpenNoteId(null)}
                                                >
                                                    Done
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <footer className="cart-footer">
                    <div className="summary-line">
                        <span>Subtotal</span>
                        <span>{peso(subtotal)}</span>
                    </div>

                    {discountAmount > 0 && (
                        <div className="summary-line discount-summary-line">
                            <span>
                                {discountTypeLabel(discountType)} ({discountRate}%)
                            </span>
                            <strong>−{peso(discountAmount)}</strong>
                        </div>
                    )}

                    <div className="summary-line total-line">
                        <span>Total due</span>
                        <span>{peso(total)}</span>
                    </div>

                    <button
                        type="button"
                        className={discountAmount > 0 ? "discount-trigger applied" : "discount-trigger"}
                        onClick={openDiscountSelector}
                        disabled={cart.length === 0 || isSubmitting}
                    >
                        <span>{discountAmount > 0 ? "Change discount" : "＋ Apply discount"}</span>
                        <strong>
                            {discountAmount > 0
                                ? `${discountTypeLabel(discountType)} · ${discountRate}%`
                                : "Senior, PWD, custom"}
                        </strong>
                    </button>

                    <div className="quick-cash">
                        <button
                            onClick={() => quickCash(total.toFixed(2))}
                            disabled={total === 0}
                        >
                            Exact
                        </button>
                        {QUICK_CASH.map((amt) => (
                            <button
                                key={amt}
                                onClick={() => quickCash(String(amt))}
                            >
                                ₱{amt}
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        className={
                            "payment-display" +
                            (activeLine ? "" : " active") +
                            (amountPaid === "" ? " empty" : "")
                        }
                        onClick={selectPayment}
                    >
                        <span className="pd-label">Amount paid</span>
                        <span className="pd-value">
                            ₱{amountPaid === "" ? "0.00" : amountPaid}
                        </span>
                    </button>

                    {activeLine && (
                        <div className="numpad-hint">
                            Editing quantity: <strong>{activeLine.name}</strong>
                        </div>
                    )}

                    <div className="numpad" role="group" aria-label="Number pad">
                        {NUMPAD_KEYS.map((k) => (
                            <button
                                key={k.key}
                                type="button"
                                className={k.cls || ""}
                                onClick={() => pressKey(k.key)}
                                disabled={Boolean(activeLine) && k.key === "."}
                                aria-label={k.name || k.key}
                            >
                                {k.key === "enter"
                                    ? activeLine
                                        ? "Done"
                                        : "Charge"
                                    : k.label || k.key}
                            </button>
                        ))}
                    </div>

                    <div className="summary-line">
                        <span>Change</span>
                        <span>{peso(change)}</span>
                    </div>

                    <button
                        className="pay-button"
                        onClick={openConfirmation}
                        disabled={cart.length === 0 || isSubmitting}
                    >
                        Charge {peso(total)}
                    </button>
                </footer>
            </section>

            {/* ============ RIGHT: CATALOG ============ */}
            <section className="catalog-panel">
                <div className="catalog-toolbar">
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search products..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="category-tabs">
                    {CATEGORIES.map((cat) => (
                        <button
                            key={cat}
                            className={
                                cat === selectedCategory
                                    ? "category-tab active"
                                    : "category-tab"
                            }
                            onClick={() => setSelectedCategory(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {filteredProducts.length === 0 ? (
                    <p className="no-products">No products found.</p>
                ) : (
                    <div className="product-grid">
                        {filteredProducts.map((product) => (
                            <button
                                className="product-card"
                                key={product._id}
                                onClick={() => addToCart(product)}
                            >
                                <div className="product-media">
                                    <ProductImage product={product} />
                                    {quantityInCart[product._id] > 0 && (
                                        <span className="in-cart-badge">
                                            {quantityInCart[product._id]}
                                        </span>
                                    )}
                                </div>
                                <div className="product-body">
                                    <span className="product-name">
                                        {product.name}
                                    </span>
                                    <span className="product-price">
                                        {peso(product.price)}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </section>

            {/* ============ PHONE: BOTTOM ORDER BAR ============ */}
            <div className="mobile-bar">
                <button
                    className="mobile-bar-btn"
                    onClick={() => setCartOpen(true)}
                >
                    <span>
                        {itemCount} item{itemCount === 1 ? "" : "s"}
                    </span>
                    <strong>{peso(total)}</strong>
                    <span>View order ›</span>
                </button>
            </div>

            {/* ============ DISCOUNT SELECTOR ============ */}
            {showDiscountModal && (
                <div
                    className="confirmation-overlay discount-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowDiscountModal(false);
                    }}
                >
                    <div
                        className="confirmation-modal discount-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="discount-title"
                    >
                        <h2 id="discount-title">Apply Discount</h2>
                        <p className="discount-intro">
                            Choose one discount for this order. Discounts cannot be stacked.
                        </p>

                        <div className="discount-options" role="radiogroup" aria-label="Discount type">
                            {DISCOUNT_TYPES.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={pendingDiscountType === option.value}
                                    className={pendingDiscountType === option.value ? "discount-option selected" : "discount-option"}
                                    onClick={() => setPendingDiscountType(option.value)}
                                >
                                    <span className="discount-option-copy">
                                        <strong>{option.label}</strong>
                                        <small>{option.description}</small>
                                    </span>
                                    <span className="discount-radio" aria-hidden="true">
                                        {pendingDiscountType === option.value ? "●" : "○"}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {pendingDiscountType === "custom" && (
                            <label className="custom-discount-field">
                                Custom discount percentage
                                <div className="custom-discount-input-wrap">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.5"
                                        value={pendingCustomDiscountRate}
                                        onChange={(e) => setPendingCustomDiscountRate(e.target.value)}
                                        placeholder="Enter 0–100"
                                    />
                                    <span>%</span>
                                </div>
                            </label>
                        )}

                        <div className="discount-preview">
                            <div><span>Subtotal</span><span>{peso(subtotal)}</span></div>
                            <div><span>Discount</span><strong>−{peso(pendingDiscountAmount)}</strong></div>
                            <div className="discount-preview-total"><strong>New total</strong><strong>{peso(pendingTotal)}</strong></div>
                        </div>

                        <p className="discount-policy-note">
                            Senior Citizen and PWD are set to 20%. Verify eligibility and required documentation. This version applies the selected percentage directly to the subtotal; VAT-specific statutory calculations are not configured.
                        </p>

                        <div className="confirmation-actions">
                            <button
                                type="button"
                                className="cancel-button"
                                onClick={() => setShowDiscountModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="confirm-button"
                                onClick={applyDiscount}
                            >
                                Apply discount
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============ CONFIRM MODAL ============ */}
            {showConfirmation && (
                <div
                    className="confirmation-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !isSubmitting) {
                            setShowConfirmation(false);
                        }
                    }}
                >
                    <div
                        className="confirmation-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="confirmation-title"
                    >
                        <h2 id="confirmation-title">Confirm Checkout</h2>

                        <div className="confirmation-items">
                            {cart.map((i) => (
                                <div className="confirmation-item" key={i.lineId}>
                                    <div>
                                        <strong>{i.name}</strong>
                                        <span>
                                            {peso(i.price)} × {i.quantity}
                                        </span>
                                        {i.notes?.trim() && (
                                            <p className="confirmation-item-note">
                                                <strong>Special instructions:</strong> {i.notes}
                                            </p>
                                        )}
                                    </div>
                                    <strong>{peso(i.price * i.quantity)}</strong>
                                </div>
                            ))}
                        </div>

                        <div className="confirmation-summary">
                            <div>
                                <span>Subtotal</span>
                                <span>{peso(subtotal)}</span>
                            </div>
                            {discountAmount > 0 && (
                                <div className="confirmation-discount-row">
                                    <span>
                                        {discountTypeLabel(discountType)} discount ({discountRate}%)
                                    </span>
                                    <strong>−{peso(discountAmount)}</strong>
                                </div>
                            )}
                            <div className="confirmation-total">
                                <strong>Total due</strong>
                                <strong>{peso(total)}</strong>
                            </div>
                            <div>
                                <span>Amount paid</span>
                                <span>{peso(paid)}</span>
                            </div>
                            <div>
                                <span>Change</span>
                                <span>{peso(change)}</span>
                            </div>
                        </div>

                        <div className="confirmation-actions">
                            <button
                                className="cancel-button"
                                onClick={() => setShowConfirmation(false)}
                                disabled={isSubmitting}
                            >
                                Back
                            </button>
                            <button
                                className="confirm-button"
                                onClick={checkout}
                                disabled={isSubmitting}
                            >
                                {isSubmitting
                                    ? "Processing..."
                                    : "Confirm Transaction"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default POS;