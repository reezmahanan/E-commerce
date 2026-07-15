// frontend/scripts/recentlyViewed.js

// ============================================
// RECENTLY VIEWED CONFIGURATION
// ============================================

const RECENTLY_VIEWED_CONFIG = {
    maxItems: 20,
    displayLimit: 10,
    cacheKey: 'recentlyViewed',
    apiEndpoint: '/api/recently-viewed'
};

// ============================================
// LOAD RECENTLY VIEWED FROM STORAGE
// ============================================

const recentlyViewed = AppUtils.getJSON(RECENTLY_VIEWED_CONFIG.cacheKey) || [];

// ============================================
// ELEMENTS
// ============================================

const elements = {

    recentContainer: AppUtils.$("#recently-viewed-container") || AppUtils.$("#recently-viewed-count"),
    recentCount: AppUtils.$("#recently-viewed-count"),
    recentGrid: AppUtils.$("#recently-viewed-grid"),
    loadingSpinner: AppUtils.$("#recently-viewed-loading"),
    errorContainer: AppUtils.$("#recently-viewed-error"),
    refreshBtn: AppUtils.$("#recently-viewed-refresh")
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get product image with fallback
 */
const getProductImage = (product) => {
    if (product.image) return product.image;
    if (product.imageUrl) return product.imageUrl;
    if (product.images && product.images.length > 0) return product.images[0];
    return '/assets/images/placeholder.png';
};

/**
 * Format price
 */
const formatPrice = (price) => {
    const num = parseFloat(price) || 0;
    return `₹${num.toFixed(2)}`;
};

/**
 * Truncate text
 */
const truncateText = (text, maxLength = 30) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

/**
 * Format relative time
 */
const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
    return date.toLocaleDateString();
};

/**
 * Escape HTML
 */
const escapeHTML = (text) => {
    if (!text) return '';
    return text.replace(/[&<>"]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '"') return '&quot;';
        return m;
    });
};

// ============================================
// RENDER FUNCTIONS
// ============================================

/**
 * Render empty state
 */
const renderEmptyState = (container, message = 'No recently viewed products yet.') => {
    if (!container) return;
    
    container.innerHTML = `
        <div class="empty-state-card recent-empty">
            <div class="empty-icon">👁️</div>
            <h3>No Recently Viewed Products</h3>
            <p>${escapeHTML(message)}</p>
            <p class="empty-subtext">Browse products and they will appear here!</p>
            <a href="/shop.html" class="empty-state-btn">
                🛍️ Start Shopping
            </a>
        </div>
    `;
};

/**
 * Render loading state
 */
const renderLoading = (container) => {
    if (!container) return;
    
    container.innerHTML = `
        <div class="loading-grid">
            ${Array(4).fill(0).map(() => `
                <div class="product-card skeleton">
                    <div class="skeleton-image"></div>
                    <div class="skeleton-title"></div>
                    <div class="skeleton-price"></div>
                </div>
            `).join('')}
        </div>
    `;
};

/**
 * Render error state
 */
const renderError = (container, message = 'Failed to load recently viewed products.') => {
    if (!container) return;
    
    container.innerHTML = `
        <div class="error-state-card">
            <div class="error-icon">⚠️</div>
            <h3>Unable to Load</h3>
            <p>${escapeHTML(message)}</p>
            <button onclick="refreshRecentlyViewed()" class="retry-btn">
                🔄 Retry
            </button>
        </div>
    `;
};

/**
 * Render product cards
 */
const renderProducts = (container, products, limit = RECENTLY_VIEWED_CONFIG.displayLimit) => {
    if (!container) return;
    
    const displayProducts = products.slice(0, limit);
    
    if (displayProducts.length === 0) {
        renderEmptyState(container);
        return;
    }
    
    const productHTML = displayProducts.map(product => {
        const image = getProductImage(product);
        const name = escapeHTML(product.name || 'Product');
        const price = formatPrice(product.price);
        const viewedTime = formatTimeAgo(product.viewedAt || product.timestamp);
        const productId = product.id || product.product_id;
        
        return `
            <div class="product-card recent-item" data-product-id="${productId}">
                <a href="/product.html?id=${productId}" class="product-link">
                    <div class="product-image-wrapper">
                        <img 
                            src="${image}" 
                            alt="${name}"
                            loading="lazy"
                            onerror="this.src='/assets/images/placeholder.png'"
                            class="product-image"
                        >
                        ${product.stock !== undefined && product.stock <= 0 ? '<span class="out-of-stock-badge">Out of Stock</span>' : ''}
                        ${product.discount ? `<span class="discount-badge">${product.discount}% OFF</span>` : ''}
                    </div>
                    <div class="product-info">
                        <h4 class="product-name">${truncateText(name, 35)}</h4>
                        <div class="product-price-row">
                            <span class="product-price">${price}</span>
                            ${product.originalPrice ? `<span class="original-price">₹${product.originalPrice}</span>` : ''}
                        </div>
                        ${product.rating ? `
                            <div class="product-rating">
                                <span class="stars">${'⭐'.repeat(Math.round(product.rating))}</span>
                                <span class="rating-text">${product.rating.toFixed(1)}</span>
                                ${product.reviewCount ? `<span class="review-count">(${product.reviewCount})</span>` : ''}
                            </div>
                        ` : ''}
                        <div class="product-meta">
                            <span class="viewed-time">👁️ ${viewedTime}</span>
                            ${product.category ? `<span class="product-category">${escapeHTML(product.category)}</span>` : ''}
                        </div>
                    </div>

    recentContainer:
       AppUtils.$("#recently-viewed-count"),

    recentCount:
        AppUtils.$("#recently-viewed-count")
};

// EMPTY STATE HELPER
const renderEmptyState = (container, message) => {
    if (container) {
        container.style.justifyContent = 'center';
        const wrapper = container.closest('.carousel-wrapper');
        if (wrapper) {
            const btns = wrapper.querySelectorAll('.carousel-btn');
            btns.forEach(btn => btn.style.display = 'none');
        }
        container.innerHTML = `
            <div class="empty-state-card recent-empty" style="flex: 1; margin: 0 auto; width: 100%; max-width: 400px; text-align: center; padding: 40px 20px;">
                <div class="empty-icon" style="font-size: 3rem; margin-bottom: 15px; color: #ccc;">👁</div>
                <h3>No Recently Viewed Products</h3>
                <p style="margin-bottom: 20px; color: #777;">${message}</p>
                <a href="shop.html" class="primary" style="display: inline-block; padding: 12px 24px; background: var(--primary-color); color: white; border-radius: 4px; text-decoration: none; font-weight: 600;">
                    Start Shopping

                </a>
                <div class="product-actions">
                    <button onclick="addToCart('${productId}')" class="add-to-cart-btn">
                        🛒 Add to Cart
                    </button>
                    <button onclick="removeFromRecentlyViewed('${productId}')" class="remove-btn" title="Remove from recently viewed">
                        ✕
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = `
        <div class="recently-viewed-grid">
            ${productHTML}
        </div>
        ${products.length > limit ? `
            <div class="view-more-container">
                <button onclick="loadMoreRecentlyViewed()" class="view-more-btn">
                    View More (${products.length - limit} more)
                </button>
            </div>
        ` : ''}
    `;
};

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Fetch recently viewed from API
 */
const fetchRecentlyViewed = async () => {
    try {
        const token = localStorage.getItem('jwt');
        if (!token) {
            // Fallback to local storage
            return AppUtils.getJSON(RECENTLY_VIEWED_CONFIG.cacheKey) || [];
        }
        
        const response = await fetch(RECENTLY_VIEWED_CONFIG.apiEndpoint, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.data) {
            return data.data;
        }
        
        return [];
    } catch (error) {
        console.error('❌ Fetch recently viewed error:', error);
        // Fallback to local storage
        return AppUtils.getJSON(RECENTLY_VIEWED_CONFIG.cacheKey) || [];
    }
};

/**
 * Add product to recently viewed
 */
const addToRecentlyViewed = async (productId) => {
    try {
        const token = localStorage.getItem('jwt');
        if (!token) return;
        
        await fetch(RECENTLY_VIEWED_CONFIG.apiEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ productId })
        });
        
        // Refresh the view
        refreshRecentlyViewed();
    } catch (error) {
        console.error('❌ Add to recently viewed error:', error);
    }
};

/**
 * Remove from recently viewed
 */
const removeFromRecentlyViewed = async (productId) => {
    try {
        const token = localStorage.getItem('jwt');
        if (!token) return;
        
        await fetch(`${RECENTLY_VIEWED_CONFIG.apiEndpoint}/${productId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        // Refresh the view
        refreshRecentlyViewed();
        showToast('Product removed from recently viewed', 'success');
    } catch (error) {
        console.error('❌ Remove from recently viewed error:', error);
    }
};

// ============================================
// REFRESH FUNCTIONS
// ============================================

/**
 * Refresh recently viewed
 */
const refreshRecentlyViewed = async () => {
    if (elements.recentContainer) {
        renderLoading(elements.recentContainer);
    }
    
    try {
        const products = await fetchRecentlyViewed();
        
        // Update count
        if (elements.recentCount) {
            elements.recentCount.innerText = products.length;
        }
        
        // Render products
        if (elements.recentContainer) {
            if (products.length === 0) {
                renderEmptyState(elements.recentContainer);
            } else {
                renderProducts(elements.recentContainer, products);
            }
        }
        
        // Update local storage
        AppUtils.setJSON(RECENTLY_VIEWED_CONFIG.cacheKey, products);
        
    } catch (error) {
        console.error('❌ Refresh recently viewed error:', error);
        if (elements.recentContainer) {
            renderError(elements.recentContainer);
        }
    }
};

/**
 * Load more recently viewed
 */
const loadMoreRecentlyViewed = () => {
    // Expand display limit
    RECENTLY_VIEWED_CONFIG.displayLimit += 10;
    refreshRecentlyViewed();
};

// ============================================
// TOAST NOTIFICATION
// ============================================

const showToast = (message, type = 'info') => {
    const toast = document.getElementById('toast');
    if (!toast) {
        // Fallback alert
        alert(message);
        return;
    }
    
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
};

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize recently viewed
 */
const initRecentlyViewed = async () => {
    // Check container exists
    if (!elements.recentContainer) {
        console.warn('⚠️ Recently viewed container not found');
        return;
    }
    
    // Add CSS for skeleton loading
    const style = document.createElement('style');
    style.textContent = `
        .skeleton {
            background: #f0f0f0;
            border-radius: 8px;
            animation: pulse 1.5s ease-in-out infinite;
        }
        .skeleton-image {
            width: 100%;
            height: 200px;
            background: #e0e0e0;
            border-radius: 8px 8px 0 0;
        }
        .skeleton-title {
            height: 20px;
            width: 80%;
            margin: 10px auto;
            background: #e0e0e0;
            border-radius: 4px;
        }
        .skeleton-price {
            height: 16px;
            width: 50%;
            margin: 10px auto;
            background: #e0e0e0;
            border-radius: 4px;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .recently-viewed-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 20px;
            padding: 20px 0;
        }
        .product-card {
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.08);
            transition: transform 0.3s, box-shadow 0.3s;
            overflow: hidden;
            position: relative;
        }
        .product-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 4px 20px rgba(0,0,0,0.12);
        }
        .product-image-wrapper {
            position: relative;
            overflow: hidden;
            padding-top: 100%;
        }
        .product-image {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .product-info {
            padding: 12px;
        }
        .product-name {
            font-size: 14px;
            font-weight: 600;
            margin: 0 0 8px 0;
            color: #333;
            line-height: 1.3;
        }
        .product-price {
            font-size: 18px;
            font-weight: 700;
            color: #2c7be5;
        }
        .product-meta {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: #999;
            margin-top: 8px;
        }
        .empty-state-card {
            text-align: center;
            padding: 60px 20px;
            background: #f9f9f9;
            border-radius: 12px;
        }
        .empty-icon {
            font-size: 48px;
            margin-bottom: 16px;
        }
        .empty-state-btn {
            display: inline-block;
            margin-top: 16px;
            padding: 10px 24px;
            background: #2c7be5;
            color: white;
            border-radius: 8px;
            text-decoration: none;
        }
        .empty-state-btn:hover {
            background: #1a68c4;
        }
        .product-actions {
            display: flex;
            justify-content: space-between;
            padding: 8px 12px 12px;
            gap: 8px;
        }
        .add-to-cart-btn {
            flex: 1;
            padding: 8px 12px;
            background: #2c7be5;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
        }
        .add-to-cart-btn:hover {
            background: #1a68c4;
        }
        .remove-btn {
            padding: 8px 12px;
            background: #f5f5f5;
            color: #999;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
        }
        .remove-btn:hover {
            background: #fee;
            color: #e74c3c;
        }
        .out-of-stock-badge {
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(231, 76, 60, 0.9);
            color: white;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
        }
        .discount-badge {
            position: absolute;
            top: 10px;
            left: 10px;
            background: #e74c3c;
            color: white;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
        }
        .view-more-container {
            text-align: center;
            padding: 20px 0;
        }
        .view-more-btn {
            padding: 10px 24px;
            background: #f0f0f0;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            color: #555;
        }
        .view-more-btn:hover {
            background: #e0e0e0;
        }
    `;
    document.head.appendChild(style);
    
    // Initial load
    await refreshRecentlyViewed();
    
    // Refresh button
    if (elements.refreshBtn) {
        elements.refreshBtn.addEventListener('click', refreshRecentlyViewed);
    }
    
    console.log('✅ Recently viewed initialized');
};

// ============================================
// EXPOSE GLOBALLY
// ============================================

// Make functions available globally
window.refreshRecentlyViewed = refreshRecentlyViewed;
window.loadMoreRecentlyViewed = loadMoreRecentlyViewed;
window.addToRecentlyViewed = addToRecentlyViewed;
window.removeFromRecentlyViewed = removeFromRecentlyViewed;
window.initRecentlyViewed = initRecentlyViewed;

// ============================================
// AUTO-INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Check if container exists before initializing
    if (document.getElementById('recently-viewed-container') || 
        document.getElementById('recently-viewed-count')) {
        initRecentlyViewed();
    }
});

// ============================================
// EXPORT FOR MODULE USE
// ============================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initRecentlyViewed,
        refreshRecentlyViewed,
        addToRecentlyViewed,
        removeFromRecentlyViewed
    };
}
