-- AI Financial Audit Logs
CREATE TABLE IF NOT EXISTS ai_financial_audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(100) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    proposed_action JSON NOT NULL,
    approved_action JSON,
    reason TEXT,
    status ENUM('pending_approval', 'approved', 'rejected', 'auto_rolled_back') NOT NULL,
    ip_address VARCHAR(45),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_action (action_type),
    INDEX idx_status (status),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI Approval Requests
CREATE TABLE IF NOT EXISTS ai_approval_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(100) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    proposed_action JSON NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'auto_rolled_back') DEFAULT 'pending',
    approved_by VARCHAR(100),
    approved_notes TEXT,
    auto_rollback_at DATETIME,
    auto_rollback_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME,
    INDEX idx_user (user_id),
    INDEX idx_status (status),
    INDEX idx_created (created_at),
    INDEX idx_auto_rollback (auto_rollback_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI Decision Monitoring View
CREATE VIEW ai_decision_monitoring AS
SELECT 
    DATE(timestamp) as date,
    COUNT(*) as total_decisions,
    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
    SUM(CASE WHEN status = 'auto_rolled_back' THEN 1 ELSE 0 END) as auto_rolled_back_count,
    SUM(CASE WHEN status = 'pending_approval' THEN 1 ELSE 0 END) as pending_count,
    GROUP_CONCAT(DISTINCT action_type) as action_types
FROM ai_financial_audit_logs
GROUP BY DATE(timestamp)
ORDER BY date DESC;