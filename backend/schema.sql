-- ============================================
-- DATABASE SCHEMA FOR E-COMMERCE PLATFORM
-- ============================================

-- ============================================
-- USERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('customer', 'support', 'admin') DEFAULT 'customer',
    refresh_token VARCHAR(255),
    avatar VARCHAR(500),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    zip VARCHAR(20),
    country VARCHAR(100) DEFAULT 'India',
    is_active TINYINT(1) DEFAULT 1,
    is_verified TINYINT(1) DEFAULT 0,
    last_login DATETIME,
    created_by INT,
    updated_by INT,
    deleted_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_users_email (email),
    INDEX idx_users_role (role),
    INDEX idx_users_is_active (is_active),
    INDEX idx_users_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- PRODUCTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    compare_price DECIMAL(10,2),
    cost_price DECIMAL(10,2),
    stock INT DEFAULT 0,
    low_stock_threshold INT DEFAULT 5,
    image VARCHAR(500),
    images JSON,
    category VARCHAR(100),
    brand VARCHAR(100),
    sku VARCHAR(100) UNIQUE,
    slug VARCHAR(255) UNIQUE,
    featured TINYINT(1) DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0,
    num_reviews INT DEFAULT 0,
    weight DECIMAL(10,2),
    dimensions JSON,
    tags JSON,
    specifications JSON,
    status ENUM('draft', 'active', 'inactive', 'archived') DEFAULT 'draft',
    is_active TINYINT(1) DEFAULT 1,
    created_by INT,
    updated_by INT,
    deleted_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_price CHECK (price >= 0),
    CONSTRAINT chk_compare_price CHECK (compare_price >= 0 OR compare_price IS NULL),
    CONSTRAINT chk_cost_price CHECK (cost_price >= 0 OR cost_price IS NULL),
    CONSTRAINT chk_stock CHECK (stock >= 0),
    CONSTRAINT chk_rating CHECK (rating >= 0 AND rating <= 5),
    CONSTRAINT chk_num_reviews CHECK (num_reviews >= 0),
    
    INDEX idx_products_category (category),
    INDEX idx_products_featured (featured),
    INDEX idx_products_status (status),
    INDEX idx_products_slug (slug),
    INDEX idx_products_sku (sku),
    INDEX idx_products_price (price),
    INDEX idx_products_rating (rating),
    INDEX idx_products_deleted_at (deleted_at),
    INDEX idx_products_category_status (category, status),
    INDEX idx_products_price_rating (price, rating)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ORDERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    order_number VARCHAR(50) UNIQUE,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20),
    city VARCHAR(100),
    state VARCHAR(100),
    zip VARCHAR(20),
    full_address TEXT,
    payment_method VARCHAR(50),
    payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
    shipping_method VARCHAR(50),
    shipping_cost DECIMAL(10,2) DEFAULT 0,
    tax DECIMAL(10,2) DEFAULT 0,
    discount DECIMAL(10,2) DEFAULT 0,
    discount_code VARCHAR(50),
    subtotal DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded') DEFAULT 'pending',
    notes TEXT,
    admin_notes TEXT,
    tracking_number VARCHAR(100),
    shipping_date DATETIME,
    delivered_at DATETIME,
    cancelled_at DATETIME,
    refunded_at DATETIME,
    created_by INT,
    updated_by INT,
    deleted_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_total CHECK (total >= 0),
    CONSTRAINT chk_shipping_cost CHECK (shipping_cost >= 0),
    CONSTRAINT chk_tax CHECK (tax >= 0),
    CONSTRAINT chk_discount CHECK (discount >= 0),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_orders_user (user_id),
    INDEX idx_orders_status (status),
    INDEX idx_orders_payment_status (payment_status),
    INDEX idx_orders_order_number (order_number),
    INDEX idx_orders_created_at (created_at),
    INDEX idx_orders_status_created (status, created_at),
    INDEX idx_orders_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ORDER ITEMS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT,
    name VARCHAR(255),
    price DECIMAL(10,2),
    cost_price DECIMAL(10,2),
    qty INT DEFAULT 1,
    color VARCHAR(50),
    size VARCHAR(50),
    variant_data JSON,
    total DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_price CHECK (price >= 0),
    CONSTRAINT chk_qty CHECK (qty > 0),
    CONSTRAINT chk_total CHECK (total >= 0),
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    
    INDEX idx_order_items_order (order_id),
    INDEX idx_order_items_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- WISHLIST ITEMS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS wishlist_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    
    UNIQUE KEY user_product_unique (user_id, product_id),
    INDEX idx_wishlist_items_user (user_id),
    INDEX idx_wishlist_items_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- REVIEWS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    user_id INT NOT NULL,
    rating TINYINT NOT NULL,
    title VARCHAR(255),
    comment TEXT NOT NULL,
    images JSON,
    is_verified TINYINT(1) DEFAULT 0,
    is_approved TINYINT(1) DEFAULT 1,
    helpful_count INT DEFAULT 0,
    deleted_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_rating CHECK (rating >= 1 AND rating <= 5),
    CONSTRAINT chk_helpful_count CHECK (helpful_count >= 0),
    
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_reviews_product (product_id),
    INDEX idx_reviews_user (user_id),
    INDEX idx_reviews_rating (rating),
    INDEX idx_reviews_created (created_at),
    INDEX idx_reviews_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- USER INTERACTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS user_interactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    interaction_type ENUM('view', 'cart_add', 'wishlist_add', 'purchase') NOT NULL,
    session_id VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    
    INDEX idx_user_interactions_user (user_id),
    INDEX idx_user_interactions_product (product_id),
    INDEX idx_user_interactions_type (interaction_type),
    INDEX idx_user_interactions_created (created_at),
    INDEX idx_user_interactions_user_type (user_id, interaction_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- SERVICEABLE PINCODES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS serviceable_pincodes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pincode VARCHAR(6) NOT NULL UNIQUE,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    eta_days INT NOT NULL DEFAULT 5,
    delivery_charges DECIMAL(10,2) DEFAULT 0,
    cod_available TINYINT(1) DEFAULT 1,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_eta_days CHECK (eta_days >= 0),
    CONSTRAINT chk_delivery_charges CHECK (delivery_charges >= 0),
    
    INDEX idx_pincodes_pincode (pincode),
    INDEX idx_pincodes_city (city),
    INDEX idx_pincodes_state (state),
    INDEX idx_pincodes_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- CHAT CONVERSATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS chat_conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    assigned_admin_id INT,
    status ENUM('open', 'pending', 'closed', 'archived') DEFAULT 'open',
    subject VARCHAR(255),
    closed_at DATETIME,
    archived_at DATETIME,
    created_by INT,
    updated_by INT,
    deleted_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_admin_id) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_chat_conversations_customer (customer_id),
    INDEX idx_chat_conversations_admin (assigned_admin_id),
    INDEX idx_chat_conversations_status (status),
    INDEX idx_chat_conversations_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- CHAT MESSAGES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    sender_id INT NOT NULL,
    sender_type ENUM('customer', 'admin') NOT NULL,
    message TEXT NOT NULL,
    is_read TINYINT(1) DEFAULT 0,
    is_edited TINYINT(1) DEFAULT 0,
    is_deleted TINYINT(1) DEFAULT 0,
    deleted_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_chat_messages_conversation (conversation_id),
    INDEX idx_chat_messages_sender (sender_id),
    INDEX idx_chat_messages_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- MESSAGE READS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS message_reads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message_id INT NOT NULL,
    user_id INT NOT NULL,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    UNIQUE KEY message_user_unique (message_id, user_id),
    INDEX idx_message_reads_message (message_id),
    INDEX idx_message_reads_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ACTIVITY LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id INT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_activity_logs_user (user_id),
    INDEX idx_activity_logs_action (action),
    INDEX idx_activity_logs_created (created_at),
    INDEX idx_activity_logs_resource (resource_type, resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- INITIAL DATA
-- ============================================

INSERT INTO serviceable_pincodes (pincode, city, state, eta_days) VALUES
('110001', 'New Delhi', 'Delhi', 2),
('400001', 'Mumbai', 'Maharashtra', 2),
('560001', 'Bengaluru', 'Karnataka', 3),
('302001', 'Jaipur', 'Rajasthan', 3),
('700001', 'Kolkata', 'West Bengal', 4),
('600001', 'Chennai', 'Tamil Nadu', 4),
('500001', 'Hyderabad', 'Telangana', 3),
('380001', 'Ahmedabad', 'Gujarat', 4),
('411001', 'Pune', 'Maharashtra', 3),
('226001', 'Lucknow', 'Uttar Pradesh', 5)
ON DUPLICATE KEY UPDATE eta_days = VALUES(eta_days);