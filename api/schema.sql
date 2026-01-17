
CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSON NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_users (
    id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    roleId VARCHAR(50) NOT NULL,
    createdAt BIGINT NOT NULL,
    FOREIGN KEY (roleId) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS events (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    config JSON NOT NULL,
    created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS registrations (
    id VARCHAR(50) PRIMARY KEY,
    eventId VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    company VARCHAR(255),
    role VARCHAR(255),
    goals TEXT,
    createdAt BIGINT NOT NULL,
    status ENUM('confirmed', 'waitlist', 'cancelled') DEFAULT 'confirmed',
    checkedIn BOOLEAN DEFAULT FALSE,
    INDEX (email),
    INDEX (eventId),
    FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE CASCADE
);

-- Seed initial admin data if empty
INSERT IGNORE INTO roles (id, name, description, permissions) VALUES 
('role_super_admin', 'Super Admin', 'Full Access', '["view_dashboard", "manage_registrations", "manage_settings", "manage_users", "manage_tasks", "manage_dining", "manage_accommodation", "manage_agenda", "manage_speakers_sponsors", "view_eventcoin_dashboard", "manage_eventcoin", "send_invitations", "manage_gamification", "manage_communications", "manage_media", "manage_marketing", "manage_maps", "view_system_status", "view_diagnostics"]');

-- Default password is 'password'
INSERT IGNORE INTO admin_users (id, email, password_hash, roleId, createdAt) VALUES 
('admin_01', 'admin@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'role_super_admin', 1672531200000);
