import { useEffect, useMemo, useState } from "react";
import "./POS.css";
import API_URL from "../api";

const CATEGORIES = ["All", "Ramen", "Rice Meal", "Snacks", "Add-Ons"];
const QUICK_CASH = [100, 200, 500, 1000];

const peso = (n) => `₱${Number(n).toFixed(2)}`;

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
    const [cart, setCart] = useState([]); // [{_id, name, price, quantity}]
    const [amountPaid, setAmountPaid] = useState("");

    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");

    const [showConfirmation, setShowConfirmation] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

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
            const existing = prev.find((i) => i._id === product._id);
            if (existing) {
                return prev.map((i) =>
                    i._id === product._id
                        ? { ...i, quantity: i.quantity + 1 }
                        : i
                );
            }
            return [
                ...prev,
                {
                    _id: product._id,
                    name: product.name,
                    price: Number(product.price),
                    quantity: 1
                }
            ];
        });
    };

    const changeQuantity = (id, delta) => {
        setCart((prev) =>
            prev
                .map((i) =>
                    i._id === id ? { ...i, quantity: i.quantity + delta } : i
                )
                .filter((i) => i.quantity > 0)
        );
    };

    const clearCart = () => {
        setCart([]);
        setAmountPaid("");
    };

    const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);
    const paid = Number(amountPaid);
    const change = paid >= total ? paid - total : 0;

    const quantityInCart = useMemo(() => {
        const map = {};
        cart.forEach((i) => (map[i._id] = i.quantity));
        return map;
    }, [cart]);

    /* ---------- checkout ---------- */

    const openConfirmation = () => {
        if (cart.length === 0) return alert("Cart is empty.");
        if (amountPaid === "" || paid < total) {
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
                items: cart.map((i) => ({
                    name: i.name,
                    price: i.price,
                    quantity: i.quantity
                })),
                subtotal: total,
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
        <div className="pos-page">
            {/* ============ LEFT: ORDER ============ */}
            <section className="cart-panel">
                <header className="cart-header">
                    <div>
                        <h2>Current Order</h2>
                        <span className="cart-sub">
                            {itemCount} item{itemCount === 1 ? "" : "s"}
                        </span>
                    </div>
                    <button
                        className="btn-ghost"
                        onClick={clearCart}
                        disabled={cart.length === 0}
                    >
                        Clear
                    </button>
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
                            <div className="cart-row" key={item._id}>
                                <div className="cart-row-name">
                                    <strong>{item.name}</strong>
                                    <span>{peso(item.price)}</span>
                                </div>

                                <div className="qty-control">
                                    <button
                                        onClick={() =>
                                            changeQuantity(item._id, -1)
                                        }
                                        aria-label={`Decrease ${item.name}`}
                                    >
                                        −
                                    </button>
                                    <span>{item.quantity}</span>
                                    <button
                                        onClick={() =>
                                            changeQuantity(item._id, 1)
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
                        ))
                    )}
                </div>

                <footer className="cart-footer">
                    <div className="summary-line total-line">
                        <span>Total</span>
                        <span>{peso(total)}</span>
                    </div>

                    <div className="quick-cash">
                        <button
                            onClick={() => setAmountPaid(total.toFixed(2))}
                            disabled={total === 0}
                        >
                            Exact
                        </button>
                        {QUICK_CASH.map((amt) => (
                            <button
                                key={amt}
                                onClick={() => setAmountPaid(String(amt))}
                            >
                                ₱{amt}
                            </button>
                        ))}
                    </div>

                    <input
                        className="payment-input"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Amount paid"
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(e.target.value)}
                    />

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
                                <div className="confirmation-item" key={i._id}>
                                    <div>
                                        <strong>{i.name}</strong>
                                        <span>
                                            {peso(i.price)} × {i.quantity}
                                        </span>
                                    </div>
                                    <strong>{peso(i.price * i.quantity)}</strong>
                                </div>
                            ))}
                        </div>

                        <div className="confirmation-summary">
                            <div>
                                <span>Amount paid</span>
                                <span>{peso(paid)}</span>
                            </div>
                            <div>
                                <span>Change</span>
                                <span>{peso(change)}</span>
                            </div>
                            <div className="confirmation-total">
                                <strong>Total</strong>
                                <strong>{peso(total)}</strong>
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