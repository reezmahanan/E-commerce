console.log("Dashboard loaded successfully!");

firebase.auth().onAuthStateChanged((user) => {

    if(!user){

        window.location.href = "signin.html";

        return;

    }

    loadUserData(user);

});

function loadUserData(user){

    const userName = document.getElementById("user-name");

    const userEmail = document.getElementById("user-email");

    const settingsName = document.getElementById(
        "settings-name"
    );

    const settingsEmail = document.getElementById(
        "settings-email"
    );

    userName.innerText = user.displayName || "User";

    userEmail.innerText = user.email;

    settingsName.value = user.displayName || "";

    settingsEmail.value = user.email || "";

}

const menuItems = document.querySelectorAll(
    ".dashboard-menu li"
);

const tabs = document.querySelectorAll(
    ".dashboard-tab"
);

menuItems.forEach((item) => {

    item.addEventListener("click", () => {

        menuItems.forEach((menu) => {

            menu.classList.remove("active-tab");

        });

        tabs.forEach((tab) => {

            tab.classList.remove("active");

        });

        item.classList.add("active-tab");

        const target = item.dataset.tab;

        document
            .getElementById(target)
            .classList.add("active");

    });

});


const wishlist = JSON.parse(
    localStorage.getItem("wishlist")
) || [];

const wishlistContainer = document.getElementById(
    "wishlist-items"
);

document.getElementById(
    "wishlist-count"
).innerText = wishlist.length;

if(wishlist.length === 0){

    wishlistContainer.innerHTML =
        "<p>No wishlist items found.</p>";

}else{

    wishlist.forEach((item) => {

        const p = document.createElement("p");

        p.innerText = item;

        wishlistContainer.appendChild(p);

    });

}

const cart = JSON.parse(
    localStorage.getItem("cart")
) || [];

const cartContainer = document.getElementById(
    "saved-cart-items"
);

document.getElementById(
    "cart-count-dashboard"
).innerText = cart.length;

if(cart.length === 0){

    cartContainer.innerHTML =
        "<p>No saved cart items found.</p>";

}else{

    cart.forEach((item) => {

        const p = document.createElement("p");

        p.innerText = `${item.name} (${item.qty})`;

        cartContainer.appendChild(p);

    });

}

const orders = JSON.parse(
    localStorage.getItem("orders")
) || [];

const ordersContainer = document.getElementById(
    "orders-list"
);

document.getElementById(
    "orders-count"
).innerText = orders.length;

if(orders.length === 0){

    ordersContainer.innerHTML =
        "<p>No orders found.</p>";

}else{

    orders.forEach((order) => {

        const p = document.createElement("p");

        p.innerText =
            `${order.id} • ${order.date}`;

        ordersContainer.appendChild(p);

    });

}

const settingsForm = document.getElementById(
    "settings-form"
);

settingsForm.addEventListener("submit", (e) => {

    e.preventDefault();

    alert("Profile updated successfully!");

});

// =============================
// HASH TAB NAVIGATION
// =============================

function openTabFromHash(){

    const hash =
        window.location.hash.replace("#", "");

    if(!hash) return;

    const menuItems =
        document.querySelectorAll(
            ".dashboard-menu li"
        );

    const tabs =
        document.querySelectorAll(
            ".dashboard-tab"
        );

    menuItems.forEach((menu) => {

        menu.classList.remove("active-tab");

    });

    tabs.forEach((tab) => {

        tab.classList.remove("active");

    });

    const targetTab =
        document.getElementById(hash);

    const targetMenu =
        document.querySelector(
            `.dashboard-menu li[data-tab="${hash}"]`
        );

    if(targetTab){

        targetTab.classList.add("active");

    }

    if(targetMenu){

        targetMenu.classList.add(
            "active-tab"
        );

    }

}

window.addEventListener(
    "load",
    openTabFromHash
);