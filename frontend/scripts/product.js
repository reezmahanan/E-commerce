(() => {

console.log(
    "Product page loaded successfully!"
);

// product page elements
const productElements = {

    mainImage:
        document.getElementById(
            "main-product-image"
        ),

    qtyInput:
        document.getElementById(
            "product-qty"
        ),

    productCategory:
        document.getElementById(
            "product-category"
        ),

    productName:
        document.getElementById(
            "product-name"
        ),

    productPrice:
        document.getElementById(
            "product-price"
        ),

    productOriginalPrice:
        document.getElementById(
            "product-original-price"
        ),

    productDiscount:
        document.getElementById(
            "product-discount"
        ),

    productBrand:
        document.getElementById(
            "product-brand"
        ),

    productDescription:
        document.getElementById(
            "product-description"
        ),

    productStock:
        document.getElementById(
            "product-stock"
        ),

    variantStock:
        document.getElementById(
            "variant-stock"
        ),

    wishlistBtn:
        document.getElementById(
            "wishlist-btn"
        ),

    reviewForm:
        document.getElementById(
            "review-form"
        ),

    plusBtn:
        document.getElementById(
            "plus-btn"
        ),

    minusBtn:
        document.getElementById(
            "minus-btn"
        ),

    addToCartBtn:
        document.getElementById(
            "add-to-cart-btn"
        ),

    buyNowBtn:
        document.getElementById(
            "buy-now-btn"
        )
};

// product state
let currentProductData =
    null;

// loading state
let isLoading =
    false;

// product id
const urlParams =
    new URLSearchParams(
        window.location.search
    );

const productId =
    parseInt(
        urlParams.get("id"),
        10
    );

// invalid product id
if (
    Number.isNaN(
        productId
    )
    ||
    productId <= 0
) {

    window.location.href =
        "shop.html";

    throw new Error(
        "Invalid product ID"
    );
}

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

// safe quantity
function safeQty(
    value
) {

    return Math.max(
        1,
        parseInt(
            value,
            10
        ) || 1
    );
}

// fallback product
function getFallbackProduct() {

    return {

        id: 1,

        brand:
            "AnthropicBots",

        name:
            "Nike Hoodie",

        category:
            "Fashion",

        price: 2999,

        image:
            "/assets/images/f1.jpg",

        description:
            "Premium cotton hoodie with modern fashion styling and comfortable fit.",

        stock: 12,

        rating: 4.5,

        discount_percent: 10
    };
}

// loading state
function showLoadingState() {

    document.body.classList.add(
        "loading"
    );
}

function hideLoadingState() {

    document.body.classList.remove(
        "loading"
    );
}

// cache helpers
function getCachedProduct() {

    return AppUtils.getJSON(
        `product-${productId}`,
        null
    );
}

function cacheProduct(
    product
) {

    AppUtils.setJSON(
        `product-${productId}`,
        product
    );
}

// ========================================
// Breadcrumb Navigation (Issue #344)
// ========================================
function updateBreadcrumb(product) {
    const categoryEl = document.getElementById('breadcrumb-category');
    const categoryLink = document.getElementById('breadcrumb-category-link');
    const productNameEl = document.getElementById('breadcrumb-product-name');

    if (!product || !productNameEl) return;

    // Update product name
    productNameEl.textContent = product.name || 'Product';

    // Update category if available
    if (product.category) {
        categoryEl.style.display = 'inline-block';
        categoryLink.textContent = product.category.charAt(0).toUpperCase() + product.category.slice(1);
        categoryLink.href = `shop.html?category=${encodeURIComponent(product.category)}`;
    } else {
        categoryEl.style.display = 'none';
    }
}

// ========================================
// Wishlist Status & Toggle (Issue #777)
// ========================================
async function updateWishlistIcon(productId) {
    const wishlistBtn = document.getElementById('wishlist-btn');
    if (!wishlistBtn) return;

    const token = localStorage.getItem('token');
    const icon = wishlistBtn.querySelector('i');

    if (!token) {
        icon.classList.remove('fas');
        icon.classList.add('far');
        wishlistBtn.dataset.inWishlist = 'false';
        return;
    }

    try {
        // Check local wishlist cache first
        const wishlist = AppUtils.getWishlist() || [];
        const localExists = wishlist.some(item => item.id === productId);

        if (localExists) {
            icon.classList.remove('far');
            icon.classList.add('fas');
            wishlistBtn.dataset.inWishlist = 'true';
            return;
        }

        // Fallback to API
        const response = await AppUtils.apiRequest(`/wishlist/status/${productId}`);
        if (response.success && response.inWishlist) {
            icon.classList.remove('far');
            icon.classList.add('fas');
            wishlistBtn.dataset.inWishlist = 'true';
        } else {
            icon.classList.remove('fas');
            icon.classList.add('far');
            wishlistBtn.dataset.inWishlist = 'false';
        }
    } catch (error) {
        console.error('Wishlist status error:', error);
        icon.classList.remove('fas');
        icon.classList.add('far');
        wishlistBtn.dataset.inWishlist = 'false';
    }
}

async function toggleWishlist(productId) {
    const wishlistBtn = document.getElementById('wishlist-btn');
    if (!wishlistBtn) return;

    const icon = wishlistBtn.querySelector('i');
    const isInWishlist = wishlistBtn.dataset.inWishlist === 'true';

    try {
        const endpoint = isInWishlist ? '/wishlist/remove' : '/wishlist/add';
        const response = await AppUtils.apiRequest(endpoint, {
            method: 'POST',
            body: JSON.stringify({ productId })
        });

        if (response.success) {
            let wishlist = AppUtils.getWishlist() || [];

            if (response.action === 'added' || (!isInWishlist && response.success)) {
                AppUtils.notify('Added to wishlist ❤️', 'success');
                icon.classList.remove('far');
                icon.classList.add('fas');
                wishlistBtn.dataset.inWishlist = 'true';
                // Update local cache
                const product = currentProductData || { id: productId };
                wishlist.push(product);
                AppUtils.saveWishlist(wishlist);
            } else {
                AppUtils.notify('Removed from wishlist 💔', 'info');
                icon.classList.remove('fas');
                icon.classList.add('far');
                wishlistBtn.dataset.inWishlist = 'false';
                // Update local cache
                wishlist = wishlist.filter(item => item.id !== productId);
                AppUtils.saveWishlist(wishlist);
            }
        } else {
            AppUtils.notify(response.message || 'Failed to update wishlist', 'error');
        }
    } catch (error) {
        console.error('Wishlist toggle error:', error);
        AppUtils.notify('Failed to update wishlist', 'error');
    }
}

// fetch product
async function fetchProduct() {

    if (
        isLoading
    ) {

        return;
    }

    isLoading =
        true;

    showLoadingState();

    try {

        const response =
            await AppUtils.apiRequest(
                `/products/${productId}`
            );

        if (
            response.success
            &&
            response.product
        ) {

            currentProductData =
                response.product;

            cacheProduct(
                response.product
            );

        } else {

            currentProductData =
                getCachedProduct()
                ||
                getFallbackProduct();
        }

    } catch (error) {

        console.error(
            "PRODUCT FETCH ERROR:",
            error
        );

        currentProductData =
            getCachedProduct()
            ||
            getFallbackProduct();

    } finally {

        initializeProductPage();

        hideLoadingState();

        isLoading =
            false;
    }
}

// initialize page
function initializeProductPage() {

    const product =
        currentProductData;

    if (
        !product
    ) {

        return;
    }

    // Update breadcrumb
    updateBreadcrumb(product);

    // out of stock
    if (
        Number(
            product.stock
        ) <= 0
    ) {

        if (
            productElements.addToCartBtn
        ) {

            productElements.addToCartBtn.disabled =
                true;

            productElements.addToCartBtn.innerText =
                "Out of Stock";
        }

        if (
            productElements.buyNowBtn
        ) {

            productElements.buyNowBtn.disabled =
                true;
        }
    }

    renderProduct(
        product
    );

    // ========== WISHLIST ICON STATUS ==========
    updateWishlistIcon(product.id);

    // Attach wishlist button event listener
    if (productElements.wishlistBtn) {
        productElements.wishlistBtn.addEventListener('click', function(e) {
            e.preventDefault();
            toggleWishlist(product.id);
        });
    }

    if (
        typeof setupVariants ===
        "function"
    ) {

        setupVariants(
            product
        );
    }
    setCurrentProduct(
        product
    );

    setupCartActions(
        product
    );

    if (
        typeof loadProductReviews ===
        "function"
    ) {

        loadProductReviews(
            product.id
        );
    }

    if (
        typeof loadRelatedProducts ===
        "function"
    ) {

        loadRelatedProducts(
            product
        );
    }

    if (
        typeof loadRecentlyViewedRecommendations ===
        "function"
    ) {

        loadRecentlyViewedRecommendations();
    }

    initializeImageZoom();

    initializeProductGallery(
        product
    );
}

// add to cart
function addProductToCart(
    product,
    redirect = false
) {

    if (
        !product
    ) {

        return;
    }

    if (
        Number(
            product.stock
        ) <= 0
    ) {

        AppUtils.notify(
            "Product is out of stock",
            "error"
        );

        return;
    }

    let cart =
        AppUtils.getCart();

    cart =
        AppUtils.safeArray(
            cart
        );

    const existing =
        cart.find(
            (
                item
            ) => {

                return (
                    Number(
                        item.id
                    ) ===
                    Number(
                        product.id
                    )
                );
            }
        );

    const qty =
        safeQty(
            productElements.qtyInput
                ?.value || 1
        );

    if (
        existing
    ) {

        existing.qty =
            Math.min(
                10,
                safeQty(
                    existing.qty
                ) + qty
            );

    } else {

        cart.push({

            id:
                product.id,

            name:
                product.name,

            price:
                product.price,

            image:
                product.image,

            qty,

            stock:
                product.stock
        });
    }

    AppUtils.saveCart(
        cart
    );

    AppUtils.notify(
        `${product.name} added to cart`,
        "success"
    );

    if (
        typeof updateCartCount ===
        "function"
    ) {

        updateCartCount();
    }

    if (
        redirect
    ) {

        window.location.href =
            "cart.html";
    }
}

// setup cart actions
function setupCartActions(
    product
) {

    if (
        productElements.addToCartBtn
    ) {

        productElements.addToCartBtn.onclick =
            () => {

                addProductToCart(
                    product
                );
            };
    }

    if (
        productElements.buyNowBtn
    ) {

        productElements.buyNowBtn.onclick =
            () => {

                addProductToCart(
                    product,
                    true
                );
            };
    }
}

// render product
function renderProduct(
    product
) {

    if (
        !product
    ) {

        return;
    }

    // image
    if (
        productElements.mainImage
    ) {

        productElements.mainImage.src =
            escapeHTML(
                product.image
                ||
                "/assets/images/f1.jpg"
            );

        productElements.mainImage.alt =
            escapeHTML(
                product.name
                || "Product"
            );

        productElements.mainImage.onerror =
            () => {

                productElements.mainImage.src =
                    "/assets/images/f1.jpg";
            };
    }

    // category
    if (
        productElements.productCategory
    ) {

        productElements.productCategory.innerText =
            product.category
            || "Fashion";
    }

    // name
    if (
        productElements.productName
    ) {

        productElements.productName.innerText =
            product.name
            || "Product Name";
    }

    // price
    if (
        productElements.productPrice
    ) {

        productElements.productPrice.innerText =
            AppUtils.formatPrice(
                product.price || 0
            );
    }

    // original price
    if (
        productElements.productOriginalPrice
    ) {

        const productPrice =
            parseFloat(
                product.price || 0
            );

        const originalPrice =
            productPrice + 1000;

        productElements.productOriginalPrice.innerText =
            AppUtils.formatPrice(
                originalPrice
            );
    }

    // discount
    if (
        productElements.productDiscount
    ) {

        productElements.productDiscount.innerText =
            `${
                product.discount_percent
                || 50
            }% OFF`;
    }

    // brand
    if (
        productElements.productBrand
    ) {

        productElements.productBrand.innerText =
            product.brand
            || "Fashion";
    }

    // description
    if (
        productElements.productDescription
    ) {

        productElements.productDescription.innerText =
            product.description
            || "Premium fashion product.";
    }

    // stock
    if (
        productElements.productStock
    ) {

        productElements.productStock.innerText =
            Number(
                product.stock
            ) > 0
                ? "In Stock"
                : "Out Of Stock";
    }

    // page title
    document.title =
        `${product.name} | AnthropicBots E-Commerce`;
}

// image zoom
function initializeImageZoom() {

    if (
        !productElements.mainImage
    ) {

        return;
    }

    // avoid duplicate listeners
    if (
        productElements.mainImage.dataset.zoomReady
    ) {

        return;
    }

    productElements.mainImage.dataset.zoomReady =
        "true";

    productElements.mainImage.style.transition =
        "0.3s ease";

    productElements.mainImage.addEventListener(
        "mouseenter",
        () => {

            productElements.mainImage.style.transform =
                "scale(1.05)";
        }
    );

    productElements.mainImage.addEventListener(
        "mouseleave",
        () => {

            productElements.mainImage.style.transform =
                "scale(1)";
        }
    );
}

// gallery
function initializeProductGallery(
    product
) {

    const thumbnails =
        document.querySelectorAll(
            ".small-image"
        );

    if (
        !thumbnails.length
    ) {

        return;
    }

    thumbnails.forEach(
        (
            thumb
        ) => {

            thumb.src =
                product.image
                ||
                "/assets/images/f1.jpg";

            thumb.onclick =
                () => {

                    if (
                        productElements.mainImage
                    ) {

                        productElements.mainImage.src =
                            thumb.src;
                    }
                };
        }
    );
}

// quantity controls
if (
    productElements.plusBtn
) {

    productElements.plusBtn.addEventListener(
        "click",
        () => {

            productElements.qtyInput.value =
                Math.min(
                    10,
                    safeQty(
                        productElements.qtyInput.value
                    ) + 1
                );
        }
    );
}

if (
    productElements.minusBtn
) {

    productElements.minusBtn.addEventListener(
        "click",
        () => {

            productElements.qtyInput.value =
                Math.max(
                    1,
                    safeQty(
                        productElements.qtyInput.value
                    ) - 1
                );
        }
    );
}

// keyboard accessibility
document.addEventListener(
    "keydown",
    (
        event
    ) => {

        const activeTag =
            document.activeElement
                ?.tagName;

        if (
            [
                "INPUT",
                "TEXTAREA"
            ].includes(
                activeTag
            )
        ) {

            return;
        }

        if (
            event.key === "+"
            &&
            productElements.plusBtn
        ) {

            productElements.plusBtn.click();
        }

        if (
            event.key === "-"
            &&
            productElements.minusBtn
        ) {

            productElements.minusBtn.click();
        }
    }
);

// init
document.addEventListener(
    "DOMContentLoaded",
    () => {

        fetchProduct();

        if (
            typeof updateCartCount ===
            "function"
        ) {

            updateCartCount();
        }
    }
);

// ========================================
// Back to Top Button (Issue #345)
// ========================================
function initBackToTop() {
    const backToTopBtn = document.getElementById('back-to-top-btn');
    if (!backToTopBtn) return;

    // Show/hide button based on scroll position
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            backToTopBtn.classList.add('show');
            backToTopBtn.style.display = 'flex';
        } else {
            backToTopBtn.classList.remove('show');
            backToTopBtn.style.display = 'none';
        }
    });

    // Smooth scroll to top on click
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// Initialize after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initBackToTop();
});
})();