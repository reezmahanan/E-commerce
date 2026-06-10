// cart drawer elements
const cartDrawer =
    document.getElementById(
        "cart-drawer"
    );

const cartDrawerItems =
    document.getElementById(
        "cart-drawer-items"
    );

const cartDrawerTotal =
    document.getElementById(
        "cart-drawer-total"
    );

const openCartBtn =
    document.getElementById(
        "open-cart-drawer"
    );

const closeCartBtn =
    document.getElementById(
        "close-cart-drawer"
    );

// cart state
let drawerCart =
    AppUtils.getCart();

// safe helpers
function safePrice(
    value
) {
    const parsed =
        parseFloat(value);

    return isNaN(parsed)
        ? 0
        : parsed;
}

function safeQty(
    value
) {
    const parsed =
        parseInt(value);

    return isNaN(parsed)
        ? 1
        : Math.max(
            1,
            parsed
        );
}

// open drawer
function openCartDrawer() {
    if (
        !cartDrawer
    ) {
        return;
    }

    cartDrawer.classList.add(
        "active"
    );

    document.body.style.overflow =
        "hidden";

    renderCartDrawer();
}

// close drawer
function closeCartDrawer() {
    if (
        !cartDrawer
    ) {
        return;
    }

    cartDrawer.classList.remove(
        "active"
    );

    document.body.style.overflow =
        "";
}

// render cart drawer
function renderCartDrawer() {
    if (
        !cartDrawerItems
        ||
        !cartDrawerTotal
    ) {
        return;
    }

    drawerCart =
        AppUtils.getCart();

    if (
        !drawerCart.length
    ) {

        cartDrawerItems.innerHTML =
            `
                <p class="empty-cart">
                    Your cart is empty
                </p>
            `;

        cartDrawerTotal.innerHTML =
            formatPrice(0);
        return;
    }

    cartDrawerItems.innerHTML =
        drawerCart.map(
            (item, index) => {
                const qty =
                    safeQty(
                        item.qty
                    );

                const price =
                    safePrice(
                        item.price
                    );

                return `
                    <div class="drawer-item">
                        <img
                            src="${
                                defaultImage(
                                    item.image
                                )
                            }"
                            alt="${
                                item.name || "Product"
                            }"
                            loading="lazy"
                        >

                        <div class="drawer-item-info">
                            <h4>
                                ${
                                    item.name || "Product"
                                }
                            </h4>

                            <p>
                                ${
                                    formatPrice(
                                        price
                                    )
                                }
                            </p>

                            <small>
                                Qty:
                                ${qty}
                            </small>
                        </div>

                        <button
                            type="button"
                            class="remove-drawer-item"
                            data-index="${
                                index
                            }"
                            aria-label="Remove item"
                        >
                            ✕
                        </button>
                    </div>
                `;
            }
        ).join("");

    const total =
        drawerCart.reduce(
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

    cartDrawerTotal.innerHTML =
        formatPrice(
            total
        );
}

// remove item
function removeDrawerItem(
    index
) {
    if (
        index === undefined || index === null
    ) {
        return;
    }

    const parsedIndex = parseInt(index, 10);

    if (
        isNaN(parsedIndex) || !drawerCart[parsedIndex]
    ) {
        return;
    }

    drawerCart.splice(
        parsedIndex,
        1
    );

    AppUtils.saveCart(
        drawerCart
    );

    renderCartDrawer();

    if (
        typeof updateCartCount ===
        "function"
    ) {
        updateCartCount();
    }

    AppUtils.notify(
        "Item removed from cart",
        "info"
    );
}

// open cart
if (
    openCartBtn
) {
    openCartBtn.addEventListener(
        "click",
        (
            event
        ) => {
            event.preventDefault();
            openCartDrawer();
        }
    );
}

// close cart
if (
    closeCartBtn
) {
    closeCartBtn.addEventListener(
        "click",
        (
            event
        ) => {
            event.preventDefault();
            closeCartDrawer();
        }
    );
}

// escape close
document.addEventListener(
    "keydown",
    (
        event
    ) => {

        if (
            event.key ===
            "Escape"
        ) {
            closeCartDrawer();
        }
    }
);

// outside click close
document.addEventListener(
    "click",
    (
        event
    ) => {
        if (
            cartDrawer
            &&
            cartDrawer.classList.contains(
                "active"
            )
            &&
            event.target === cartDrawer
        ) {
            closeCartDrawer();
        }
    }
);

// drawer delegation
document.addEventListener(
    "click",
    (
        event
    ) => {
        const removeBtn =
            event.target.closest(
                ".remove-drawer-item"
            );

        if (
            removeBtn
        ) {
            event.preventDefault();
            removeDrawerItem(
                removeBtn.dataset.index
            );
        }
    }
);

// expose globally
window.openCartDrawer =
    openCartDrawer;

window.renderCartDrawer =
    renderCartDrawer;