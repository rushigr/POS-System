import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Products.css";
import API_URL from "../api";

const CATEGORIES = ["Ramen", "Rice Meal", "Snacks", "Add-Ons"];
const EMPTY_FORM = { name: "", category: "Ramen", price: "", image: "" };

const peso = (n) =>
    `₱${Number(n || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;

// Product photo, or a coloured initial tile when there is no image
// (or the URL fails to load).
function ProductImage({ product }) {
    const [failed, setFailed] = useState(false);

    if (product.image && !failed) {
        return (
            <img
                className="prd-img"
                src={product.image}
                alt={product.name}
                loading="lazy"
                onError={() => setFailed(true)}
            />
        );
    }

    return (
        <div className="prd-fallback">
            {product.name.charAt(0).toUpperCase()}
        </div>
    );
}

function Products() {
    const navigate = useNavigate();

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");

    // add / edit form (modal)
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState(null); // product being edited, or null
    const [form, setForm] = useState(EMPTY_FORM);
    const [formError, setFormError] = useState("");

    // confirmation (modal on top of everything)
    const [confirm, setConfirm] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    /* ---------- auth + loading ---------- */

    // The server's adminOnly middleware reads the x-username header.
    const authHeaders = () => {
        let user = null;
        try {
            user = JSON.parse(localStorage.getItem("user"));
        } catch {
            user = null;
        }

        return {
            "Content-Type": "application/json",
            "x-username": user?.username || ""
        };
    };

    const loadProducts = async () => {
        try {
            const response = await fetch(`${API_URL}/api/products`);

            if (!response.ok) throw new Error("Failed to load products");

            setProducts(await response.json());
            setError("");
        } catch (err) {
            console.error(err);
            setError("Could not load products.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const savedUser = localStorage.getItem("user");

        if (!savedUser) {
            navigate("/");
            return;
        }

        if (JSON.parse(savedUser).role !== "admin") {
            alert("Access denied. Admins only.");
            navigate("/dashboard");
            return;
        }

        loadProducts();
    }, [navigate]);

    useEffect(() => {
        if (!success) return;
        const timer = setTimeout(() => setSuccess(""), 4000);
        return () => clearTimeout(timer);
    }, [success]);

    // Esc closes the top-most modal.
    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== "Escape" || submitting) return;
            if (confirm) setConfirm(null);
            else if (formOpen) setFormOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [confirm, formOpen, submitting]);

    /* ---------- filtering + grouping ---------- */

    const categoryCounts = useMemo(() => {
        const counts = { All: products.length };
        products.forEach((p) => {
            counts[p.category] = (counts[p.category] || 0) + 1;
        });
        return counts;
    }, [products]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();

        return products
            .filter((p) => {
                const matchesSearch = p.name.toLowerCase().includes(term);
                const matchesCategory =
                    selectedCategory === "All" || p.category === selectedCategory;
                return matchesSearch && matchesCategory;
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [products, search, selectedCategory]);

    // Sections in menu order; categories not in the list go last.
    const sections = useMemo(() => {
        const order = [...CATEGORIES];
        filtered.forEach((p) => {
            if (!order.includes(p.category)) order.push(p.category);
        });

        return order
            .map((category) => ({
                category,
                items: filtered.filter((p) => p.category === category)
            }))
            .filter((s) => s.items.length > 0);
    }, [filtered]);

    /* ---------- form handling ---------- */

    const updateForm = (field, value) =>
        setForm((prev) => ({ ...prev, [field]: value }));

    const openAdd = () => {
        setEditing(null);
        setForm(EMPTY_FORM);
        setFormError("");
        setFormOpen(true);
    };

    const openEdit = (product) => {
        setEditing(product);
        setForm({
            name: product.name,
            category: product.category,
            price: String(product.price),
            image: product.image || ""
        });
        setFormError("");
        setFormOpen(true);
    };

    const closeForm = () => {
        if (submitting) return;
        setFormOpen(false);
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        setFormError("");

        const payload = {
            name: form.name.trim(),
            category: form.category,
            price: Number(form.price),
            image: form.image.trim()
        };

        if (!payload.name) return setFormError("Product name is required.");
        if (Number.isNaN(payload.price) || payload.price < 0) {
            return setFormError("Enter a valid price.");
        }

        // Adding does not need confirmation.
        if (!editing) {
            return saveProduct("POST", `${API_URL}/api/products`, payload);
        }

        // Editing: show exactly what will change and ask first.
        const changes = [];

        if (editing.name !== payload.name) {
            changes.push({ label: "Name", from: editing.name, to: payload.name });
        }
        if (editing.category !== payload.category) {
            changes.push({
                label: "Category",
                from: editing.category,
                to: payload.category
            });
        }
        if (Number(editing.price) !== payload.price) {
            changes.push({
                label: "Price",
                from: peso(editing.price),
                to: peso(payload.price)
            });
        }
        if ((editing.image || "") !== payload.image) {
            changes.push({
                label: "Image",
                from: editing.image ? "Current image" : "None",
                to: payload.image ? "New image" : "None"
            });
        }

        if (changes.length === 0) {
            return setFormError("No changes to save.");
        }

        setConfirm({
            type: "update",
            product: editing,
            payload,
            changes
        });
    };

    const askDelete = (product) => {
        setError("");
        setSuccess("");
        setConfirm({ type: "delete", product });
    };

    /* ---------- talking to the server ---------- */

    const saveProduct = async (method, url, payload) => {
        setSubmitting(true);

        try {
            const response = await fetch(url, {
                method,
                headers: authHeaders(),
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.message || "Failed to save product");
            }

            setFormOpen(false);
            setSuccess(
                method === "POST"
                    ? `"${payload.name}" was added.`
                    : `"${payload.name}" was updated.`
            );
            await loadProducts();
        } catch (err) {
            console.error(err);
            setFormError(err.message || "Failed to save product.");
        } finally {
            setSubmitting(false);
            setConfirm(null);
        }
    };

    const runConfirmed = async () => {
        if (!confirm || submitting) return;

        if (confirm.type === "update") {
            await saveProduct(
                "PUT",
                `${API_URL}/api/products/${confirm.product._id}`,
                confirm.payload
            );
            return;
        }

        // delete
        setSubmitting(true);
        setError("");

        try {
            const response = await fetch(
                `${API_URL}/api/products/${confirm.product._id}`,
                { method: "DELETE", headers: authHeaders() }
            );

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.message || "Failed to delete product");
            }

            setSuccess(`"${confirm.product.name}" was deleted.`);
            await loadProducts();
        } catch (err) {
            console.error(err);
            setError(err.message || "Failed to delete product.");
        } finally {
            setSubmitting(false);
            setConfirm(null);
        }
    };

    /* ---------- render ---------- */

    const tabs = ["All", ...CATEGORIES];

    return (
        <div className="prd-page">
            <header className="prd-header">
                <div>
                    <h1>Product Management</h1>
                    <p className="prd-subtitle">
                        Showing {filtered.length} of {products.length} product
                        {products.length === 1 ? "" : "s"}
                    </p>
                </div>

                <button className="prd-add-button" onClick={openAdd}>
                    + Add Product
                </button>
            </header>

            <div className="prd-toolbar">
                <input
                    type="text"
                    className="prd-search"
                    placeholder="Search products..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="prd-tabs">
                {tabs.map((tab) => (
                    <button
                        key={tab}
                        className={
                            tab === selectedCategory
                                ? "prd-tab active"
                                : "prd-tab"
                        }
                        onClick={() => setSelectedCategory(tab)}
                    >
                        {tab}
                        <span className="prd-tab-count">
                            {categoryCounts[tab] || 0}
                        </span>
                    </button>
                ))}
            </div>

            {success && <p className="prd-success">{success}</p>}
            {error && <p className="prd-error">{error}</p>}

            {loading ? (
                <p className="prd-empty">Loading products...</p>
            ) : filtered.length === 0 ? (
                <p className="prd-empty">No products found.</p>
            ) : (
                sections.map((section) => (
                    <section className="prd-section" key={section.category}>
                        {selectedCategory === "All" && (
                            <h2 className="prd-section-title">
                                {section.category}
                                <span>{section.items.length}</span>
                            </h2>
                        )}

                        <div className="prd-grid">
                            {section.items.map((product) => (
                                <article className="prd-card" key={product._id}>
                                    <div className="prd-media">
                                        <ProductImage product={product} />
                                    </div>

                                    <div className="prd-body">
                                        <span className="prd-name">
                                            {product.name}
                                        </span>
                                        <span className="prd-category">
                                            {product.category}
                                        </span>
                                        <span className="prd-price">
                                            {peso(product.price)}
                                        </span>
                                    </div>

                                    <div className="prd-actions">
                                        <button
                                            className="prd-edit"
                                            onClick={() => openEdit(product)}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            className="prd-delete"
                                            onClick={() => askDelete(product)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>
                ))
            )}

            {/* ---------- ADD / EDIT MODAL ---------- */}
            {formOpen && (
                <div
                    className="prd-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeForm();
                    }}
                >
                    <div
                        className="prd-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="prd-form-title"
                    >
                        <h2 id="prd-form-title">
                            {editing ? "Edit Product" : "Add Product"}
                        </h2>

                        <form onSubmit={handleFormSubmit} className="prd-form">
                            <label>
                                Name
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) =>
                                        updateForm("name", e.target.value)
                                    }
                                    placeholder="Product name"
                                    required
                                    autoFocus
                                />
                            </label>

                            <div className="prd-form-row">
                                <label>
                                    Category
                                    <select
                                        value={form.category}
                                        onChange={(e) =>
                                            updateForm("category", e.target.value)
                                        }
                                    >
                                        {CATEGORIES.map((c) => (
                                            <option key={c} value={c}>
                                                {c}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    Price (₱)
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={form.price}
                                        onChange={(e) =>
                                            updateForm("price", e.target.value)
                                        }
                                        placeholder="0.00"
                                        required
                                    />
                                </label>
                            </div>

                            <label>
                                Image URL (optional)
                                <input
                                    type="url"
                                    value={form.image}
                                    onChange={(e) =>
                                        updateForm("image", e.target.value)
                                    }
                                    placeholder="https://..."
                                />
                            </label>

                            <div className="prd-preview">
                                {/* key resets the failed state when the URL changes */}
                                <ProductImage
                                    key={form.image}
                                    product={{
                                        name: form.name || "?",
                                        image: form.image.trim()
                                    }}
                                />
                            </div>

                            {formError && (
                                <p className="prd-form-error">{formError}</p>
                            )}

                            <div className="prd-modal-actions">
                                <button
                                    type="button"
                                    className="prd-secondary"
                                    onClick={closeForm}
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button type="submit" disabled={submitting}>
                                    {submitting
                                        ? "Saving..."
                                        : editing
                                        ? "Review Changes"
                                        : "Add Product"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ---------- CONFIRMATION MODAL ---------- */}
            {confirm && (
                <div
                    className="prd-overlay prd-overlay-top"
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !submitting) {
                            setConfirm(null);
                        }
                    }}
                >
                    <div
                        className="prd-modal prd-confirm"
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="prd-confirm-title"
                    >
                        {confirm.type === "update" ? (
                            <>
                                <h2 id="prd-confirm-title">
                                    Save changes to "{confirm.product.name}"?
                                </h2>

                                <div className="prd-changes">
                                    {confirm.changes.map((c) => (
                                        <div className="prd-change-row" key={c.label}>
                                            <span className="prd-change-label">
                                                {c.label}
                                            </span>
                                            <span>
                                                <span className="prd-change-from">
                                                    {c.from}
                                                </span>
                                                {" → "}
                                                <strong>{c.to}</strong>
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {confirm.changes.some((c) => c.label === "Price") && (
                                    <p className="prd-warning">
                                        The new price applies to all future
                                        sales. Past transactions are not
                                        changed.
                                    </p>
                                )}
                            </>
                        ) : (
                            <>
                                <h2 id="prd-confirm-title">
                                    Delete "{confirm.product.name}"?
                                </h2>

                                <div className="prd-delete-preview">
                                    <div className="prd-delete-thumb">
                                        <ProductImage product={confirm.product} />
                                    </div>
                                    <div>
                                        <strong>{confirm.product.name}</strong>
                                        <br />
                                        <span className="prd-category">
                                            {confirm.product.category} ·{" "}
                                            {peso(confirm.product.price)}
                                        </span>
                                    </div>
                                </div>

                                <p className="prd-warning danger">
                                    This removes the product from the menu and
                                    the POS. It cannot be undone. Past
                                    transactions are not affected.
                                </p>
                            </>
                        )}

                        <div className="prd-modal-actions">
                            <button
                                type="button"
                                className="prd-secondary"
                                onClick={() => setConfirm(null)}
                                disabled={submitting}
                            >
                                Go Back
                            </button>
                            <button
                                type="button"
                                className={
                                    confirm.type === "delete"
                                        ? "prd-danger"
                                        : "prd-confirm-button"
                                }
                                onClick={runConfirmed}
                                disabled={submitting}
                            >
                                {submitting
                                    ? "Working..."
                                    : confirm.type === "delete"
                                    ? "Delete Product"
                                    : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Products;