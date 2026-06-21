// CART STATE
const cart =
    AppUtils.getCart();

// require authentication
const currentUser =
    AppUtils.requireAuth();

if (
    !currentUser
) {

    throw new Error(
        "Authentication required"
    );
}

// EMPTY CART REDIRECT
if (
    !AppUtils.safeArray(
        cart
    ).length
) {

    AppUtils.notify(
        "Your cart is empty!",
        "error"
    );

    setTimeout(
        () => {

            window.location.href =
                "cart.html";

        },
        1000
    );

    throw new Error(
        "Empty cart"
    );
}

// CHECKOUT ELEMENTS
const elements = {
    checkoutItems:
        document.getElementById(
            "checkout-items"
        ),

    subtotal:
        document.getElementById(
            "checkout-subtotal"
        ),

    tax:
        document.getElementById(
            "checkout-tax"
        ),

    shipping:
        document.getElementById(
            "checkout-shipping"
        ),

    total:
        document.getElementById(
            "checkout-total"
        ),

    cardDetails:
        document.getElementById(
            "card-details"
        ),

    checkoutForm:
        document.getElementById(
            "checkout-form"
        ),

    paymentMethods:
        document.querySelectorAll(
            'input[name="payment"]'
        ),

    fullName:
        document.getElementById(
            "full-name"
        ),

    email:
        document.getElementById(
            "email"
        ),

    phone:
        document.getElementById(
            "phone"
        ),

    city:
        document.getElementById(
            "city"
        ),

    state:
        document.getElementById(
            "state"
        ),

    zip:
        document.getElementById(
            "zip"
        ),

    address:
        document.getElementById(
            "address"
        ),

    placeOrderBtn:
        document.querySelector(
            '#checkout-form button[type="submit"]'
        ),

    promoInput:
        document.getElementById("promo-code-input"),

    applyPromoBtn:
        document.getElementById("apply-promo-btn"),

    promoMessage:
        document.getElementById("promo-message"),

    discountRow:
        document.getElementById("checkout-discount-row"),

    discountAmount:
        document.getElementById("checkout-discount"),

    promoLabel:
        document.getElementById("applied-promo-label")
};

// PROMO STATE
let appliedPromo = null;
let currentDiscount = 0;

// escape html
function escapeHTML(
    value
) {

    return String(
        value || ""
    )

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );
}

// SAFE HELPERS
function safePrice(
    value
) {

    const parsed =
        parseFloat(
            value
        );

    return isNaN(parsed)
        ? 0
        : parsed;
}

function safeQty(
    value
) {

    const parsed =
        parseInt(
            value,
            10
        );

    return isNaN(parsed)
        ? 1
        : Math.max(
            1,
            parsed
        );
}

// CALCULATE TOTALS
function calculateTotals() {

    const subtotal =
        cart.reduce(
            (
                sum,
                item
            ) => {

                return (
                    sum +
                    (
                        safePrice(
                            item.price
                        ) *
                        safeQty(
                            item.qty
                        )
                    )
                );
            },
            0
        );

    const tax =
        subtotal * 0.18;

    const shipping =
        subtotal > 0
        &&
        subtotal < 999
            ? 49
            : 0;

    const total =
        Math.max(0, subtotal - currentDiscount) +
        tax +
        shipping;

    return {
        subtotal,
        tax,
        shipping,
        discount: currentDiscount,
        total
    };
}

// RENDER CHECKOUT
function renderCheckout() {

    if (
        !elements.checkoutItems
    ) {
        return;
    }

    elements.checkoutItems.innerHTML =
        "";

    const fragment =
        document.createDocumentFragment();

    cart.forEach(
        (
            item
        ) => {

            const qty =
                safeQty(
                    item.qty
                );

            const price =
                safePrice(
                    item.price
                );

            const itemTotal =
                qty * price;

            const div =
                document.createElement(
                    "div"
                );

            div.classList.add(
                "checkout-item"
            );

            div.innerHTML =
                `
                    <div class="checkout-item-info">

                        <span>
                            ${escapeHTML(
                                item.name || "Product"
                            )}
                        </span>

                        <small>
                            Qty: ${qty}
                        </small>

                    </div>

                    <span>
                        ${
                            AppUtils.formatPrice(
                                itemTotal
                            )
                        }
                    </span>
                `;

            fragment.appendChild(
                div
            );
        }
    );

    elements.checkoutItems.appendChild(
        fragment
    );

    const totals =
        calculateTotals();

    if (
        elements.subtotal
    ) {

        elements.subtotal.innerText =
            AppUtils.formatPrice(
                totals.subtotal
            );
    }

    if (
        elements.tax
    ) {

        elements.tax.innerText =
            AppUtils.formatPrice(
                totals.tax
            );
    }

    if (
        elements.shipping
    ) {

        elements.shipping.innerText =
            totals.shipping === 0
                ? "Free"
                : AppUtils.formatPrice(
                    totals.shipping
                );
    }

    if (
        elements.discountRow
    ) {
        if (currentDiscount > 0) {
            elements.discountRow.style.display = "flex";
            elements.discountAmount.innerText = "- " + AppUtils.formatPrice(currentDiscount);
            if (appliedPromo) {
                elements.promoLabel.innerText = appliedPromo.code;
            }
        } else {
            elements.discountRow.style.display = "none";
        }
    }

    if (
        elements.total
    ) {

        elements.total.innerText =
            AppUtils.formatPrice(
                totals.total
            );
    }
}

renderCheckout();

// PROMO LOGIC
if (elements.applyPromoBtn) {
    elements.applyPromoBtn.addEventListener("click", async () => {
        const code = elements.promoInput.value.trim();
        
        if (!code) {
            elements.promoMessage.innerText = "Please enter a promo code";
            elements.promoMessage.style.color = "red";
            return;
        }

        if (appliedPromo && appliedPromo.code === code) {
            return; // Already applied
        }

        // If removing
        if (elements.applyPromoBtn.innerText === "Remove") {
            appliedPromo = null;
            currentDiscount = 0;
            elements.promoInput.value = "";
            elements.promoInput.disabled = false;
            elements.applyPromoBtn.innerText = "Apply";
            elements.applyPromoBtn.style.background = "#088178";
            elements.promoMessage.innerText = "Promo code removed";
            elements.promoMessage.style.color = "#333";
            renderCheckout();
            return;
        }

        elements.applyPromoBtn.innerText = "Validating...";
        elements.applyPromoBtn.disabled = true;

        try {
            const { subtotal } = calculateTotals();
            
            const data = await AppUtils.apiRequest("/promos/validate", {
                method: "POST",
                body: JSON.stringify({ promoCode: code, cartTotal: subtotal })
            });

            if (data.success) {
                appliedPromo = data.promo;
                currentDiscount = data.discount;
                elements.promoMessage.innerText = `Promo applied successfully! You saved ${AppUtils.formatPrice(currentDiscount)}`;
                elements.promoMessage.style.color = "green";
                
                elements.promoInput.disabled = true;
                elements.applyPromoBtn.innerText = "Remove";
                elements.applyPromoBtn.style.background = "#d9534f";
                
                renderCheckout();
            } else {
                elements.promoMessage.innerText = data.message || "Invalid promo code";
                elements.promoMessage.style.color = "red";
            }
        } catch (error) {
            elements.promoMessage.innerText = "Error validating promo code";
            elements.promoMessage.style.color = "red";
        } finally {
            elements.applyPromoBtn.disabled = false;
            if (!appliedPromo) {
                elements.applyPromoBtn.innerText = "Apply";
            }
        }
    });
}

// PAYMENT METHOD TOGGLE
elements.paymentMethods.forEach(
    (
        method
    ) => {

        method.addEventListener(
            "change",
            () => {

                if (
                    !elements.cardDetails
                ) {
                    return;
                }

                elements.cardDetails.style.display =
                    method.value ===
                    "Card"
                        ? "block"
                        : "none";
            }
        );
    }
);

// VALIDATION
function validateCheckoutForm() {

    if (
        !elements.fullName.value.trim()
        ||
        !elements.email.value.trim()
        ||
        !elements.phone.value.trim()
        ||
        !elements.city.value.trim()
        ||
        !elements.state.value.trim()
        ||
        !elements.zip.value.trim()
        ||
        !elements.address.value.trim()
    ) {

        AppUtils.notify(
            "Please fill all required fields.",
            "error"
        );

        return false;
    }

    // email validation
    const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
        !emailRegex.test(
            elements.email.value.trim()
        )
    ) {

        AppUtils.notify(
            "Enter a valid email address.",
            "error"
        );

        return false;
    }

    // phone validation
    const phoneRegex =
        /^[6-9]\d{9}$/;

    if (
        !phoneRegex.test(
            elements.phone.value.trim()
        )
    ) {

        AppUtils.notify(
            "Enter a valid 10-digit phone number.",
            "error"
        );

        return false;
    }

    // zip validation
    const zipRegex =
        /^\d{5,6}$/;

    if (
        !zipRegex.test(
            elements.zip.value.trim()
        )
    ) {

        AppUtils.notify(
            "Enter a valid ZIP / PIN code.",
            "error"
        );

        return false;
    }

    // payment method
    const selectedPayment =
        document.querySelector(
            'input[name="payment"]:checked'
        );

    if (
        !selectedPayment
    ) {

        AppUtils.notify(
            "Select a payment method.",
            "error"
        );

        return false;
    }

    return true;
}

// CREATE ORDER PAYLOAD
function createOrderPayload() {

    const selectedPayment =
        document.querySelector(
            'input[name="payment"]:checked'
        );

    const totals =
        calculateTotals();

    return {

        customer: {

            name:
                elements.fullName.value.trim(),

            email:
                elements.email.value.trim(),

            phone:
                elements.phone.value.trim()
        },

        address: {

            city:
                elements.city.value.trim(),

            state:
                elements.state.value.trim(),

            zip:
                elements.zip.value.trim(),

            fullAddress:
                elements.address.value.trim()
        },

        paymentMethod:
            selectedPayment.value
                .toLowerCase(),

        total:
            totals.total,
            
        promoCode: appliedPromo ? appliedPromo.code : null,

        items:
            AppUtils.safeArray(
                cart
            ).map(
                (
                    item
                ) => ({

                    id:
                        item.id,

                    qty:
                        safeQty(
                            item.qty
                        ),

                    color:
                        item.color || "",

                    size:
                        item.size || ""
                })
            )
    };
}

// PLACE ORDER
let isSubmitting =
    false;

if (
    elements.checkoutForm
) {

    elements.checkoutForm.addEventListener(
        "submit",
        async (
            event
        ) => {

            event.preventDefault();

            if (
                isSubmitting
            ) {
                return;
            }

            if (
                !validateCheckoutForm()
            ) {
                return;
            }

            isSubmitting =
                true;

            // loading button
            if (
                elements.placeOrderBtn
            ) {

                elements.placeOrderBtn.disabled =
                    true;

                elements.placeOrderBtn.innerText =
                    "Processing...";
            }

            const order =
                createOrderPayload();

            try {

                const data =
                    await AppUtils.apiRequest(
                        "/orders",
                        {
                            method: "POST",
                            body:
                                JSON.stringify(
                                    order
                                )
                        }
                    );

                if (
                    data.success
                ) {

                    AppUtils.notify(
                        "Order placed successfully! 🎉",
                        "success"
                    );

                    // clear cart
                    AppUtils.saveCart(
                        []
                    );

                    // update ui
                    if (
                        typeof updateCartCount ===
                        "function"
                    ) {

                        updateCartCount();
                    }

                    if (
                        typeof renderCartDrawer ===
                        "function"
                    ) {

                        renderCartDrawer();
                    }

                    // redirect
                    setTimeout(
                        () => {

                            window.location.href =
                                `success.html?id=${data.orderId}`;

                        },
                        1200
                    );

                } else {

                    AppUtils.notify(
                        data.message ||
                        "Failed to place order.",
                        "error"
                    );
                }

            } catch (
                error
            ) {

                console.error(
                    "ORDER ERROR:",
                    error
                );

                AppUtils.notify(
                    "Failed to place order.",
                    "error"
                );

            } finally {

                isSubmitting =
                    false;

                if (
                    elements.placeOrderBtn
                ) {

                    elements.placeOrderBtn.disabled =
                        false;

                    elements.placeOrderBtn.innerText =
                        "Place Order";
                }
            }
        }
    );
}