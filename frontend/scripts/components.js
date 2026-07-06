// ===== THEME - Apply INSTANTLY before anything loads =====
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-theme');
}

// load component
const loadComponent = async (id, file) => {
    const element = document.getElementById(id);

    if (!element) {
        return false;
    }

    element.innerHTML = `<div class="component-loading">Loading...</div>`;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => { controller.abort(); }, 8000);

        const response = await fetch(file, { signal: controller.signal });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`Failed to load ${file}`);
        }

        const data = await response.text();
        element.innerHTML = data;

        if (
            id === "navbar" &&
            element.dataset.hideGlobalSearch === "true"
        ) {
            element.querySelector(".search-container")?.remove();
        }

        return true;

    } catch (error) {
        console.error(`Error loading component: ${file}`, error);
        element.innerHTML = `<div class="component-error">Failed to load component.</div>`;
        return false;
    }
};

const loadScript = (
    src
) => {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            if (
                document.querySelector(
                    `script[src="${src}"]`
                )
            ) {
                resolve();
                return;
            }

            const script =
                document.createElement(
                    "script"
                );

            script.src = src;
            script.defer = true;
            script.onload = resolve;
            script.onerror = reject;

            document.body.appendChild(
                script
            );
        }
    );
};

const loadStylesheet = (
    href
) => {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            if (
                document.querySelector(
                    `link[href="${href}"]`
                )
            ) {
                resolve();
                return;
            }

            const stylesheet =
                document.createElement(
                    "link"
                );

            stylesheet.rel =
                "stylesheet";

            stylesheet.href =
                href;

            stylesheet.onload =
                resolve;

            stylesheet.onerror =
                reject;

            document.head.appendChild(
                stylesheet
            );
        }
    );
};

const initializeCustomCursor = async () => {
    await loadStylesheet(
        "styles/custom-cursor.css"
    );

    await loadScript(
        "scripts/custom-cursor.js"
    );
};

// initialize components
async function initializeComponents() {
    try {
        await initializeCustomCursor();
    } catch (error) {
        console.error(
            "Failed to load custom cursor:",
            error
        );
    }

    const loadTasks = [
        loadComponent(
            "navbar",
            "./components/navbar.html"
        ),

        loadComponent(
            "footer",
            "./components/footer.html"
        )
    ];

    if (
        !document.getElementById(
            "cart-drawer"
        )
    ) {
        let drawerHost =
            document.getElementById(
                "cart-drawer-host"
            );

        if (
            !drawerHost
        ) {
            drawerHost =
                document.createElement(
                    "div"
                );

            drawerHost.id =
                "cart-drawer-host";

            document.body.appendChild(
                drawerHost
            );
        }

        loadTasks.push(
            loadComponent(
                "cart-drawer-host",
                "./components/cart-drawer.html"
            )
        );
    }

    await Promise.all(
        loadTasks
    );

    try {
        await loadScript(
            "scripts/cart-drawer.js"
        );
    } catch (error) {
        console.error(
            "Failed to load cart drawer script:",
            error
        );
    }

    // ===== THEME TOGGLE - runs AFTER navbar is loaded =====
    const themeToggle = document.getElementById('theme-toggle');

    if (themeToggle) {
        // Set correct icon on load
        themeToggle.innerHTML = localStorage.getItem('theme') === 'dark' ? '☀️' : '🌙';

        themeToggle.addEventListener('click', function () {
            document.body.classList.toggle('dark-theme');

            if (document.body.classList.contains('dark-theme')) {
                localStorage.setItem('theme', 'dark');
                themeToggle.innerHTML = '☀️';
            } else {
                localStorage.setItem('theme', 'light');
                themeToggle.innerHTML = '🌙';
            }
        });
    }
    // Set active nav link based on current page
const navLinks = document.querySelectorAll('#navbar-links a');
navLinks.forEach(link => {
    if (link.href === window.location.href) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
    }
});

const categoryMenuItem = document.querySelector(".category-menu-item");
const categoryMenuToggle = document.getElementById("category-menu-toggle");
const categoryMenuDropdown = document.getElementById("category-menu-dropdown");
const megaMenuCategories = Array.from(
    document.querySelectorAll(".mega-menu-category")
);
const megaMenuPanels = Array.from(
    document.querySelectorAll(".mega-menu-panel")
);
const categoryMenuLinks = document.querySelectorAll(
    ".category-menu-link, .mega-menu-panel-header a, .mobile-subcategory-panel a"
);
const mobileCategoryAccordions = Array.from(
    document.querySelectorAll(".mobile-category-accordion")
);
const currentUrl = new URL(window.location.href);
const currentCategory = currentUrl.searchParams.get("category");
const currentSubcategory = currentUrl.searchParams.get("subcategory");

const setCategoryMenuOpen = (isOpen) => {
    if (!categoryMenuItem || !categoryMenuToggle) {
        return;
    }

    categoryMenuItem.classList.toggle("is-open", isOpen);
    categoryMenuToggle.setAttribute("aria-expanded", String(isOpen));
};

const activateMegaCategory = (categoryId) => {
    megaMenuCategories.forEach((category) => {
        const isActive = category.dataset.megaCategory === categoryId;

        category.classList.toggle("is-active", isActive);
        category.setAttribute("aria-expanded", String(isActive));
    });

    megaMenuPanels.forEach((panel) => {
        panel.classList.toggle(
            "is-active",
            panel.dataset.megaPanel === categoryId
        );
    });
};

const focusMegaCategoryByOffset = (currentCategory, offset) => {
    const currentIndex = megaMenuCategories.indexOf(currentCategory);
    const nextIndex =
        (currentIndex + offset + megaMenuCategories.length) %
        megaMenuCategories.length;
    const nextCategory = megaMenuCategories[nextIndex];

    nextCategory?.focus();
    activateMegaCategory(nextCategory?.dataset.megaCategory);
};

categoryMenuToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    setCategoryMenuOpen(
        !categoryMenuItem?.classList.contains("is-open")
    );
});

categoryMenuItem?.addEventListener("mouseenter", () => {
    if (window.matchMedia("(min-width: 1025px)").matches) {
        setCategoryMenuOpen(true);
    }
});

categoryMenuItem?.addEventListener("mouseleave", () => {
    if (window.matchMedia("(min-width: 1025px)").matches) {
        setCategoryMenuOpen(false);
    }
});

megaMenuCategories.forEach((category) => {
    category.addEventListener("mouseenter", () => {
        if (window.matchMedia("(min-width: 1025px)").matches) {
            activateMegaCategory(category.dataset.megaCategory);
        }
    });

    category.addEventListener("click", () => {
        activateMegaCategory(category.dataset.megaCategory);
        setCategoryMenuOpen(true);
    });

    category.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowRight") {
            event.preventDefault();
            focusMegaCategoryByOffset(category, 1);
        }

        if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
            event.preventDefault();
            focusMegaCategoryByOffset(category, -1);
        }

        if (event.key === "Home") {
            event.preventDefault();
            megaMenuCategories[0]?.focus();
            activateMegaCategory(megaMenuCategories[0]?.dataset.megaCategory);
        }

        if (event.key === "End") {
            event.preventDefault();
            const lastCategory =
                megaMenuCategories[megaMenuCategories.length - 1];
            lastCategory?.focus();
            activateMegaCategory(lastCategory?.dataset.megaCategory);
        }
    });
});

categoryMenuDropdown?.addEventListener("click", (event) => {
    event.stopPropagation();
});

categoryMenuItem?.addEventListener("focusout", (event) => {
    if (!categoryMenuItem.contains(event.relatedTarget)) {
        setCategoryMenuOpen(false);
    }
});

document.addEventListener("click", (event) => {
    if (categoryMenuItem && !categoryMenuItem.contains(event.target)) {
        setCategoryMenuOpen(false);
    }
});

document.addEventListener("keydown", (event) => {
    if (
        event.key === "Escape" &&
        categoryMenuItem?.classList.contains("is-open")
    ) {
        setCategoryMenuOpen(false);
        categoryMenuToggle?.focus();
    }
});

categoryMenuLinks.forEach((link) => {
    const linkUrl = new URL(link.href);
    const linkCategory = linkUrl.searchParams.get("category");
    const linkSubcategory = linkUrl.searchParams.get("subcategory");

    if (
        currentUrl.pathname.endsWith(linkUrl.pathname.split("/").pop()) &&
        currentCategory &&
        linkCategory === currentCategory &&
        (!currentSubcategory || linkSubcategory === currentSubcategory)
    ) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
    }
});

if (currentCategory) {
    categoryMenuToggle?.classList.add("active");

    const activeCategory = megaMenuCategories.find((category) => {
        const panel = document.getElementById(
            category.getAttribute("aria-controls")
        );

        return panel?.querySelector(
            `a[href*="category=${encodeURIComponent(currentCategory).replace(/%20/g, "%20")}"]`
        );
    });

    if (activeCategory?.dataset.megaCategory) {
        activateMegaCategory(activeCategory.dataset.megaCategory);
    }
}

mobileCategoryAccordions.forEach((accordion) => {
    const toggle = accordion.querySelector(".mobile-category-toggle");
    const panel = accordion.querySelector(".mobile-subcategory-panel");
    const hasCurrentLink = Boolean(panel?.querySelector(".active"));

    if (hasCurrentLink) {
        accordion.classList.add("is-open");
        toggle?.setAttribute("aria-expanded", "true");
    }

    toggle?.addEventListener("click", () => {
        const isOpen = accordion.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", String(isOpen));
    });
});
    // notify components ready
    document.dispatchEvent(new CustomEvent("componentsLoaded"));
}

const user = JSON.parse(localStorage.getItem("user"));

const profileDropdown = document.getElementById("profile-dropdown");

if (user && profileDropdown) {
    profileDropdown.setAttribute("data-loggedin", "true");
}


// init
document.addEventListener("DOMContentLoaded", () => {
    initializeComponents();
});
