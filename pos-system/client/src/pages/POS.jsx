
import { useEffect, useState } from "react";
import "./POS.css";
import API_URL from "../api";

const categories = [
    "All",
    "Ramen",
    "Rice Meal",
    "Snacks",
    "Add-Ons"
];

function POS() {
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [amountPaid, setAmountPaid] = useState("");

    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");

    const [showConfirmation, setShowConfirmation] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetch(`${API_URL}/api/products`)
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Failed to load products");
                }
                return response.json();
            })
            .then((data) => setProducts(data))
            .catch((error) => console.error(error));
    }, []);

    const addToCart = (product) => {
        setCart((previousCart) => [...previousCart, product]);
    };

    const removeFromCart = (indexToRemove) => {
        setCart((previousCart) =>
            previousCart.filter((_, index) => index !== indexToRemove)
        );
    };

    const total = cart.reduce(
        (sum, product) => sum + Number(product.price),
        0
    );

    const paid = Number(amountPaid);

    const change = paid >= total ? paid - total : 0;

    const openConfirmation = () => {
        if (cart.length === 0) {
            alert("Cart is empty.");
            return;
        }

        if (amountPaid.trim() === "" || paid < total) {
            alert("Please enter a sufficient payment amount.");
            return;
        }

        setShowConfirmation(true);
    };

    // Saves the transaction only after confirmation.
    const checkout = async () => {
        if (isSubmitting) return;

        if (cart.length === 0 || paid < total) {
            alert("Please check your cart and payment.");
            setShowConfirmation(false);
            return;
        }

        setIsSubmitting(true);

        try {
            const savedUser = localStorage.getItem("user");
            const user = savedUser ? JSON.parse(savedUser) : null;

            const transaction = {
                transactionNumber: "TRX-" + Date.now(),
                cashier: user?.username || "Unknown",
                items: cart.map((product) => ({
                    name: product.name,
                    price: Number(product.price),
                    quantity: 1
                })),
                subtotal: total,
                total: total,
                amountPaid: paid,
                change: change,
                paymentMethod: "Cash"
            };

            const response = await fetch(
                `${API_URL}/api/transactions`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(transaction)
                }
            );

            if (!response.ok) {
                throw new Error("Checkout failed");
            }

            alert("Transaction completed!");

            setShowConfirmation(false);
            setCart([]);
            setAmountPaid("");
        } catch (error) {
            console.error(error);
            alert("Failed to complete transaction. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredProducts = products
        .filter((product) => {
            const matchesSearch = product.name
                .toLowerCase()
                .includes(search.toLowerCase());

            const matchesCategory =
                selectedCategory === "All" ||
                product.category === selectedCategory;

            return matchesSearch && matchesCategory;
        })
        .sort((a, b) => {
            const categoryOrder = categories.indexOf(a.category);
            const categoryOrderB = categories.indexOf(b.category);

            if (categoryOrder !== categoryOrderB) {
                return categoryOrder - categoryOrderB;
            }

            return a.name.localeCompare(b.name);
        });

    return (
        <div className="pos-page">
            <h1>Point of Sale</h1>

            <div className="pos-layout">
                {/* PRODUCTS */}
                <div className="pos-section">
                    <h2>Products</h2>

                    <div className="product-controls">
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search products..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />

                        <select
                            className="category-select"
                            value={selectedCategory}
                            onChange={(e) =>
                                setSelectedCategory(e.target.value)
                            }
                        >
                            {categories.map((category) => (
                                <option key={category} value={category}>
                                    {category}
                                </option>
                            ))}
                        </select>
                    </div>

                    {filteredProducts.length === 0 ? (
                        <p className="no-products">No products found.</p>
                    ) : (
                        <div className="products-list">
                            {filteredProducts.map((product) => (
                                <div
                                    className="pos-product"
                                    key={product._id}
                                >
                                    <div className="product-info">
                                        <strong>{product.name}</strong>
                                        <span>{product.category}</span>
                                        <span>
                                            ₱{Number(product.price).toFixed(2)}
                                        </span>
                                    </div>

                                    <button onClick={() => addToCart(product)}>
                                        Add
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* CART */}
                <div className="pos-section">
                    <h2>Cart</h2>

                    {cart.length === 0 ? (
                        <p>Your cart is empty.</p>
                    ) : (
                        cart.map((product, index) => (
                            <div className="cart-item" key={index}>
                                <div className="cart-item-info">
                                    <span>{product.name}</span>
                                    <span>
                                        ₱{Number(product.price).toFixed(2)}
                                    </span>
                                </div>

                                <button
                                    className="remove-button"
                                    onClick={() => removeFromCart(index)}
                                >
                                    Remove
                                </button>
                            </div>
                        ))
                    )}

                    <p className="total">
                        Total: ₱{total.toFixed(2)}
                    </p>

                    <input
                        className="payment-input"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Amount paid"
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(e.target.value)}
                    />

                    <p className="change">
                        Change: ₱{change.toFixed(2)}
                    </p>

                    <button
                        className="checkout-button"
                        onClick={openConfirmation}
                        disabled={cart.length === 0 || isSubmitting}
                    >
                        Checkout
                    </button>
                </div>
            </div>

            {/* CHECKOUT CONFIRMATION */}
            {showConfirmation && (
                <div
                    className="confirmation-overlay"
                    onClick={(e) => {
                        if (
                            e.target === e.currentTarget &&
                            !isSubmitting
                        ) {
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
                        <h2 id="confirmation-title">
                            Confirm Checkout
                        </h2>

                        <p className="confirmation-subtitle">
                            Review your order before completing the transaction.
                        </p>

                        <div className="confirmation-items">
                            {cart.map((product, index) => (
                                <div
                                    className="confirmation-item"
                                    key={`${product._id}-${index}`}
                                >
                                    <div className="confirmation-product-info">
                                        <strong>{product.name}</strong>
                                        <span>
                                            ₱{Number(product.price).toFixed(2)} × 1
                                        </span>
                                    </div>

                                    <strong>
                                        ₱{Number(product.price).toFixed(2)}
                                    </strong>
                                </div>
                            ))}
                        </div>

                        <div className="confirmation-summary">
                            <div>
                                <span>Number of items</span>
                                <span>{cart.length}</span>
                            </div>

                            <div>
                                <span>Subtotal</span>
                                <span>₱{total.toFixed(2)}</span>
                            </div>

                            <div>
                                <span>Amount paid</span>
                                <span>₱{paid.toFixed(2)}</span>
                            </div>

                            <div className="confirmation-change">
                                <span>Change</span>
                                <span>₱{change.toFixed(2)}</span>
                            </div>

                            <div className="confirmation-total">
                                <strong>Total Cost</strong>
                                <strong>₱{total.toFixed(2)}</strong>
                            </div>
                        </div>

                        <div className="confirmation-actions">
                            <button
                                type="button"
                                className="cancel-button"
                                onClick={() => setShowConfirmation(false)}
                                disabled={isSubmitting}
                            >
                                Back to Cart
                            </button>

                            <button
                                type="button"
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