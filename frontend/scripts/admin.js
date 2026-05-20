console.log("Admin panel loaded successfully!");

// =============================
// BACKEND API CONFIG
// =============================

// Helper function for backend requests with JWT
const apiRequest = async (url, method = "GET", body = null) => {
    const token = localStorage.getItem("token");
    const options = {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    return await res.json();
};

// =============================
// ELEMENTS
// =============================

const productForm = document.getElementById("product-form");
const productTableBody = document.getElementById("product-table-body");
const ordersTableBody = document.getElementById("orders-table-body");

// =============================
// FETCH INITIAL DATA
// =============================

let products = [];
let orders = [];

const loadInitialData = async () => {
    try {
        const productsRes = await apiRequest("/api/products");
        if (productsRes.success) products = productsRes.products;

        const ordersRes = await apiRequest("/api/orders");
        if (ordersRes.success) orders = ordersRes.orders;

        renderProducts();
        renderOrders();
        renderStats();
    } catch (error) {
        console.error("Failed to load initial data", error);
    }
};

// =============================
// RENDER STATS
// =============================

function renderStats() {
    document.getElementById("total-orders").innerText = orders.length;
    document.getElementById("total-products").innerText = products.length;
    document.getElementById("total-users").innerText =
        localStorage.getItem("visits") || 0;

    let revenue = 0;
    orders.forEach((order) => {
        order.products.forEach((item) => {
            const price = parseInt(item.price);
            revenue += price * item.quantity;
        });
    });
    document.getElementById("total-revenue").innerText = `₹${revenue}`;
}

// =============================
// ADD PRODUCT
// =============================

if (productForm) {
    productForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const productData = {
            name: document.getElementById("product-name").value,
            category: document.getElementById("product-category").value,
            price: parseInt(document.getElementById("product-price").value),
            description: document.getElementById("product-description").value,
            image: document.getElementById("product-image").value,
            stock: parseInt(document.getElementById("product-stock").value),
            featured: document.getElementById("featured-product").checked,
        };

        try {
            const res = await apiRequest("/api/products", "POST", productData);
            if (res.success) {
                alert("Product added successfully!");
                products.push(res.product); // assume backend returns created product
                renderProducts();
                renderStats();
                productForm.reset();
            } else {
                alert(res.message);
            }
        } catch (error) {
            console.error(error);
            alert("Failed to add product.");
        }
    });
}

// =============================
// RENDER PRODUCTS
// =============================

function renderProducts() {
    if (!productTableBody) return;
    productTableBody.innerHTML = "";

    products.forEach((product) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${product.name}</td>
            <td>${product.category}</td>
            <td>₹${product.price}</td>
            <td>${product.stock}</td>
            <td>${product.featured ? "Featured" : "—"}</td>
            <td>
                <button class="action-btn" onclick="editProduct(${product.id})">Edit</button>
                <button class="action-btn delete-btn" onclick="deleteProduct(${product.id})">Delete</button>
            </td>
        `;
        productTableBody.appendChild(row);
    });
}

// =============================
// DELETE PRODUCT
// =============================

async function deleteProduct(id) {
    try {
        const res = await apiRequest(`/api/products/${id}`, "DELETE");
        if (res.success) {
            products = products.filter((p) => p.id !== id);
            renderProducts();
            renderStats();
        } else {
            alert(res.message);
        }
    } catch (error) {
        console.error(error);
        alert("Failed to delete product.");
    }
}

// =============================
// EDIT PRODUCT
// =============================

async function editProduct(id) {
    const product = products.find((p) => p.id === id);
    if (!product) return;

    const newName = prompt("Edit Product Name", product.name);
    const newPrice = prompt("Edit Product Price", product.price);
    const newStock = prompt("Edit Product Stock", product.stock);

    if (newName && newPrice && newStock) {
        const updatedData = {
            name: newName,
            price: parseInt(newPrice),
            stock: parseInt(newStock),
        };

        try {
            const res = await apiRequest(`/api/products/${id}`, "PUT", updatedData);
            if (res.success) {
                Object.assign(product, updatedData);
                renderProducts();
                renderStats();
                alert("Product updated successfully!");
            } else {
                alert(res.message);
            }
        } catch (error) {
            console.error(error);
            alert("Failed to update product.");
        }
    }
}

// =============================
// RENDER ORDERS
// =============================

function renderOrders() {
    if (!ordersTableBody) return;
    ordersTableBody.innerHTML = "";
    orders.forEach((order) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${order.id}</td>
            <td>${order.date}</td>
            <td>${order.products.length}</td>
        `;
        ordersTableBody.appendChild(row);
    });
}

// =============================
// INITIALIZE
// =============================

loadInitialData();