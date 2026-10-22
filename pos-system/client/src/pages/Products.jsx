import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Products.css";
import API_URL from "../api";

const categories = [
    "Ramen",
    "Rice Meal",
    "Snacks",
    "Add-Ons"
];

function Products() {
    const navigate = useNavigate();

    const [products, setProducts] = useState([]);

    const [name, setName] = useState("");
    const [category, setCategory] = useState("Ramen");
    const [price, setPrice] = useState("");
    const [image, setImage] = useState("");

    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        const savedUser = localStorage.getItem("user");

        if (!savedUser) {
            navigate("/");
            return;
        }

        const user = JSON.parse(savedUser);

        if (user.role !== "admin") {
            alert("Access denied. Admins only.");
            navigate("/dashboard");
            return;
        }

        loadProducts();
    }, [navigate]);

    // The server's adminOnly middleware reads this header.
    const authHeaders = () => {
        const savedUser = localStorage.getItem("user");
        const user = savedUser ? JSON.parse(savedUser) : null;

        return {
            "Content-Type": "application/json",
            "x-username": user?.username || ""
        };
    };

    const loadProducts = async () => {
        try {
            const response = await fetch(
                `${API_URL}/api/products`
            );

            const data = await response.json();

            setProducts(data);
        } catch (error) {
            console.error(error);
        }
    };

    const saveProduct = async (e) => {
        e.preventDefault();

        try {
            const productData = {
                name,
                category,
                price: Number(price),
                image: image.trim()
            };

            let response;

            if (editingId) {
                // UPDATE
                response = await fetch(
                    `${API_URL}/api/products/${editingId}`,
                    {
                        method: "PUT",
                        headers: authHeaders(),
                        body: JSON.stringify(productData)
                    }
                );
            } else {
                // ADD
                response = await fetch(
                    `${API_URL}/api/products`,
                    {
                        method: "POST",
                        headers: authHeaders(),
                        body: JSON.stringify(productData)
                    }
                );
            }

            if (!response.ok) {
                throw new Error("Failed to save product");
            }

            clearForm();
            loadProducts();

        } catch (error) {
            console.error(error);
            alert("Failed to save product.");
        }
    };

    const editProduct = (product) => {
        setEditingId(product._id);
        setName(product.name);
        setCategory(product.category);
        setPrice(product.price);
        setImage(product.image || "");
    };

    const deleteProduct = async (id) => {
        const confirmDelete = window.confirm(
            "Are you sure you want to delete this product?"
        );

        if (!confirmDelete) {
            return;
        }

        try {
            const response = await fetch(
                `${API_URL}/api/products/${id}`,
                {
                    method: "DELETE",
                    headers: authHeaders()
                }
            );

            if (!response.ok) {
                throw new Error("Failed to delete product");
            }

            loadProducts();

        } catch (error) {
            console.error(error);
            alert("Failed to delete product.");
        }
    };

    const clearForm = () => {
        setEditingId(null);
        setName("");
        setCategory("Ramen");
        setPrice("");
        setImage("");
    };

    return (
        <div className="products-page">

            <h1>Product Management</h1>

            {/* ADD / EDIT FORM */}
            <div className="product-form-container">

                <h2>
                    {editingId
                        ? "Edit Product"
                        : "Add Product"}
                </h2>

                <form
                    className="product-form"
                    onSubmit={saveProduct}
                >
                    <input
                        type="text"
                        placeholder="Product name"
                        value={name}
                        onChange={(e) =>
                            setName(e.target.value)
                        }
                        required
                    />

                    <select
                        value={category}
                        onChange={(e) =>
                            setCategory(e.target.value)
                        }
                        required
                    >
                        {categories.map((item) => (
                            <option
                                key={item}
                                value={item}
                            >
                                {item}
                            </option>
                        ))}
                    </select>

                    <input
                        type="number"
                        placeholder="Price"
                        value={price}
                        onChange={(e) =>
                            setPrice(e.target.value)
                        }
                        min="0"
                        step="0.01"
                        required
                    />

                    <input
                        type="url"
                        placeholder="Image URL (optional)"
                        value={image}
                        onChange={(e) =>
                            setImage(e.target.value)
                        }
                    />

                    <button type="submit">
                        {editingId
                            ? "Update Product"
                            : "Add Product"}
                    </button>

                    {editingId && (
                        <button
                            type="button"
                            className="cancel-button"
                            onClick={clearForm}
                        >
                            Cancel
                        </button>
                    )}
                </form>

            </div>

            {/* PRODUCT LIST */}
            <h2>Product List</h2>

            {products.length === 0 ? (
                <p>No products found.</p>
            ) : (
                <div className="product-list">

                    {products.map((product) => (
                        <div
                            className="product-card"
                            key={product._id}
                        >
                            {product.image && (
                                <img
                                    className="product-thumb"
                                    src={product.image}
                                    alt={product.name}
                                    onError={(e) => {
                                        e.currentTarget.style.display =
                                            "none";
                                    }}
                                />
                            )}

                            <h3>{product.name}</h3>

                            <p>
                                Category:{" "}
                                <strong>
                                    {product.category}
                                </strong>
                            </p>

                            <p>
                                Price: ₱
                                {Number(
                                    product.price
                                ).toFixed(2)}
                            </p>

                            <div className="product-actions">

                                <button
                                    className="edit-button"
                                    onClick={() =>
                                        editProduct(product)
                                    }
                                >
                                    Edit
                                </button>

                                <button
                                    className="delete-button"
                                    onClick={() =>
                                        deleteProduct(
                                            product._id
                                        )
                                    }
                                >
                                    Delete
                                </button>

                            </div>
                        </div>
                    ))}

                </div>
            )}

        </div>
    );
}

export default Products;