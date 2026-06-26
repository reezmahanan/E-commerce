(() => {
const elements = {
    cartContainer:
        document.getElementById("cart-items"),
    subtotalElement:
        document.getElementById("subtotal"),
    taxElement:
        document.getElementById("tax"),
    totalElement:
        document.getElementById("total"),
    shippingElement:
        document.getElementById("shipping"),
    discountElement:
        document.getElementById("discount"),
    checkoutBtn:
        document.getElementById("checkout-btn"),
    emptyCartBtn:
        document.getElementById("empty-cart-btn"),
    couponForm:
        document.getElementById("coupon-form"),
    couponCode:
        document.getElementById("coupon-code"),
    couponMessage:
        document.getElementById("coupon-message")
};

let appliedCoupon =
    AppUtils.getJSON(
        "appliedCoupon",
        ""
    );
let cart = AppUtils.getCart();

function setCouponMessage(message = "", type = "") {
    if (!elements.couponMessage) return;

    elements.couponMessage.textContent = message;
    elements.couponMessage.className = `coupon-message ${type}`.trim();
}

function syncSharedCartUI() {
    if (typeof updateCartCount === "function") {
        updateCartCount();
    }

    if (typeof renderCartDrawer === "function") {
        renderCartDrawer();
    }
}

function saveAndRender(nextCart) {
    cart = AppUtils.saveCart(nextCart);
    renderCart();
    syncSharedCartUI();
}

function updateCartTotals() {
    const totals =
        AppUtils.calculateCartTotals(
            cart,
            appliedCoupon
        );

    AppUtils.setJSON(
        "shippingCost",
        totals.shipping
    );

    AppUtils.setJSON(
        "cartTotals",
        totals
    );

    if (elements.subtotalElement) {
        elements.subtotalElement.innerText =
            AppUtils.formatPrice(
                totals.subtotal
            );
    }

    if (elements.taxElement) {
        elements.taxElement.innerText =
            AppUtils.formatPrice(
                totals.tax
            );
    }

    if (elements.shippingElement) {
        elements.shippingElement.innerText =
            totals.shipping === 0
                ? "Free"
                : AppUtils.formatPrice(
                    totals.shipping
                );
    }

    if (elements.discountElement) {
        elements.discountElement.innerText =
            totals.discount > 0
                ? `-${AppUtils.formatPrice(totals.discount)}`
                : "-₹0.00";
    }

    if (elements.totalElement) {
        elements.totalElement.innerText =
            AppUtils.formatPrice(
                totals.total
            );
    }
}

function renderEmptyCart() {
    if (!elements.cartContainer) return;

    elements.cartContainer.innerHTML =
        `
            <div class="empty-cart">
                <i class="fas fa-shopping-cart" aria-hidden="true"></i>
                <h2>Your cart is empty</h2>
                <p>Add products to continue shopping.</p>
                <a href="shop.html" class="continue-shopping-btn">Continue Shopping</a>
            </div>
        `;

    if (elements.checkoutBtn) {
        elements.checkoutBtn.disabled = true;
    }

    if (elements.emptyCartBtn) {
        elements.emptyCartBtn.disabled = true;
    }

    updateCartTotals();
}

function renderCart() {
    if (!elements.cartContainer) return;

    cart = AppUtils.getCart();

    if (!cart.length) {
        renderEmptyCart();
        return;
    }

    if (elements.checkoutBtn) {
        elements.checkoutBtn.disabled = false;
    }

    if (elements.emptyCartBtn) {
        elements.emptyCartBtn.disabled = false;
    }

    const fragment =
        document.createDocumentFragment();

    cart.forEach(
        (
            item,
            index
        ) => {

            const qty =
                Math.max(
                    1,
                    AppUtils.safeInteger(
                        item.qty,
                        1
                    )
                );

            const price =
                AppUtils.safeNumber(
                    item.price,
                    0
                );

            const cartItem =
                document.createElement("div");

            cartItem.classList.add("cart-item");

            cartItem.innerHTML =
                `
                    <img
                        src="${AppUtils.escapeHTML(AppUtils.defaultImage(item.img || item.image))}"
                        alt="${AppUtils.escapeHTML(item.name || "Product")}"
                        loading="lazy"
                    >

                    <div class="cart-item-info">
                        <h3>${AppUtils.escapeHTML(item.name || "Product")}</h3>
                        <p>Price: ${AppUtils.formatPrice(price)}</p>
                        ${item.color ? `<p>Color: ${AppUtils.escapeHTML(item.color)}</p>` : ""}
                        ${item.size ? `<p>Size: ${AppUtils.escapeHTML(item.size)}</p>` : ""}

                        <div class="cart-qty-controls" aria-label="Quantity controls">
                            <button
                                type="button"
                                data-index="${index}"
                                class="decrease-qty"
                                aria-label="Decrease quantity"
                                ${qty <= 1 ? "disabled" : ""}
                            >
                                -
                            </button>

                            <span aria-live="polite">${qty}</span>

                            <button
                                type="button"
                                data-index="${index}"
                                class="increase-qty"
                                aria-label="Increase quantity"
                            >
                                +
                            </button>
                        </div>
                    </div>

                    <div class="cart-item-actions">
                        <strong>${AppUtils.formatPrice(price * qty)}</strong>

                        <button
                            type="button"
                            class="move-wishlist-btn"
                            data-index="${index}"
                        >
                            Move to Wishlist
                        </button>

                        <button
                            type="button"
                            class="remove-btn"
                            data-index="${index}"
                        >
                            Remove
                        </button>
                    </div>
                `;

            fragment.appendChild(
                cartItem
            );
        }
    );

    elements.cartContainer.replaceChildren(
        fragment
    );

    updateCartTotals();
}

document.addEventListener(
    "click",
    (event) => {

        const increaseBtn =
            event.target.closest(".increase-qty");

        const decreaseBtn =
            event.target.closest(".decrease-qty");

        const removeBtn =
            event.target.closest(".remove-btn");

        const wishlistBtn =
            event.target.closest(".move-wishlist-btn");

        if (increaseBtn) {
            const index =
                Number(
                    increaseBtn.dataset.index
                );

            if (!cart[index]) return;

            cart[index].qty =
                Math.max(
                    1,
                    AppUtils.safeInteger(
                        cart[index].qty,
                        1
                    )
                ) + 1;

            saveAndRender(cart);
            return;
        }

        if (decreaseBtn) {
            const index =
                Number(
                    decreaseBtn.dataset.index
                );

            if (!cart[index]) return;

            cart[index].qty =
                Math.max(
                    1,
                    AppUtils.safeInteger(
                        cart[index].qty,
                        1
                    ) - 1
                );

            saveAndRender(cart);
            return;
        }

        if (removeBtn) {
            const index =
                Number(
                    removeBtn.dataset.index
                );

            if (!cart[index]) return;

            cart.splice(
                index,
                1
            );

            saveAndRender(cart);
            AppUtils.notify(
                "Item removed from cart",
                "success"
            );
            return;
        }

        if (wishlistBtn) {
            const index =
                Number(
                    wishlistBtn.dataset.index
                );

            if (!cart[index]) return;

            const wishlist =
                AppUtils.getWishlist();

            const exists =
                wishlist.some(
                    (item) =>
                        String(item.id) ===
                        String(cart[index].id)
                        &&
                        item.color === cart[index].color
                        &&
                        item.size === cart[index].size
                );

            if (!exists) {
                wishlist.push(
                    cart[index]
                );
                AppUtils.saveWishlist(
                    wishlist
                );
            }

            cart.splice(
                index,
                1
            );

            saveAndRender(cart);
            AppUtils.notify(
                "Moved to wishlist",
                "success"
            );
        }
    }
);

if (elements.couponForm) {
    elements.couponForm.addEventListener(
        "submit",
        (event) => {
            event.preventDefault();

            const code =
                elements.couponCode
                    ? elements.couponCode.value
                    : "";

            const result =
                AppUtils.validateCoupon(
                    code
                );

            if (!result.valid) {
                appliedCoupon = "";
                setCouponMessage(
                    result.message,
                    "error"
                );
                updateCartTotals();
                return;
            }

            if (appliedCoupon === result.code) {
                setCouponMessage(
                    `${result.code} is already applied.`,
                    "success"
                );
                return;
            }

            appliedCoupon =
                result.code;

            if (elements.couponCode) {
                elements.couponCode.value =
                    result.code;
            }

            setCouponMessage(
                result.message,
                "success"
            );
            updateCartTotals();
        }
    );
}

if (elements.emptyCartBtn) {
    elements.emptyCartBtn.addEventListener(
        "click",
        () => {
            if (!cart.length) return;

            appliedCoupon = "";

            if (elements.couponCode) {
                elements.couponCode.value = "";
            }

            setCouponMessage();
            saveAndRender([]);
            AppUtils.notify(
                "Cart emptied",
                "info"
            );
        }
    );
}

if (elements.checkoutBtn) {
    elements.checkoutBtn.addEventListener(
        "click",
        () => {
            if (!cart.length) {
                AppUtils.notify(
                    "Your cart is empty.",
                    "warning"
                );
                return;
            }

            AppUtils.setJSON(
                "appliedCoupon",
                appliedCoupon
            );

            window.location.href =
                "checkout.html";
        }
    );
}

window.addEventListener(
    AppUtils.CART_UPDATED_EVENT,
    () => {
        cart =
            AppUtils.getCart();
        renderCart();
    }
);

document.addEventListener(
    "DOMContentLoaded",
    () => {
        if (
            appliedCoupon
            &&
            elements.couponCode
        ) {
            elements.couponCode.value =
                appliedCoupon;
        }

        renderCart();
        syncSharedCartUI();
    }
);
})();
