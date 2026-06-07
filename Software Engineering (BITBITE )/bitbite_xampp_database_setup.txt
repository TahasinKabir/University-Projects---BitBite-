-- BitBite Database Setup for XAMPP / phpMyAdmin
-- Database: bitbite_db
-- Sample login:
-- Email: araf@example.com
-- Password: 12345678
--
-- How to use:
-- 1. Open XAMPP and start Apache + MySQL.
-- 2. Open phpMyAdmin.
-- 3. Click SQL tab.
-- 4. Paste this full code and Run.
-- OR import this .sql file directly.

CREATE DATABASE IF NOT EXISTS bitbite_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE bitbite_db;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS wearable_logs;
DROP TABLE IF EXISTS user_settings;
DROP TABLE IF EXISTS achievements;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS sleep_logs;
DROP TABLE IF EXISTS shopping_list;
DROP TABLE IF EXISTS meal_plans;
DROP TABLE IF EXISTS water_logs;
DROP TABLE IF EXISTS weight_logs;
DROP TABLE IF EXISTS food_logs;
DROP TABLE IF EXISTS profiles;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- =========================
-- 1. USERS TABLE
-- =========================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    name VARCHAR(200) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- 2. PROFILES TABLE
-- =========================
CREATE TABLE profiles (
    user_id INT PRIMARY KEY,
    goal VARCHAR(50) DEFAULT 'lose',
    body_type VARCHAR(50) DEFAULT 'average',
    age INT DEFAULT 22,
    gender VARCHAR(50) DEFAULT 'male',
    height DECIMAL(6,2) DEFAULT 170,
    weight DECIMAL(6,2) DEFAULT 70,
    target_weight DECIMAL(6,2) DEFAULT 65,
    body_fat DECIMAL(5,2) DEFAULT 22,
    activity_level VARCHAR(50) DEFAULT 'moderate',
    diet_pref JSON,
    health_cond JSON,
    budget DECIMAL(10,2) DEFAULT 500,
    wearable VARCHAR(100) DEFAULT 'none',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- 3. FOOD LOGS TABLE
-- =========================
CREATE TABLE food_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    emoji VARCHAR(20) DEFAULT '🍽️',
    food_name VARCHAR(255) NOT NULL,
    calories INT NOT NULL,
    meal_type VARCHAR(100) DEFAULT 'Custom',
    logged_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- 4. WEIGHT LOGS TABLE
-- =========================
CREATE TABLE weight_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    weight DECIMAL(6,2) NOT NULL,
    note VARCHAR(255) DEFAULT '',
    logged_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- 5. WATER LOGS TABLE
-- =========================
CREATE TABLE water_logs (
    user_id INT PRIMARY KEY,
    cups DECIMAL(5,2) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- 6. MEAL PLANS TABLE
-- =========================
CREATE TABLE meal_plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    meal_day VARCHAR(100) NOT NULL,
    meal_type VARCHAR(100) NOT NULL,
    meal_name VARCHAR(255) NOT NULL,
    emoji VARCHAR(20) DEFAULT '🍽️',
    calories INT DEFAULT 0,
    carbs VARCHAR(50),
    protein VARCHAR(50),
    fat VARCHAR(50),
    cost DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- 7. SHOPPING LIST TABLE
-- =========================
CREATE TABLE shopping_list (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    quantity VARCHAR(100),
    price DECIMAL(10,2) DEFAULT 0,
    is_checked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- 8. SLEEP LOGS TABLE
-- =========================
CREATE TABLE sleep_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    sleep_date DATE DEFAULT (CURRENT_DATE),
    hours DECIMAL(4,2) NOT NULL,
    quality VARCHAR(50) DEFAULT 'Fair',
    bedtime TIME,
    wake_time TIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- 9. NOTIFICATIONS TABLE
-- =========================
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    icon VARCHAR(20) DEFAULT '🔔',
    title VARCHAR(255) NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- 10. ACHIEVEMENTS TABLE
-- =========================
CREATE TABLE achievements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    achievement_name VARCHAR(150) NOT NULL,
    icon VARCHAR(20),
    is_unlocked BOOLEAN DEFAULT FALSE,
    unlocked_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- 11. USER SETTINGS TABLE
-- =========================
CREATE TABLE user_settings (
    user_id INT PRIMARY KEY,
    meal_reminders BOOLEAN DEFAULT TRUE,
    ai_health_insights BOOLEAN DEFAULT TRUE,
    budget_alerts BOOLEAN DEFAULT FALSE,
    weekly_report_email BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- 12. WEARABLE LOGS TABLE
-- =========================
CREATE TABLE wearable_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    log_date DATE DEFAULT (CURRENT_DATE),
    steps INT DEFAULT 0,
    calories_burned INT DEFAULT 0,
    heart_rate INT DEFAULT 0,
    spo2 INT DEFAULT 0,
    sleep_hours DECIMAL(4,2) DEFAULT 0,
    hrv INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- SAMPLE DATA
-- =========================

-- Sample user password is: 12345678
INSERT INTO users 
(first_name, last_name, name, email, password_hash)
VALUES
(
    'Araf',
    'Khan',
    'Araf Khan',
    'araf@example.com',
    '$2y$12$zbGXP6YPVAZXpqloBrnYd.C9ndd.sY4w/vdCwXpbAQ3bhJmVBz1ly'
);

INSERT INTO profiles 
(user_id, goal, body_type, age, gender, height, weight, target_weight, body_fat, activity_level, diet_pref, health_cond, budget, wearable)
VALUES
(
    1,
    'lose',
    'average',
    22,
    'male',
    170,
    70,
    65,
    22,
    'moderate',
    JSON_ARRAY('Halal', 'High-protein'),
    JSON_ARRAY('None'),
    500,
    'none'
);

INSERT INTO food_logs 
(user_id, emoji, food_name, calories, meal_type)
VALUES
(1, '🥣', 'Oats with banana', 320, 'Breakfast'),
(1, '🍛', 'Lentil dal with rice', 520, 'Lunch'),
(1, '🥜', 'Mixed nuts', 180, 'Snack'),
(1, '🍲', 'Grilled chicken khichuri', 600, 'Dinner');

INSERT INTO weight_logs 
(user_id, weight, note)
VALUES
(1, 70, 'Starting weight');

INSERT INTO water_logs 
(user_id, cups)
VALUES
(1, 5);

INSERT INTO meal_plans 
(user_id, meal_day, meal_type, meal_name, emoji, calories, carbs, protein, fat, cost)
VALUES
(1, 'Friday', 'Breakfast', 'Oats + banana + chia seeds', '🥣', 420, '48g', '12g', '7g', 85),
(1, 'Friday', 'Lunch', 'Lentil dal + brown rice + spinach', '🍛', 650, '72g', '22g', '6g', 140),
(1, 'Friday', 'Snack', 'Mixed nuts and dates', '🥜', 190, '18g', '6g', '12g', 50),
(1, 'Friday', 'Dinner', 'Grilled chicken khichuri', '🍲', 600, '65g', '38g', '11g', 120),
(1, 'Saturday', 'Breakfast', 'Egg paratha + green tea', '🫓', 400, '45g', '18g', '14g', 75),
(1, 'Saturday', 'Lunch', 'Fish curry + brown rice + salad', '🐟', 620, '68g', '28g', '10g', 130),
(1, 'Saturday', 'Snack', 'Greek yogurt + honey', '🥛', 180, '20g', '8g', '3g', 45),
(1, 'Saturday', 'Dinner', 'Veg stir-fry + whole wheat roti', '🥦', 540, '52g', '14g', '9g', 95);

INSERT INTO shopping_list
(user_id, item_name, category, quantity, price, is_checked)
VALUES
(1, 'Oats', 'Grains', '500g', 120, FALSE),
(1, 'Brown rice', 'Grains', '1kg', 150, FALSE),
(1, 'Chicken breast', 'Protein', '500g', 250, FALSE),
(1, 'Lentils', 'Legumes', '500g', 100, FALSE),
(1, 'Eggs', 'Protein', '12 pcs', 140, FALSE),
(1, 'Banana', 'Fruit', '6 pcs', 80, FALSE),
(1, 'Spinach', 'Vegetables', '1 bunch', 40, FALSE),
(1, 'Mixed nuts', 'Snacks', '100g', 130, FALSE);

INSERT INTO sleep_logs
(user_id, sleep_date, hours, quality, bedtime, wake_time)
VALUES
(1, CURDATE(), 7.5, 'Good', '23:00:00', '06:30:00'),
(1, DATE_SUB(CURDATE(), INTERVAL 1 DAY), 6.2, 'Fair', '00:15:00', '06:25:00'),
(1, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 8.1, 'Excellent', '22:45:00', '06:50:00'),
(1, DATE_SUB(CURDATE(), INTERVAL 3 DAY), 5.8, 'Poor', '01:00:00', '06:45:00');

INSERT INTO notifications
(user_id, icon, title, message, is_read)
VALUES
(1, '🏆', '7-day streak achieved!', 'You logged meals for 7 days in a row. Amazing consistency!', FALSE),
(1, '💧', 'Hydration reminder', 'You are behind your water goal today. Drink one glass now.', FALSE),
(1, '🍽️', 'Dinner time!', 'Time for your planned grilled chicken khichuri.', TRUE),
(1, '🤖', 'AI insight', 'Your sleep score is low this week. Add more magnesium-rich foods.', TRUE);

INSERT INTO achievements
(user_id, achievement_name, icon, is_unlocked, unlocked_at)
VALUES
(1, '7-day Streak', '🔥', TRUE, NOW()),
(1, '10k Steps', '🏆', TRUE, NOW()),
(1, 'Hydration Pro', '💧', TRUE, NOW()),
(1, 'Veggie Week', '🥗', TRUE, NOW()),
(1, 'Mindful Eater', '🧘', FALSE, NULL),
(1, 'Power Week', '⚡', FALSE, NULL),
(1, 'Protein King', '💪', FALSE, NULL);

INSERT INTO user_settings
(user_id, meal_reminders, ai_health_insights, budget_alerts, weekly_report_email)
VALUES
(1, TRUE, TRUE, FALSE, TRUE);

INSERT INTO wearable_logs
(user_id, log_date, steps, calories_burned, heart_rate, spo2, sleep_hours, hrv)
VALUES
(1, CURDATE(), 8241, 541, 72, 98, 6.2, 42),
(1, DATE_SUB(CURDATE(), INTERVAL 1 DAY), 7600, 490, 74, 97, 7.1, 45),
(1, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 10050, 620, 70, 99, 8.0, 50);

-- =========================
-- CHECK TABLES
-- =========================
SHOW TABLES;
