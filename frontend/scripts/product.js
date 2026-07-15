// frontend/scripts/product.js

(() => {
    console.log("Product page loaded successfully!");

    // ============================================
    // PRODUCT PAGE ELEMENTS
    // ============================================
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
        buyNowBtn: document.getElementById("buy-now-btn"),
        shareBtn: document.getElementById("share-product-btn"), // 🔥 NEW
        shareDropdown: document.getElementById("share-dropdown"), // 🔥 NEW
        shareToast: document.getElementById("share-toast") // 🔥 NEW
    };

    // ============================================
    // PRODUCT STATE
    // ============================================
    let currentProductData = null;

    window.currentProductData = null;
    

    // loading state

    let isLoading = false;

    // ============================================
    // URL PARAMS
    // ============================================
    const urlParams = new URLSearchParams(window.location.search);
    const productId = parseInt(urlParams.get("id"), 10);

    if (Number.isNaN(productId) || productId <= 0) {
        window.location.href = "shop.html";
        throw new Error("Invalid product ID");
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    function escapeHTML(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function safeQty(value) {
        return Math.max(1, parseInt(value, 10) || 1);
    }

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

    function showLoadingState() {
        document.body.classList.add("loading");
    }

    function hideLoadingState() {
        document.body.classList.remove("loading");
    }

    function getCachedProduct() {
        return AppUtils.getJSON(`product-${productId}`, null);
    }

    function cacheProduct(product) {
        AppUtils.setJSON(`product-${productId}`, product);
    }

    // ============================================
    // BREADCRUMB
    // ============================================
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

    // ============================================
    // RECENTLY VIEWED
    // ============================================
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

    // ============================================
    // 🔥 SHARE FUNCTIONALITY
    // ============================================
    function initShareButton(product) {
        if (!productElements.shareBtn) return;

        const shareBtn = productElements.shareBtn;
        const shareDropdown = productElements.shareDropdown;
        const shareToast = productElements.shareToast;

        // Store product reference
        window.currentProduct = product;

        // Toggle dropdown
        shareBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (shareDropdown) {
                const isVisible = shareDropdown.style.display === 'block';
                shareDropdown.style.display = isVisible ? 'none' : 'block';
            }
        });

        // Close dropdown on outside click
        document.addEventListener('click', function(e) {
            if (shareDropdown && 
                !e.target.closest('#share-dropdown') && 
                !e.target.closest('#share-product-btn')) {
                shareDropdown.style.display = 'none';
            }
        });

        // Share options
        document.querySelectorAll('.share-option').forEach(function(option) {
            option.addEventListener('click', function(e) {
                e.stopPropagation();
                const method = this.dataset.method;
                if (shareDropdown) {
                    shareDropdown.style.display = 'none';
                }
                handleShare(method, product);
            });
        });

        // Also close dropdown on Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && shareDropdown && shareDropdown.style.display === 'block') {
                shareDropdown.style.display = 'none';
            }
        });
    }

    function handleShare(method, product) {
        if (!product) {
            showShareToast('Product data not available', 'error');
            return;
        }

        const productUrl = `${window.location.origin}/product.html?id=${product.id}`;
        const productName = product.name || 'Product';
        const productPrice = product.price ? `₹${parseFloat(product.price).toFixed(2)}` : '';
        const shareText = `${productName} ${productPrice ? `- ${productPrice}` : ''}\n${productUrl}`;

        if (method === 'whatsapp') {
            const encodedMessage = encodeURIComponent(shareText);
            const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
            window.open(whatsappUrl, '_blank');
            showShareToast('✅ Opening WhatsApp...', 'success');
            
            // Record share interaction
            recordShareInteraction(product.id, 'whatsapp');
            
        } else if (method === 'clipboard') {
            copyToClipboard(productUrl, product);
            
        } else if (method === 'native') {
            if (navigator.share) {
                navigator.share({
                    title: `Check out ${productName}`,
                    text: `I found this amazing product: ${productName}${productPrice ? ` for ${productPrice}` : ''}`,
                    url: productUrl
                }).then(() => {
                    showShareToast('✅ Shared successfully!', 'success');
                    recordShareInteraction(product.id, 'native');
                }).catch((err) => {
                    if (err.name !== 'AbortError') {
                        console.error('Share error:', err);
                    }
                });
            } else {
                // Fallback: copy link
                copyToClipboard(productUrl, product);
            }
        }
    }

    function copyToClipboard(text, product) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                showShareToast('✅ Link copied to clipboard!', 'success');
                recordShareInteraction(product?.id, 'clipboard');
            }).catch(() => {
                fallbackCopy(text, product);
            });
        } else {
            fallbackCopy(text, product);
        }
    }

    function fallbackCopy(text, product) {
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showShareToast('✅ Link copied to clipboard!', 'success');
            recordShareInteraction(product?.id, 'clipboard');
        } catch (error) {
            console.error('Copy failed:', error);
            showShareToast('❌ Failed to copy link', 'error');
        }
    }

    function showShareToast(message, type = 'info') {
        const toast = productElements.shareToast;
        if (!toast) return;

        toast.textContent = message;
        toast.className = `share-toast ${type}`;
        toast.style.display = 'block';

        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }

    async function recordShareInteraction(productId, method) {
        try {
            const token = localStorage.getItem('jwt');
            if (!token) return;

            await fetch('/api/interactions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    productId: productId,
                    type: 'share',
                    method: method
                })
            });
        } catch (error) {
            // Silently fail - don't block user experience
            console.debug('Share interaction recording failed:', error);
        }
    }

    // ============================================
    // PRIMARY ORCHESTRATOR
    // ============================================
    function initializeProductPage(product) {
        if (!product) return;

        updateBreadcrumb(product);

        // Out of stock behavior
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

        // 🔥 Initialize Share Button
        initShareButton(product);

        // Clamp quantity controls
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

    // ============================================
    // FETCH PRODUCT
    // ============================================
    async function fetchProduct() {
        if (isLoading) return;

        isLoading = true;
        showLoadingState();

        try {
            const response = await AppUtils.apiRequest(`/products/${productId}`);

            if (response && response.success && response.product) {
                currentProductData = response.product;

                saveRecentlyViewed(currentProductData);

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

    // ============================================
    // CART ACTIONS
    // ============================================
    function addProductToCart(product, redirect = false) {
        if (!product) return;

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

    function setupCartActions(product) {
        // Handled by product-actions.js
    }

    // ============================================
    // RENDER PRODUCT
    // ============================================
    function renderProduct(product) {
        if (!product) return;

        // Image
        if (productElements.mainImage) {
            productElements.mainImage.src = escapeHTML(product.image || "/assets/images/f1.jpg");
            productElements.mainImage.alt = escapeHTML(product.name || "Product");
            productElements.mainImage.onerror = () => {
                productElements.mainImage.src = "/assets/images/f1.jpg";
            };
        }

        // Category
        if (productElements.productCategory) {
            productElements.productCategory.innerText = product.category || "Fashion";
        }

        // Name
        if (productElements.productName) {
            productElements.productName.innerText = product.name || "Product Name";
        }

        // Price
        if (productElements.productPrice) {
            productElements.productPrice.innerText = AppUtils.formatPrice(product.price || 0);
        }

        // Original Price
        if (productElements.productOriginalPrice) {
            const productPrice = parseFloat(product.price || 0);
            const originalPrice = productPrice + 1000;
            productElements.productOriginalPrice.innerText = AppUtils.formatPrice(originalPrice);
        }

        // Discount
        if (productElements.productDiscount) {
            productElements.productDiscount.innerText = `${product.discount_percent || 50}% OFF`;
        }

        // Brand
        if (productElements.productBrand) {
            productElements.productBrand.innerText = product.brand || "Fashion";
        }

        // Description
        if (productElements.productDescription) {
            productElements.productDescription.innerText = product.description || "Premium fashion product.";
        }

        // Stock
        if (productElements.productStock) {
            productElements.productStock.innerText = Number(product.stock) > 0 ? "In Stock" : "Out Of Stock";
        }

        // Page Title
        document.title = `${product.name} | AnthropicBots E-Commerce`;
    }

    // ============================================
    // IMAGE ZOOM
    // ============================================
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

    // ============================================
    // PRODUCT GALLERY
    // ============================================
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

    // ============================================
    // QUANTITY CONTROLS
    // ============================================
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

    // ============================================
    // KEYBOARD ACCESSIBILITY
    // ============================================
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

    // ============================================
    // BACK TO TOP
    // ============================================
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

    // ============================================
    // EXPOSE GLOBALLY
    // ============================================
    window.getCurrentProduct = () => currentProductData;
    window.handleShare = handleShare;
    window.initShareButton = initShareButton;

    // ============================================
    // MASTER EXECUTION
    // ============================================
    document.addEventListener("DOMContentLoaded", () => {
        fetchProduct();
        initBackToTop();

        if (typeof updateCartCount === "function") {
            updateCartCount();
        }

        // 🔥 Ensure share dropdown closes on scroll
        window.addEventListener('scroll', () => {
            if (productElements.shareDropdown) {
                productElements.shareDropdown.style.display = 'none';
            }
        });
    });

})();