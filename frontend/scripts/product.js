(() => {
    console.log("Product page loaded successfully!");

    // product page elements
    const productElements = {
        mainImage: document.getElementById("main-product-image"),
        qtyInput: document.getElementById("product-qty"),
        productCategory: document.getElementById("product-category"),
        productName: document.getElementById("product-name"),
        productPrice: document.getElementById("product-price"),
        productOriginalPrice: document.getElementById("product-original-price"),
        productDiscount: document.getElementById("product-discount"),
        productBrand: document.getElementById("product-brand"),
        productDescription: document.getElementById("product-description"),
        productStock: document.getElementById("product-stock"),
        variantStock: document.getElementById("variant-stock"),
        wishlistBtn: document.getElementById("wishlist-btn"),
        reviewForm: document.getElementById("review-form"),
        plusBtn: document.getElementById("plus-btn"),
        minusBtn: document.getElementById("minus-btn"),
        addToCartBtn: document.getElementById("add-to-cart-btn"),
        buyNowBtn: document.getElementById("buy-now-btn")
    };

    // product state
    let currentProductData = null;
    window.currentProductData = null;
    

    // loading state
    let isLoading = false;

    // product id
    const urlParams = new URLSearchParams(window.location.search);
    const productId = parseInt(urlParams.get("id"), 10);

    // invalid product id
    if (Number.isNaN(productId) || productId <= 0) {
        window.location.href = "shop.html";
        throw new Error("Invalid product ID");
    }

    // escape html
    function escapeHTML(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // safe quantity
    function safeQty(value) {
        return Math.max(1, parseInt(value, 10) || 1);
    }

    // fallback product
    function getFallbackProduct() {
        return {
            id: 1,
            brand: "AnthropicBots",
            name: "Nike Hoodie",
            category: "Fashion",
            price: 2999,
            image: "/assets/images/f1.jpg",
            description: "Premium cotton hoodie with modern fashion styling and comfortable fit.",
            stock: 12,
            rating: 4.5,
            discount_percent: 10
        };
    }

    // loading state toggles
    function showLoadingState() {
        document.body.classList.add("loading");
    }

    function hideLoadingState() {
        document.body.classList.remove("loading");
    }

    // cache helpers
    function getCachedProduct() {
        return AppUtils.getJSON(`product-${productId}`, null);
    }

    function cacheProduct(product) {
        AppUtils.setJSON(`product-${productId}`, product);
    }

    // Breadcrumb Navigation
    function updateBreadcrumb(product) {
        const categoryEl = document.getElementById('breadcrumb-category');
        const categoryLink = document.getElementById('breadcrumb-category-link');
        const productNameEl = document.getElementById('breadcrumb-product-name');

        if (!product || !productNameEl) return;

        productNameEl.textContent = product.name || 'Product';

        if (product.category) {
            categoryEl.style.display = 'inline-block';
            categoryLink.textContent = product.category.charAt(0).toUpperCase() + product.category.slice(1);
            categoryLink.href = `shop.html?category=${encodeURIComponent(product.category)}`;
        } else {
            categoryEl.style.display = 'none';
        }
    }

    // Recently viewed history
    function saveRecentlyViewed(product) {
        if (!product) return;

        const recentlyViewed = JSON.parse(localStorage.getItem("recentlyViewed")) || [];
        const filtered = recentlyViewed.filter((item) => Number(item.id) !== Number(product.id));

        filtered.unshift({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image
        });

        localStorage.setItem("recentlyViewed", JSON.stringify(filtered.slice(0, 10)));
    }

    // Primary Orchestrator for setting up page features post-fetch
    function initializeProductPage(product) {
        if (!product) return;

        updateBreadcrumb(product);

        // Out of stock behavior handling
        if (Number(product.stock) <= 0) {
            if (productElements.addToCartBtn) {
                productElements.addToCartBtn.disabled = true;
                productElements.addToCartBtn.innerText = "Out of Stock";
            }
            if (productElements.buyNowBtn) {
                productElements.buyNowBtn.disabled = true;
            }
        }

        renderProduct(product);

        if (typeof setupVariants === "function") {
            setupVariants(product);
        }

        if (typeof setCurrentProduct === "function") {
            setCurrentProduct(product);
        }

        setupCartActions(product);

        // clamp quantity controls
        if (typeof window.syncProductQtyControls === "function") {
            window.syncProductQtyControls();
        }

        if (typeof loadProductReviews === "function") {
            loadProductReviews(product.id);
        }

        if (typeof loadRelatedProducts === "function") {
            loadRelatedProducts(product);
        }

        if (typeof loadRecentlyViewedRecommendations === "function") {
            loadRecentlyViewedRecommendations();
        }

        initializeImageZoom();
        initializeProductGallery(product);
    }

    // fetch product data
    async function fetchProduct() {
        if (isLoading) return;

        isLoading = true;
        showLoadingState();

        try {
            const response = await AppUtils.apiRequest(`/products/${productId}`);

            if (response && response.success && response.product) {
                currentProductData = response.product;
                window.currentProductData = currentProductData;
                if (typeof saveRecentlyViewed === "function") {
                    saveRecentlyViewed(currentProductData);
                }
                cacheProduct(currentProductData);
            } else {
                currentProductData = getCachedProduct() || getFallbackProduct();
                window.currentProductData = currentProductData;
            }
        } catch (error) {
            console.error("PRODUCT FETCH ERROR:", error);
            currentProductData = getCachedProduct() || getFallbackProduct();
            window.currentProductData = currentProductData;
        } finally {
            initializeProductPage(currentProductData);
            hideLoadingState();
            isLoading = false;
        }
    }

    // add to cart logic
    function addProductToCart(product, redirect = false) {
        if (!product) return;

        // cart is account-bound: guests must sign in first
        if (!AppUtils.requireLogin("Please sign in to add items to your cart")) {
            return;
        }

        if (Number(product.stock) <= 0) {
            AppUtils.notify("Product is out of stock", "error");
            return;
        }

        let cart = AppUtils.getCart();
        cart = AppUtils.safeArray(cart);

        const existing = cart.find((item) => Number(item.id) === Number(product.id));
        const qty = safeQty(productElements.qtyInput?.value || 1);

        if (existing) {
            existing.qty = Math.min(10, safeQty(existing.qty) + qty);
        } else {
            cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.image,
                qty,
                stock: product.stock
            });
        }

        AppUtils.saveCart(cart);
        AppUtils.notify(`${product.name} added to cart`, "success");

        if (typeof loadProductReviews === "function") {
            loadProductReviews(productId);
        }

        if (typeof updateCartCount === "function") {
            updateCartCount();
        }

        if (redirect) {
            window.location.href = "cart.html";
        }
    }

    // Intentionally left as a no-op to let product-actions.js handle click bindings natively
    function setupCartActions(product) { }

    // render product interface elements
    function renderProduct(product) {
        if (!product) return;

        // image
        if (productElements.mainImage) {
            productElements.mainImage.src = escapeHTML(product.image || "/assets/images/f1.jpg");
            productElements.mainImage.alt = escapeHTML(product.name || "Product");
            productElements.mainImage.onerror = () => {
                productElements.mainImage.src = "/assets/images/f1.jpg";
            };
        }

        // category
        if (productElements.productCategory) {
            productElements.productCategory.innerText = product.category || "Fashion";
        }

        // name
        if (productElements.productName) {
            productElements.productName.innerText = product.name || "Product Name";
        }

        // price
        if (productElements.productPrice) {
            productElements.productPrice.innerText = AppUtils.formatPrice(product.price || 0);
        }

        // original price
        if (productElements.productOriginalPrice) {
            const productPrice = parseFloat(product.price || 0);
            const originalPrice = productPrice + 1000;
            productElements.productOriginalPrice.innerText = AppUtils.formatPrice(originalPrice);
        }

        // discount
        if (productElements.productDiscount) {
            productElements.productDiscount.innerText = `${product.discount_percent || 50}% OFF`;
        }

        // brand
        if (productElements.productBrand) {
            productElements.productBrand.innerText = product.brand || "Fashion";
        }

        // description
        if (productElements.productDescription) {
            productElements.productDescription.innerText = product.description || "Premium fashion product.";
        }

        // stock
        if (productElements.productStock) {
            productElements.productStock.innerText = Number(product.stock) > 0 ? "In Stock" : "Out Of Stock";
        }

        // page title
        document.title = `${product.name} | AnthropicBots E-Commerce`;
    }

    function initializeImageZoom() {
        const mainImage = productElements.mainImage;
        if (!mainImage) return;

        const container = document.getElementById("zoom-container");
        if (!container) return;

        if (mainImage.dataset.zoomReady) return;
        mainImage.dataset.zoomReady = "true";

        container.addEventListener("mousemove", (e) => {
            const rect = container.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;

            mainImage.style.transformOrigin = `${x}% ${y}%`;
            mainImage.style.transform = "scale(2.5)";
        });

        container.addEventListener("mouseleave", () => {
            mainImage.style.transformOrigin = "center center";
            mainImage.style.transform = "scale(1)";
        });
    }

    function initializeProductGallery(product) {
        const thumbnails = document.querySelectorAll(".small-image");
        if (!thumbnails.length) return;

        thumbnails.forEach((thumb) => {
            thumb.src = product.image || "/assets/images/f1.jpg";
            thumb.onclick = () => {
                if (productElements.mainImage) {
                    productElements.mainImage.src = thumb.src;
                }
            };
        });
    }

    function getStockCap() {
        const raw = productElements.variantStock
            ? parseInt(productElements.variantStock.innerText, 10)
            : NaN;
        return isNaN(raw) ? Infinity : raw;
    }

    function syncQtyControls() {
        if (!productElements.qtyInput) return;

        const cap = getStockCap();
        const qty = Math.max(1, Math.min(cap, safeQty(productElements.qtyInput.value)));

        productElements.qtyInput.value = qty;

        if (productElements.plusBtn) {
            productElements.plusBtn.disabled = qty >= cap;
        }

        if (productElements.minusBtn) {
            productElements.minusBtn.disabled = qty <= 1;
        }
    }

    if (productElements.plusBtn) {
        productElements.plusBtn.addEventListener("click", () => {
            productElements.qtyInput.value = safeQty(productElements.qtyInput.value) + 1;
            syncQtyControls();
        });
    }

    if (productElements.minusBtn) {
        productElements.minusBtn.addEventListener("click", () => {
            productElements.qtyInput.value = safeQty(productElements.qtyInput.value) - 1;
            syncQtyControls();
        });
    }

    window.syncProductQtyControls = syncQtyControls;

    // keyboard accessibility
    document.addEventListener("keydown", (event) => {
        const activeTag = document.activeElement?.tagName;
        if (["INPUT", "TEXTAREA"].includes(activeTag)) return;

        if (event.key === "+" && productElements.plusBtn) {
            productElements.plusBtn.click();
        }

        if (event.key === "-" && productElements.minusBtn) {
            productElements.minusBtn.click();
        }
    });

    // Back to Top Button Implementation
    function initBackToTop() {
        const backToTopBtn = document.getElementById('back-to-top-btn');
        if (!backToTopBtn) return;

        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                backToTopBtn.classList.add('show');
                backToTopBtn.style.display = 'flex';
            } else {
                backToTopBtn.classList.remove('show');
                backToTopBtn.style.display = 'none';
            }
        });

        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Master execution cycle once context is completely loaded
    document.addEventListener("DOMContentLoaded", () => {
        fetchProduct();
        initBackToTop();

        if (typeof updateCartCount === "function") {
            updateCartCount();
        }
    });
})();