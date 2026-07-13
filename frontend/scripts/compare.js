const compareContainer =
    document.getElementById("compare-container");

const compareProducts =
    AppUtils.getJSON(
        "compareProducts",
        []
    );

async function renderCompare() {

    if (compareProducts.length === 0) {
        compareContainer.innerHTML =
            "<h3>No products selected</h3>";
        return;
    }

    try {

        const response =
            await apiRequest(
                "/products"
            );

        const products =
            Array.isArray(
                response.products
            )
                ? response.products
                : [];

        const selected =
            products.filter(
                product =>
                    compareProducts.includes(
                        String(product.id)
                    )
            );

        compareContainer.innerHTML =
            selected.map(
                product => `
                    <div style="
                        border:1px solid #ccc;
                        padding:15px;
                        margin:10px;
                    ">
                        <h3>${AppUtils.escapeHTML(product.name)}</h3>
                        <p><b>Price:</b> ₹${AppUtils.escapeHTML(product.price)}</p>
                        <p><b>Rating:</b> ${AppUtils.escapeHTML(product.rating)}</p>
                        <p><b>Category:</b> ${AppUtils.escapeHTML(product.category)}</p>
                    </div>
                `
            ).join("");

    } catch (error) {

        console.error(
            "COMPARE ERROR:",
            error
        );

        compareContainer.innerHTML =
            "<h3>Failed to load products</h3>";
    }
}

renderCompare();