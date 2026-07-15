// LOAD RECENTLY VIEWED PRODUCTS
const recentlyViewed = AppUtils.getJSON("recentlyViewed") || [];

// ELEMENTS
const elements = {
    recentContainer: AppUtils.$("#recently-viewed-container")
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
            </div>
        `;
    }
};

// INITIALIZE CAROUSEL DRAG LOGIC
function initCarousel(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    const wrapper = container.closest('.carousel-wrapper');
    if (!wrapper) return;

    const prevBtn = wrapper.querySelector('.carousel-btn.prev');
    const nextBtn = wrapper.querySelector('.carousel-btn.next');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            container.scrollBy({ left: -300, behavior: 'smooth' });
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            container.scrollBy({ left: 300, behavior: 'smooth' });
        });
    }

    // Touch/Mouse drag scrolling
    let isDown = false;
    let startX;
    let scrollLeft;

    container.addEventListener('mousedown', (e) => {
        isDown = true;
        container.style.cursor = 'grabbing';
        startX = e.pageX - container.offsetLeft;
        scrollLeft = container.scrollLeft;
    });
    
    container.addEventListener('mouseleave', () => {
        isDown = false;
        container.style.cursor = 'grab';
    });
    
    container.addEventListener('mouseup', () => {
        isDown = false;
        container.style.cursor = 'grab';
    });
    
    container.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - container.offsetLeft;
        const walk = (x - startX) * 2; // scroll-fast
        container.scrollLeft = scrollLeft - walk;
    });
}

// DISPLAY PRODUCTS
if (elements.recentContainer) {
    // Show skeleton loaders first (simulate network/processing time)
    if (typeof renderSkeletonCards === "function") {
        renderSkeletonCards("recently-viewed-container", 4);
    }
    
    setTimeout(() => {
        elements.recentContainer.innerHTML = "";
        
        if (recentlyViewed.length === 0) {
            renderEmptyState(elements.recentContainer, "No recently viewed products.");
        } else {
            const wishlistIds = new Set(AppUtils.getWishlist().map((item) => String(item.id)));
            
            // Limit to last 8 items
            const productsToShow = recentlyViewed.slice(0, 8);
            
            elements.recentContainer.style.justifyContent = 'flex-start';
            const wrapper = elements.recentContainer.closest('.carousel-wrapper');
            if (wrapper) {
                const btns = wrapper.querySelectorAll('.carousel-btn');
                btns.forEach(btn => btn.style.display = 'flex');
            }
            
            elements.recentContainer.innerHTML = productsToShow
                .map((product) => window.createProductCard(product, wishlistIds))
                .join("");
                
            // Apply animations if available
            if (typeof window.addProductCardAnimations === "function") {
                window.addProductCardAnimations("#recently-viewed-container");
            }
            
            // Init carousel
            initCarousel("#recently-viewed-container");
        }
    }, 500); // 500ms artificial delay for skeleton demonstration
}
