(function () {
    "use strict";

    const normalizeText = (value) =>
        String(value || "")
            .trim()
            .toLowerCase();

    const getProductTitle = (product) =>
        product?.name || product?.title || "";

    const getProductCategory = (product) =>
        product?.category || "";

    const getProductBrand = (product) =>
        product?.brand || product?.manufacturer || "";

    const getProductPrice = (product) => {
        const price = Number(product?.price);
        return Number.isFinite(price) ? price : 0;
    };

    const getProductRating = (product) => {
        const rating = Number(product?.rating);
        return Number.isFinite(rating) ? rating : 0;
    };

    const getProductStock = (product) => {
        const stock = Number(product?.stock);
        return Number.isFinite(stock) ? stock : 0;
    };

    const getProductReviewCount = (product) => {
        const count = Number(
            product?.num_reviews ??
            product?.numReviews ??
            product?.reviewCount ??
            0
        );

        return Number.isFinite(count) ? count : 0;
    };

    const getSearchHaystack = (product) =>
        [
            getProductTitle(product),
            getProductCategory(product),
            getProductBrand(product)
        ]
            .map(normalizeText)
            .join(" ");

    const debounce = (callback, wait = 400) => {
        let timeoutId;

        return (...args) => {
            window.clearTimeout(timeoutId);
            timeoutId = window.setTimeout(
                () => callback(...args),
                wait
            );
        };
    };

    const uniqueCategories = (products) =>
        Array.from(
            new Set(
                products
                    .map(getProductCategory)
                    .filter(Boolean)
            )
        ).sort((a, b) => a.localeCompare(b));

    const getPriceBounds = (products) => {
        const prices = products
            .map(getProductPrice)
            .filter((price) => Number.isFinite(price));

        if (!prices.length) {
            return {
                min: 0,
                max: 0
            };
        }

        return {
            min: Math.floor(Math.min(...prices)),
            max: Math.ceil(Math.max(...prices))
        };
    };

    const filterProducts = (products, filters) => {
        const query = normalizeText(filters.search);
        const selectedCategories = new Set(filters.categories || []);
        const minPrice = Number(filters.minPrice);
        const maxPrice = Number(filters.maxPrice);
        const minimumRating = Number(filters.rating || 0);
        const availability = new Set(filters.availability || []);

        return products.filter((product) => {
            const price = getProductPrice(product);
            const stock = getProductStock(product);
            const category = getProductCategory(product);

            if (query && !getSearchHaystack(product).includes(query)) {
                return false;
            }

            if (selectedCategories.size && !selectedCategories.has(category)) {
                return false;
            }

            if (Number.isFinite(minPrice) && price < minPrice) {
                return false;
            }

            if (Number.isFinite(maxPrice) && price > maxPrice) {
                return false;
            }

            if (minimumRating && getProductRating(product) < minimumRating) {
                return false;
            }

            if (availability.size) {
                const productAvailability = stock > 0
                    ? "in-stock"
                    : "out-of-stock";

                if (!availability.has(productAvailability)) {
                    return false;
                }
            }

            return true;
        });
    };

    const sortProducts = (products, sortValue) => {
        const sortedProducts = [...products];

        const sorters = {
            newest: (a, b) => Number(b.id || 0) - Number(a.id || 0),
            "price-low-high": (a, b) => getProductPrice(a) - getProductPrice(b),
            "price-high-low": (a, b) => getProductPrice(b) - getProductPrice(a),
            popularity: (a, b) => getProductReviewCount(b) - getProductReviewCount(a),
            "highest-rated": (a, b) => getProductRating(b) - getProductRating(a),
            "alphabetical-az": (a, b) =>
                getProductTitle(a).localeCompare(getProductTitle(b))
        };

        const sorter = sorters[sortValue] || sorters.newest;

        return sortedProducts.sort(sorter);
    };

    const getSuggestions = (products, query, limit = 6) => {
        const normalizedQuery = normalizeText(query);

        if (!normalizedQuery) {
            return [];
        }

        return products
            .filter((product) => getSearchHaystack(product).includes(normalizedQuery))
            .slice(0, limit);
    };

    window.ShopFilterUtils = {
        debounce,
        filterProducts,
        getPriceBounds,
        getProductBrand,
        getProductCategory,
        getProductPrice,
        getProductRating,
        getProductStock,
        getProductTitle,
        getSuggestions,
        normalizeText,
        sortProducts,
        uniqueCategories
    };
})();
