// backend/services/structuredDataService.js

/**
 * Generate JSON-LD structured data for products
 * Optimized for AI shopping agents
 */
class StructuredDataService {
    /**
     * Generate Product JSON-LD
     */
    generateProductSchema(product) {
        return {
            "@context": "https://schema.org/",
            "@type": "Product",
            "name": product.name,
            "description": product.description || product.shortDescription || "",
            "image": product.imageUrl || product.images?.[0] || "",
            "sku": product.sku || product.id,
            "mpn": product.mpn || product.id,
            "brand": {
                "@type": "Brand",
                "name": product.brand || "AnthropicBots"
            },
            "offers": {
                "@type": "Offer",
                "url": `${process.env.FRONTEND_URL}/product/${product.id}`,
                "priceCurrency": "INR",
                "price": product.price,
                "priceValidUntil": new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
                "availability": product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                "seller": {
                    "@type": "Organization",
                    "name": "AnthropicBots E-Commerce"
                }
            },
            "review": product.reviews?.map(review => ({
                "@type": "Review",
                "reviewRating": {
                    "@type": "Rating",
                    "ratingValue": review.rating,
                    "bestRating": "5"
                },
                "author": {
                    "@type": "Person",
                    "name": review.author
                }
            })) || [],
            "aggregateRating": product.avgRating ? {
                "@type": "AggregateRating",
                "ratingValue": product.avgRating,
                "reviewCount": product.reviewCount || 0
            } : undefined,
            "category": product.category,
            "gtin": product.gtin || undefined,
            "material": product.material || undefined,
            "color": product.color || undefined,
            "weight": product.weight ? {
                "@type": "QuantitativeValue",
                "value": product.weight,
                "unitCode": "KGM"
            } : undefined,
            "additionalProperty": product.specifications?.map(spec => ({
                "@type": "PropertyValue",
                "name": spec.name,
                "value": spec.value
            })) || []
        };
    }

    /**
     * Generate Organization JSON-LD
     */
    generateOrganizationSchema() {
        return {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "AnthropicBots E-Commerce",
            "url": process.env.FRONTEND_URL,
            "logo": `${process.env.FRONTEND_URL}/assets/images/logo.png`,
            "description": "AnthropicBots - Your trusted e-commerce platform for electronics, fashion, home & living, and beauty products.",
            "sameAs": [
                "https://github.com/AnthropicBots",
                "https://twitter.com/anthropicbots",
                "https://linkedin.com/company/anthropicbots"
            ],
            "contactPoint": {
                "@type": "ContactPoint",
                "telephone": "+91-XXXXXXXXXX",
                "contactType": "customer service",
                "availableLanguage": ["English", "Hindi"]
            }
        };
    }

    /**
     * Generate WebSite JSON-LD
     */
    generateWebSiteSchema() {
        return {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "AnthropicBots E-Commerce",
            "url": process.env.FRONTEND_URL,
            "potentialAction": {
                "@type": "SearchAction",
                "target": `${process.env.FRONTEND_URL}/search?q={search_term_string}`,
                "query-input": "required name=search_term_string"
            }
        };
    }

    /**
     * Generate BreadcrumbList JSON-LD
     */
    generateBreadcrumbSchema(items) {
        return {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": items.map((item, index) => ({
                "@type": "ListItem",
                "position": index + 1,
                "name": item.name,
                "item": item.url
            }))
        };
    }

    /**
     * Generate Category JSON-LD
     */
    generateCategorySchema(category) {
        return {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": category.name,
            "description": category.description || "",
            "url": `${process.env.FRONTEND_URL}/category/${category.slug}`,
            "about": {
                "@type": "Thing",
                "name": category.name
            },
            "mainEntity": {
                "@type": "ItemList",
                "itemListElement": category.products?.map((product, index) => ({
                    "@type": "ListItem",
                    "position": index + 1,
                    "url": `${process.env.FRONTEND_URL}/product/${product.id}`
                })) || []
            }
        };
    }

    /**
     * Generate Product Feed for AI Agents
     */
    generateAIFeed(products) {
        return products.map(product => ({
            id: product.id,
            name: product.name,
            description: product.description,
            price: {
                amount: product.price,
                currency: "INR"
            },
            category: product.category,
            images: product.images || [product.imageUrl],
            availability: product.stock > 0 ? "in_stock" : "out_of_stock",
            brand: product.brand || "AnthropicBots",
            rating: {
                average: product.avgRating || 0,
                count: product.reviewCount || 0
            },
            url: `${process.env.FRONTEND_URL}/product/${product.id}`,
            specs: product.specifications || [],
            variants: product.variants?.map(v => ({
                name: v.name,
                price: v.price,
                availability: v.stock > 0 ? "in_stock" : "out_of_stock"
            })) || [],
            dateAdded: product.createdAt,
            lastUpdated: product.updatedAt,
            tags: product.tags || [],
            weight: product.weight,
            dimensions: product.dimensions
        }));
    }

    /**
     * Generate Product Sitemap
     */
    generateSitemap(products) {
        const baseUrl = process.env.FRONTEND_URL;
        const categories = ['mens', 'womens', 'electronics', 'home', 'beauty'];
        
        const urls = [];
        
        // Static pages
        urls.push(
            { loc: baseUrl, priority: 1.0, changefreq: 'daily' },
            { loc: `${baseUrl}/shop`, priority: 0.9, changefreq: 'daily' },
            { loc: `${baseUrl}/about`, priority: 0.6, changefreq: 'monthly' },
            { loc: `${baseUrl}/contact`, priority: 0.5, changefreq: 'monthly' }
        );

        // Category pages
        categories.forEach(cat => {
            urls.push({
                loc: `${baseUrl}/${cat}`,
                priority: 0.8,
                changefreq: 'daily'
            });
        });

        // Product pages
        products.forEach(product => {
            urls.push({
                loc: `${baseUrl}/product/${product.id}`,
                priority: 0.9,
                changefreq: 'weekly',
                lastmod: product.updatedAt || new Date().toISOString()
            });
        });

        return urls;
    }

    /**
     * Generate HTML meta tags for AI agents
     */
    generateMetaTags(product) {
        return {
            title: `${product.name} - AnthropicBots E-Commerce`,
            description: product.description || product.shortDescription || `${product.name} available at AnthropicBots. Shop now!`,
            keywords: product.tags?.join(', ') || product.category || '',
            ogTitle: product.name,
            ogDescription: product.description || product.shortDescription || '',
            ogImage: product.imageUrl || '',
            ogUrl: `${process.env.FRONTEND_URL}/product/${product.id}`,
            ogType: 'product',
            twitterCard: 'summary_large_image',
            twitterTitle: product.name,
            twitterDescription: product.description || product.shortDescription || '',
            twitterImage: product.imageUrl || '',
            price: product.price,
            currency: 'INR',
            availability: product.stock > 0 ? 'In Stock' : 'Out of Stock'
        };
    }
}

module.exports = new StructuredDataService();