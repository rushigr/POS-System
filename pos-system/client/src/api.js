// const API_URL = "http://localhost:5000/api";

// export async function getProducts() {
//     const response = await fetch(`${API_URL}/products`);

//     if (!response.ok) {
//         throw new Error("Failed to fetch products");
//     }

//     return response.json();
// }
const API_URL = import.meta.env.VITE_API_URL;

export default API_URL;