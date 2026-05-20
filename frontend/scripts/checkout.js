console.log("Checkout page loaded successfully!");

// =============================
// LOAD CART
// =============================
const API_BASE = "http://localhost:5000/api";
const cart = JSON.parse(localStorage.getItem("cart")) || [];

if(cart.length === 0){
    showToast("Your cart is empty!", "error");
    window.location.href = "cart.html";
}

const checkoutItems = document.getElementById("checkout-items");
const subtotalElement = document.getElementById("checkout-subtotal");
const taxElement = document.getElementById("checkout-tax");
const totalElement = document.getElementById("checkout-total");

// =============================
// RENDER SUMMARY
// =============================
function renderCheckout(){
    checkoutItems.innerHTML = "";
    let subtotal = 0;

    cart.forEach((item) => {
        const price = parseFloat(item.price);
        subtotal += price * item.qty;

        const div = document.createElement("div");
        div.classList.add("checkout-item");
        div.innerHTML = `
            <span>${item.name} (${item.qty})</span>
            <span>₹${price * item.qty}</span>
        `;
        checkoutItems.appendChild(div);
    });

    const tax = subtotal * 0.18;
    const total = subtotal + tax;

    subtotalElement.innerText = `₹${subtotal}`;
    taxElement.innerText = `₹${tax.toFixed(2)}`;
    totalElement.innerText = `₹${total.toFixed(2)}`;
}

renderCheckout();

// =============================
// PAYMENT METHOD TOGGLE
// =============================
const paymentMethods = document.querySelectorAll('input[name="payment"]');
const cardDetails = document.getElementById("card-details");

paymentMethods.forEach((method) => {
    method.addEventListener("change", () => {
        cardDetails.style.display = method.value === "Card" ? "block" : "none";
    });
});

// =============================
// PLACE ORDER
// =============================
const checkoutForm = document.getElementById("checkout-form");

checkoutForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if(cart.length === 0){
        showToast("Your cart is empty!", "error");
        return;
    }

    const order = {
        customer: {
            name: document.getElementById("full-name").value,
            email: document.getElementById("email").value,
            phone: document.getElementById("phone").value
        },
        address: {
            city: document.getElementById("city").value,
            state: document.getElementById("state").value,
            zip: document.getElementById("zip").value,
            fullAddress: document.getElementById("address").value
        },
        paymentMethod: document.querySelector('input[name="payment"]:checked').value,
        items: cart,
        total: parseFloat(totalElement.innerText.replace(/[^\d\.]/g, ""))
    };

    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE}/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify(order)
        });

        const data = await res.json();
        if(data.success){
            showToast("Order placed successfully! 🎉");
            localStorage.removeItem("cart");
            window.location.href = "order.html";
        } else {
            showToast(data.message || "Failed to place order", "error");
        }

    } catch(error){
        console.error(error);
        showToast("Failed to place order", "error");
    }
});