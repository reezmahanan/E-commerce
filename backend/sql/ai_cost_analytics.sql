-- AI Cost Analytics Table
CREATE TABLE IF NOT EXISTS ai_cost_analytics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(100) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    original_cost DECIMAL(10,6) NOT NULL,
    actual_cost DECIMAL(10,6) NOT NULL,
    savings_percentage DECIMAL(5,2) NOT NULL,
    input_tokens INT NOT NULL,
    output_tokens INT NOT NULL,
    cached_tokens INT DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_endpoint (endpoint),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Monthly Savings View
CREATE VIEW monthly_cost_savings AS
SELECT 
    DATE_FORMAT(timestamp, '%Y-%m') as month,
    COUNT(*) as total_requests,
    SUM(original_cost) as total_original_cost,
    SUM(actual_cost) as total_actual_cost,
    SUM(original_cost - actual_cost) as total_savings,
    ((SUM(original_cost) - SUM(actual_cost)) / SUM(original_cost)) * 100 as savings_percentage,
    SUM(input_tokens) as total_input_tokens,
    SUM(cached_tokens) as total_cached_tokens
FROM ai_cost_analytics
GROUP BY month
ORDER BY month DESC;

-- Daily Savings View
CREATE VIEW daily_cost_savings AS
SELECT 
    DATE(timestamp) as date,
    COUNT(*) as total_requests,
    SUM(original_cost) as total_original_cost,
    SUM(actual_cost) as total_actual_cost,
    SUM(original_cost - actual_cost) as total_savings,
    ((SUM(original_cost) - SUM(actual_cost)) / SUM(original_cost)) * 100 as savings_percentage
FROM ai_cost_analytics
GROUP BY date
ORDER BY date DESC
LIMIT 30;