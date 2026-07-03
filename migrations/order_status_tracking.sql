-- migrations/001_add_order_status_tracking.sql

-- Add new columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
ADD INDEX idx_status (status),
ADD INDEX idx_user_id_status (user_id, status),
ADD INDEX idx_created_at (created_at);

-- Create order_status_logs table
CREATE TABLE IF NOT EXISTS order_status_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    reason TEXT,
    updated_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_order_id (order_id),
    INDEX idx_created_at (created_at)
);

-- Create order_summary_view (optional)
CREATE OR REPLACE VIEW order_summary_view AS
SELECT 
    o.id,
    o.user_id,
    o.customer_name,
    o.customer_email,
    o.status,
    o.total,
    o.final_amount,
    o.discount_amount,
    o.created_at,
    o.updated_at,
    COUNT(oi.id) as item_count,
    SUM(oi.qty) as total_items
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id;