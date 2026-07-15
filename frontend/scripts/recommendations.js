const Recommendations = (() => {
  const postInteraction = async (productId, type) => {
    const user = window.AppUtils.getUser();
    if (!user) return; // Only log for authenticated users

    try {
      await window.AppUtils.apiRequest("/recommendations/interaction", {
        method: "POST",
        body: JSON.stringify({ productId, type }),
      });
    } catch (error) {
      console.error("Failed to post interaction", error);
    }
  };

  const initCarousel = (containerSelector) => {
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
        const walk = (x - startX) * 2;
        container.scrollLeft = scrollLeft - walk;
    });
  };

  const loadRecommendations = async (
    containerId = "recommended-products-container"
  ) => {
    const container = window.AppUtils.$(containerId);
    if (!container) return;

    const user = window.AppUtils.getUser();
    if (!user) {
      // If not logged in, hide recommendations section
      const section = container.closest("section");
      if (section) section.style.display = "none";
      return;
    }

    try {
      if (typeof window.renderSkeletonCards === "function") {
        window.renderSkeletonCards(containerId, 4);
      }
      
      const response = await window.AppUtils.apiRequest(
        "/recommendations?limit=8"
      );

      if (
        response &&
        response.success &&
        response.data &&
        response.data.length > 0
      ) {
        // Ensure UI functions are available and use the correct arguments
        if (typeof window.createProductCard === "function") {
          const wishlistIds = new Set(AppUtils.getWishlist().map((item) => String(item.id)));
          container.innerHTML = response.data
            .map((product) => window.createProductCard(product, wishlistIds))
            .join("");

          if (typeof window.addProductCardAnimations === "function") {
            window.addProductCardAnimations(`#${containerId}`);
          }
          
          initCarousel(`#${containerId}`);
        } else if (typeof window.renderProducts === "function") {
          // script.js defines: renderProducts(container, products)
          window.renderProducts(container, response.data);
          initCarousel(`#${containerId}`);
        } else if (typeof window.renderProductCard === "function") {
          // product-render.js defines: renderProductCard(product, container)
          container.innerHTML = "";
          response.data.forEach((product) =>
            window.renderProductCard(product, container)
          );
          initCarousel(`#${containerId}`);
        } else {
          console.warn(
            "No compatible product renderer found, skipping render."
          );
        }
      } else {
        // Hide if no recommendations
        const section = container.closest("section");
        if (section) section.style.display = "none";
      }
    } catch (error) {
      console.error("Failed to load recommendations", error);
      const section = container.closest("section");
      if (section) section.style.display = "none";
    }
  };

  const initViewTracking = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get("id");

    if (window.location.pathname.includes("product.html") && productId) {
      // Record a view
      postInteraction(parseInt(productId, 10), "view");
    }
  };

  // Wait for DOM
  document.addEventListener("DOMContentLoaded", () => {
    initViewTracking();
    loadRecommendations();
  });

  return {
    postInteraction,
    loadRecommendations,
  };
})();

window.Recommendations = Recommendations;