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

    useEffect(() => {
        fetch("${API_URL}/api/products")
            .then((response) => response.json())
            .then((data) => setProducts(data))
            .catch((error) => console.error(error));
    }, []);

    const addToCart = (product) => {
        setCart([...cart, product]);
    };

    const removeFromCart = (indexToRemove) => {
        setCart(
            cart.filter((_, index) => index !== indexToRemove)
        );
    };

    const total = cart.reduce(
        (sum, product) => sum + Number(product.price),
        0
    );

    const change =
        Number(amountPaid) >= total
            ? Number(amountPaid) - total
            : 0;

    const checkout = async () => {
        if (cart.length === 0) {
            alert("Cart is empty.");
            return;
        }

        if (Number(amountPaid) < total) {
            alert("Insufficient payment.");
            return;
        }

        const savedUser = localStorage.getItem("user");
        const user = savedUser ? JSON.parse(savedUser) : null;

        const transaction = {
            transactionNumber: "TRX-" + Date.now(),
            cashier: user?.username || "Unknown",
            items: cart.map((product) => ({
                name: product.name,
                price: product.price,
                quantity: 1
            })),
            subtotal: total, 
            total: total,
            amountPaid: Number(amountPaid),
            change: change,
            paymentMethod: "Cash"
        };

        try {
            const response = await fetch(
                "https://pos-system-9yeh.onrender.com/api/transactions",
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

            setCart([]);
            setAmountPaid("");
        } catch (error) {
            console.error(error);
            alert("Failed to complete transaction.");
        }
    };

    // Filter products by search and category
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
        // Automatically sort by category, then product name
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

                    {/* Search and category filter */}
                    <div className="product-controls">
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search products..."
                            value={search}
                            onChange={(e) =>
                                setSearch(e.target.value)
                            }
                        />

                        <select
                            className="category-select"
                            value={selectedCategory}
                            onChange={(e) =>
                                setSelectedCategory(
                                    e.target.value
                                )
                            }
                        >
                            {categories.map((category) => (
                                <option
                                    key={category}
                                    value={category}
                                >
                                    {category}
                                </option>
                            ))}
                        </select>
                    </div>

                    {filteredProducts.length === 0 ? (
                        <p className="no-products">
                            No products found.
                        </p>
                    ) : (
                        <div className="products-list">
                            {filteredProducts.map((product) => (
                                <div
                                    className="pos-product"
                                    key={product._id}
                                >
                                    <div className="product-info">
                                        <strong>
                                            {product.name}
                                        </strong>

                                        <span>
                                            {product.category}
                                        </span>

                                        <span>
                                            ₱
                                            {Number(
                                                product.price
                                            ).toFixed(2)}
                                        </span>
                                    </div>

                                    <button
                                        onClick={() =>
                                            addToCart(product)
                                        }
                                    >
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
                            <div
                                className="cart-item"
                                key={index}
                            >
                                <div className="cart-item-info">
                                    <span>
                                        {product.name}
                                    </span>

                                    <span>
                                        ₱
                                        {Number(
                                            product.price
                                        ).toFixed(2)}
                                    </span>
                                </div>

                                <button
                                    className="remove-button"
                                    onClick={() =>
                                        removeFromCart(index)
                                    }
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
                        placeholder="Amount paid"
                        value={amountPaid}
                        onChange={(e) =>
                            setAmountPaid(e.target.value)
                        }
                    />

                    <p className="change">
                        Change: ₱{change.toFixed(2)}
                    </p>

                    <button
                        className="checkout-button"
                        onClick={checkout}
                    >
                        Checkout
                    </button>
                </div>
            </div>
        </div>
    );
}

export default POS;