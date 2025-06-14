-- Criar banco de dados se não existir
CREATE DATABASE IF NOT EXISTS cassandra_pilot;
USE cassandra_pilot;

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role ENUM('admin', 'user', 'viewer') DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL
);

-- Tabela de clusters Cassandra
CREATE TABLE IF NOT EXISTS cassandra_clusters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    host VARCHAR(255) NOT NULL,
    port INT DEFAULT 9042,
    hosts JSON,
    datacenter VARCHAR(50),
    username VARCHAR(50),
    password VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabela de logs de queries
CREATE TABLE IF NOT EXISTS query_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    cluster_id INT NOT NULL,
    query_text TEXT NOT NULL,
    execution_time_ms INT,
    rows_returned INT DEFAULT 0,
    status ENUM('success', 'error', 'timeout') NOT NULL,
    error_message TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (cluster_id) REFERENCES cassandra_clusters(id) ON DELETE CASCADE,
    INDEX idx_user_date (user_id, created_at),
    INDEX idx_cluster_date (cluster_id, created_at)
);

-- Tabela de sessões
CREATE TABLE IF NOT EXISTS user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (session_token),
    INDEX idx_expires (expires_at)
);

-- Tabela de auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    details JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_action (user_id, action),
    INDEX idx_date (created_at)
);

-- Inserir usuário administrador padrão
INSERT INTO users (username, email, password_hash, full_name, role) VALUES 
('admin', 'admin@cassandrapilot.com', '$2b$10$7Z0aKmwgJidEEClj1uqOJumn77lmexqqI/j.Rd8cWuaZvCerB.Dxy', 'Administrador', 'admin'),
('demo', 'demo@cassandrapilot.com', '$2b$10$7Z0aKmwgJidEEClj1uqOJumn77lmexqqI/j.Rd8cWuaZvCerB.Dxy', 'Usuário Demo', 'user');
-- Senha padrão: admin123

-- Inserir clusters de produção
INSERT INTO cassandra_clusters (name, host, port, hosts, datacenter) VALUES 
('OMNI', '10.33.245.191', 9042, JSON_ARRAY('10.33.245.191:9042', '10.33.245.192:9042', '10.33.245.193:9042'), 'dc1'),
('BTG', '10.33.245.220', 9041, JSON_ARRAY('10.33.245.220:9041', '10.33.245.221:9042', '10.33.245.222:9042'), 'dc1'),
('CLICK', '10.33.245.230', 9042, JSON_ARRAY('10.33.245.230:9042', '10.33.245.231:9042', '10.33.245.243:9042'), 'dc1'); 