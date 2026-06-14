<?php
session_start();

header("Content-Type: application/json; charset=UTF-8");

$host = "localhost";
$port =80;
$dbname = "bitbite_db";
$username = "root";
$password = "";

try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );
} catch (PDOException $e) {
    echo json_encode([
        "success" => false,
        "message" => "Database connection failed"
    ]);
    exit;
}

$action = $_GET["action"] ?? "";

function getBody() {
    return json_decode(file_get_contents("php://input"), true) ?? [];
}

function response($success, $message, $extra = []) {
    echo json_encode(array_merge([
        "success" => $success,
        "message" => $message
    ], $extra));
    exit;
}

function requireLogin() {
    if (!isset($_SESSION["user_id"])) {
        response(false, "Not logged in");
    }
    return $_SESSION["user_id"];
}

function requireAdmin() {
    if (!isset($_SESSION["admin_id"])) {
        response(false, "Admin not logged in");
    }
    return $_SESSION["admin_id"];
}

function safeFetchAll($pdo, $sql, $params = []) {
    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    } catch (PDOException $e) {
        return [];
    }
}


function columnExists($pdo, $table, $column) {
    try {
        $stmt = $pdo->prepare("SHOW COLUMNS FROM `$table` LIKE ?");
        $stmt->execute([$column]);
        return (bool)$stmt->fetch();
    } catch (PDOException $e) {
        return false;
    }
}

function addColumnIfMissing($pdo, $table, $column, $definition) {
    if (!columnExists($pdo, $table, $column)) {
        try {
            $pdo->exec("ALTER TABLE `$table` ADD COLUMN `$column` $definition");
        } catch (PDOException $e) {
            // Keep the site running; the specific save action will show a clear error if needed.
        }
    }
}

function ensureExtraFeatureSchema($pdo) {
    // Separate admin table for admin login from the first/home login page.
    $pdo->exec("CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $defaultAdminEmail = 'admin@bitbite.com';
    $defaultAdminPass = 'admin12345';
    try {
        $checkAdmin = $pdo->prepare("SELECT id FROM admins WHERE email = ?");
        $checkAdmin->execute([$defaultAdminEmail]);
        if (!$checkAdmin->fetch()) {
            $adminHash = password_hash($defaultAdminPass, PASSWORD_DEFAULT);
            $insAdmin = $pdo->prepare("INSERT INTO admins (name, email, password_hash) VALUES ('BitBite Admin', ?, ?)");
            $insAdmin->execute([$defaultAdminEmail, $adminHash]);
        }
    } catch (PDOException $e) {}

    // Provider tables used to display selectable nutritionists and yoga coaches.
    $pdo->exec("CREATE TABLE IF NOT EXISTS nutritionists (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(150) NOT NULL,
        specialization VARCHAR(150) NOT NULL,
        experience_years INT DEFAULT 0,
        consultation_type VARCHAR(100) DEFAULT 'Online',
        fee DECIMAL(10,2) DEFAULT 0,
        rating DECIMAL(3,1) DEFAULT 4.8,
        bio TEXT,
        is_available BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS yoga_coaches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(150) NOT NULL,
        yoga_type VARCHAR(150) NOT NULL,
        experience_years INT DEFAULT 0,
        session_type VARCHAR(100) DEFAULT 'Online',
        fee DECIMAL(10,2) DEFAULT 0,
        rating DECIMAL(3,1) DEFAULT 4.8,
        description TEXT,
        is_available BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // Booking tables. These may already exist from your first SQL, so missing columns are added below.
    $pdo->exec("CREATE TABLE IF NOT EXISTS nutritionist_hires (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        nutritionist_name VARCHAR(150) NOT NULL,
        specialization VARCHAR(150),
        experience_years INT DEFAULT 0,
        consultation_type VARCHAR(100) DEFAULT 'Online',
        session_date DATE,
        session_time TIME,
        fee DECIMAL(10,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'Pending',
        payment_method VARCHAR(100) DEFAULT 'Cash after session',
        payment_status VARCHAR(50) DEFAULT 'Pending',
        transaction_id VARCHAR(150),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    addColumnIfMissing($pdo, 'nutritionist_hires', 'payment_method', "VARCHAR(100) DEFAULT 'Cash after session'");
    addColumnIfMissing($pdo, 'nutritionist_hires', 'payment_status', "VARCHAR(50) DEFAULT 'Pending'");
    addColumnIfMissing($pdo, 'nutritionist_hires', 'transaction_id', "VARCHAR(150) NULL");

    $pdo->exec("CREATE TABLE IF NOT EXISTS yoga_coach_hires (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        coach_name VARCHAR(150) NOT NULL,
        yoga_type VARCHAR(150),
        experience_years INT DEFAULT 0,
        session_type VARCHAR(100) DEFAULT 'Online',
        session_date DATE,
        session_time TIME,
        fee DECIMAL(10,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'Pending',
        payment_method VARCHAR(100) DEFAULT 'Cash after session',
        payment_status VARCHAR(50) DEFAULT 'Pending',
        transaction_id VARCHAR(150),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    addColumnIfMissing($pdo, 'yoga_coach_hires', 'payment_method', "VARCHAR(100) DEFAULT 'Cash after session'");
    addColumnIfMissing($pdo, 'yoga_coach_hires', 'payment_status', "VARCHAR(50) DEFAULT 'Pending'");
    addColumnIfMissing($pdo, 'yoga_coach_hires', 'transaction_id', "VARCHAR(150) NULL");

    $pdo->exec("CREATE TABLE IF NOT EXISTS research_hub_articles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        author_name VARCHAR(150),
        article_summary TEXT,
        article_content LONGTEXT,
        image_url VARCHAR(255),
        reading_time VARCHAR(50),
        published_date DATE DEFAULT (CURRENT_DATE),
        is_featured BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS research_article_reads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        article_id INT NOT NULL,
        read_count INT DEFAULT 1,
        first_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_article (user_id, article_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (article_id) REFERENCES research_hub_articles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");


    $pdo->exec("CREATE TABLE IF NOT EXISTS reward_catalog (
        id INT AUTO_INCREMENT PRIMARY KEY,
        reward_name VARCHAR(150) NOT NULL,
        reward_type VARCHAR(100) NOT NULL,
        description TEXT,
        points_required INT DEFAULT 100,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS user_rewards (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        reward_id INT NOT NULL,
        goal_snapshot VARCHAR(100),
        current_weight DECIMAL(6,2),
        target_weight DECIMAL(6,2),
        status VARCHAR(50) DEFAULT 'Claimed',
        claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_reward (user_id, reward_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reward_id) REFERENCES reward_catalog(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");


    $pdo->exec("CREATE TABLE IF NOT EXISTS daily_challenges (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(180) NOT NULL,
        challenge_type VARCHAR(100) DEFAULT 'Daily',
        description TEXT,
        points INT DEFAULT 10,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS user_challenge_completions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        challenge_id INT NOT NULL,
        completed_date DATE DEFAULT (CURRENT_DATE),
        points_earned INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_daily_challenge (user_id, challenge_id, completed_date),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (challenge_id) REFERENCES daily_challenges(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS saved_articles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        article_id INT NOT NULL,
        saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_saved_article (user_id, article_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (article_id) REFERENCES research_hub_articles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    addColumnIfMissing($pdo, 'user_rewards', 'phone', "VARCHAR(30) NULL");
    addColumnIfMissing($pdo, 'user_rewards', 'delivery_address', "TEXT NULL");
    addColumnIfMissing($pdo, 'user_rewards', 'tshirt_size', "VARCHAR(20) NULL");
    addColumnIfMissing($pdo, 'user_rewards', 'delivery_note', "TEXT NULL");

    // Sample rows are inserted with fixed IDs so frontend cards and backend booking IDs always match.
    $pdo->exec("INSERT IGNORE INTO nutritionists
        (id, full_name, specialization, experience_years, consultation_type, fee, rating, bio, is_available) VALUES
        (1, 'Dr. Nusrat Jahan', 'Weight Loss Nutrition', 5, 'Online', 800, 4.9, 'Weight loss nutritionist focused on realistic Bangladeshi meal plans and healthy habits.', TRUE),
        (2, 'Tanvir Ahmed', 'Sports Nutrition', 4, 'Online / Offline', 1000, 4.8, 'Sports nutrition coach for muscle gain, protein planning, gym diet, and recovery support.', TRUE),
        (3, 'Farhana Rahman', 'PCOS and Women Health Nutrition', 6, 'Online', 1200, 4.9, 'PCOS-friendly food plans, weight management, balanced meals, and sustainable lifestyle changes.', TRUE),
        (4, 'Mahin Islam', 'Diabetes Friendly Diet', 7, 'Offline', 1500, 4.7, 'Diabetes-friendly meal planning, low sugar choices, and daily food habit correction.', TRUE),
        (5, 'Sabrina Akter', 'Clinical Nutrition', 8, 'Online / Offline', 1800, 4.9, 'Clinical diet support for cholesterol, anemia, hypertension, and long-term health goals.', TRUE),
        (6, 'Arif Hossain', 'Budget Meal Planning', 3, 'Online', 600, 4.6, 'Affordable Bangladeshi meal planning for students, busy people, and tight budgets.', TRUE),
        (7, 'Dr. Samia Karim', 'Weight Gain Nutrition', 6, 'Online', 1100, 4.8, 'Healthy weight gain plans with calorie surplus, protein timing, and digestion-friendly meals.', TRUE),
        (8, 'Mehedi Hasan', 'Muscle Gain Diet', 5, 'Offline', 1300, 4.7, 'Gym-focused diet plans for lean bulking, strength training recovery, and macro tracking.', TRUE),
        (9, 'Nadia Sultana', 'Family Nutrition', 4, 'Online / Offline', 900, 4.6, 'Family meal planning, children-friendly meals, and healthier home food choices.', TRUE),
        (10, 'Rumana Islam', 'Heart Healthy Diet', 9, 'Online', 1600, 4.9, 'Heart-friendly nutrition, low sodium meals, cholesterol control, and lifestyle guidance.', TRUE)");

    $pdo->exec("INSERT IGNORE INTO yoga_coaches
        (id, full_name, yoga_type, experience_years, session_type, fee, rating, description, is_available) VALUES
        (1, 'Sadia Rahman', 'Beginner Yoga', 3, 'Online', 500, 4.8, 'Beginner-friendly sessions for flexibility, breathing, and daily movement.', TRUE),
        (2, 'Mahmud Hasan', 'Weight Loss Yoga', 6, 'Offline', 700, 4.7, 'Fat loss, mobility, and stamina-focused yoga sessions.', TRUE),
        (3, 'Nabila Karim', 'Stress Relief Yoga', 5, 'Online', 650, 4.9, 'Calming yoga sessions for stress relief, sleep support, and breathing control.', TRUE),
        (4, 'Rafi Chowdhury', 'Power Yoga', 7, 'Online / Offline', 1000, 4.8, 'Strength, balance, core control, and active yoga training.', TRUE),
        (5, 'Mim Akter', 'Women Fitness Yoga', 4, 'Online', 750, 4.7, 'Women-focused flexibility, posture, and general fitness yoga.', TRUE),
        (6, 'Sakib Rahman', 'Flexibility Yoga', 5, 'Offline', 800, 4.6, 'Flexibility improvement, mobility drills, and posture correction.', TRUE),
        (7, 'Jannatul Ferdous', 'Meditation and Breathing', 8, 'Online', 900, 4.9, 'Breathing, meditation, mindfulness, and relaxation-focused sessions.', TRUE),
        (8, 'Aminul Islam', 'Back Pain Yoga', 6, 'Online / Offline', 1100, 4.8, 'Gentle back pain support, mobility, and posture-based yoga.', TRUE),
        (9, 'Tasmia Noor', 'Morning Yoga', 3, 'Online', 550, 4.6, 'Short morning routines for energy, consistency, and healthy habits.', TRUE),
        (10, 'Riad Hasan', 'Advanced Yoga', 9, 'Offline', 1300, 4.9, 'Advanced balance, strength, flexibility, and long-session yoga practice.', TRUE)");

    $pdo->exec("INSERT IGNORE INTO research_hub_articles
        (id, title, category, author_name, article_summary, article_content, image_url, reading_time, published_date, is_featured) VALUES
        (1, 'Benefits of Drinking Enough Water Daily', 'Hydration', 'BitBite Research Team', 'Learn how proper hydration improves metabolism, energy and focus.', 'Water supports digestion, metabolism, body temperature, and physical performance. Drinking enough water throughout the day may reduce fatigue and help you stay consistent with nutrition habits.', 'images/hydration.jpg', '4 min read', CURDATE(), TRUE),
        (2, 'How Protein Helps in Weight Loss', 'Nutrition', 'BitBite Research Team', 'Protein helps control hunger and maintain muscle during fat loss.', 'Protein increases fullness, supports muscle repair, and helps maintain lean mass during calorie deficit. Adding protein to each meal can make a weight-loss diet easier to follow.', 'images/protein.jpg', '5 min read', CURDATE(), TRUE),
        (3, 'Why Sleep Matters for Fitness Progress', 'Sleep Health', 'BitBite Research Team', 'Good sleep improves recovery, hormones and daily energy.', 'Sleep affects hunger hormones, cravings, muscle recovery, and focus. Poor sleep may increase appetite and reduce workout performance.', 'images/sleep.jpg', '6 min read', CURDATE(), FALSE),
        (4, 'Simple Yoga for Stress Relief', 'Yoga', 'BitBite Research Team', 'Basic yoga practices can reduce stress and improve flexibility.', 'Yoga supports breathing, flexibility, balance, and mental calmness. Regular beginner yoga can support both physical and emotional health.', 'images/yoga.jpg', '5 min read', CURDATE(), FALSE),
        (5, 'Budget-Friendly Healthy Eating in Bangladesh', 'Budget Nutrition', 'BitBite Research Team', 'Healthy eating can be affordable with local foods.', 'Rice, dal, eggs, seasonal vegetables, fish, chickpeas, and fruits can create balanced meals without overspending. Planning meals before shopping helps reduce waste and cost.', 'images/budget.jpg', '5 min read', CURDATE(), TRUE),
        (6, 'Understanding Calories Without Fear', 'Calories', 'BitBite Research Team', 'Calories are energy, not something to fear.', 'Calories help measure food energy. Weight loss usually needs a calorie deficit, while weight gain needs a surplus. The goal is balance, not extreme restriction.', 'images/calories.jpg', '4 min read', CURDATE(), FALSE),
        (7, 'Why Fiber Is Important for Digestion', 'Digestive Health', 'BitBite Research Team', 'Fiber supports digestion and keeps you full longer.', 'Fiber from vegetables, fruits, oats, lentils, beans, and whole grains supports digestion and fullness. Increasing fiber slowly with water is usually easier for the body.', 'images/fiber.jpg', '4 min read', CURDATE(), FALSE),
        (8, 'Pre-Workout and Post-Workout Meal Basics', 'Fitness Nutrition', 'BitBite Research Team', 'Learn what to eat before and after workouts.', 'Before workouts, easy carbohydrates can provide energy. After workouts, protein plus carbohydrates supports recovery and muscle repair.', 'images/workout-meal.jpg', '5 min read', CURDATE(), TRUE),
        (9, 'Healthy Weight Gain the Right Way', 'Weight Gain', 'BitBite Research Team', 'Weight gain should focus on calories, protein and consistency.', 'Healthy weight gain means increasing calories with nutrient-rich foods like rice, eggs, milk, nuts, chicken, fish, dal, and smoothies while following strength training if possible.', 'images/weight-gain.jpg', '5 min read', CURDATE(), FALSE),
        (10, 'How Consistency Beats Perfect Dieting', 'Healthy Habits', 'BitBite Research Team', 'Small habits done regularly work better than extreme plans.', 'A perfect diet is hard to maintain. Simple habits like eating enough protein, drinking water, walking, sleeping well, and tracking progress create better long-term results.', 'images/consistency.jpg', '4 min read', CURDATE(), TRUE)");

    $pdo->exec("INSERT IGNORE INTO reward_catalog
        (id, reward_name, reward_type, description, points_required, is_active) VALUES
        (1, 'BitBite Target Complete T-shirt', 'T-shirt', 'A special BitBite T-shirt for users who complete their target goal.', 100, TRUE),
        (2, 'Target Complete Bracelet', 'Bracelet', 'A simple bracelet that represents consistency, discipline, and target completion.', 100, TRUE),
        (3, 'BitBite Fitness Wrist Band', 'Wrist band', 'A sporty wrist band reward for users who successfully reach their target weight goal.', 100, TRUE),
        (4, 'Healthy Habit Badge', 'Digital badge', 'A digital badge saved in your profile after completing your goal.', 100, TRUE),
        (5, 'Premium Meal Plan Coupon', 'Coupon', 'A coupon-style reward for a future premium meal plan or consultation support.', 100, TRUE)");

    $pdo->exec("INSERT IGNORE INTO daily_challenges
        (id, title, challenge_type, description, points, is_active) VALUES
        (1, 'Drink 8 cups of water', 'Hydration', 'Complete your daily hydration target and keep your body energized.', 10, TRUE),
        (2, 'Log one healthy meal', 'Food Log', 'Add at least one food log today to stay aware of your nutrition.', 10, TRUE),
        (3, 'Read one health article', 'Research', 'Read any article from the Research Hub and save your learning history.', 10, TRUE),
        (4, 'Walk for 20 minutes', 'Activity', 'Complete a short walk or light activity session.', 15, TRUE),
        (5, 'Review your sleep habit', 'Sleep', 'Check or log your sleep habit to support recovery.', 10, TRUE),
        (6, 'Update weight progress', 'Progress', 'Add or review your weight progress toward your target goal.', 10, TRUE),
        (7, 'Plan tomorrow meal', 'Meal Planning', 'Open your meal plan or prepare a simple healthy meal idea for tomorrow.', 10, TRUE)");


}

ensureExtraFeatureSchema($pdo);


function isGoalAchieved($profile) {
    if (!$profile) return false;
    $goal = $profile["goal"] ?? "lose";
    $current = floatval($profile["weight"] ?? 0);
    $target = floatval($profile["targetWeight"] ?? ($profile["target_weight"] ?? 0));
    if ($current <= 0 || $target <= 0) return false;
    if ($goal === "lose") return $current <= $target;
    if ($goal === "gain" || $goal === "muscle") return $current >= $target;
    return abs($current - $target) <= 1;
}

function awardAutomaticGoalReward($pdo, $userId) {
    $profile = getUserProfile($pdo, $userId);
    if (!isGoalAchieved($profile)) return;
    $reward = safeFetchAll($pdo, "SELECT id FROM reward_catalog WHERE is_active = TRUE ORDER BY id ASC LIMIT 1");
    if (!$reward) return;
    $stmt = $pdo->prepare("INSERT IGNORE INTO user_rewards (user_id, reward_id, goal_snapshot, current_weight, target_weight, status) VALUES (?, ?, ?, ?, ?, 'Claimed')");
    $stmt->execute([
        $userId,
        $reward[0]["id"],
        $profile["goal"] ?? "goal",
        $profile["weight"] ?? 0,
        $profile["targetWeight"] ?? 0
    ]);
}

function getUserProfile($pdo, $userId) {
    $stmt = $pdo->prepare("
        SELECT 
            users.id,
            users.first_name,
            users.last_name,
            users.name,
            users.email,
            profiles.goal,
            profiles.body_type AS bodyType,
            profiles.age,
            profiles.gender,
            profiles.height,
            profiles.weight,
            profiles.target_weight AS targetWeight,
            profiles.body_fat AS bodyFat,
            profiles.activity_level AS activityLevel,
            profiles.diet_pref,
            profiles.health_cond,
            profiles.budget,
            profiles.wearable,
            DATE(users.created_at) AS joinDate
        FROM users
        LEFT JOIN profiles ON users.id = profiles.user_id
        WHERE users.id = ?
    ");

    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        return null;
    }

    $user["dietPref"] = json_decode($user["diet_pref"] ?? "[]", true);
    $user["healthCond"] = json_decode($user["health_cond"] ?? "[]", true);

    unset($user["diet_pref"]);
    unset($user["health_cond"]);

    return $user;
}

function getAllData($pdo, $userId) {
    $user = getUserProfile($pdo, $userId);

    $food = $pdo->prepare("
        SELECT 
            id,
            emoji AS em,
            food_name AS nm,
            calories AS cal,
            DATE_FORMAT(logged_time, '%h:%i %p') AS time,
            meal_type AS type
        FROM food_logs
        WHERE user_id = ?
        ORDER BY logged_time DESC
    ");
    $food->execute([$userId]);

    $weight = $pdo->prepare("
        SELECT 
            id,
            DATE_FORMAT(logged_date, '%d %b') AS date,
            weight AS w,
            note
        FROM weight_logs
        WHERE user_id = ?
        ORDER BY logged_date DESC
    ");
    $weight->execute([$userId]);

    $water = $pdo->prepare("SELECT cups FROM water_logs WHERE user_id = ?");
    $water->execute([$userId]);
    $waterRow = $water->fetch();

    $meals = $pdo->prepare("SELECT * FROM meal_plans WHERE user_id = ? ORDER BY id ASC");
    $meals->execute([$userId]);

    $shopping = $pdo->prepare("SELECT * FROM shopping_list WHERE user_id = ? ORDER BY id ASC");
    $shopping->execute([$userId]);

    $sleep = $pdo->prepare("SELECT * FROM sleep_logs WHERE user_id = ? ORDER BY sleep_date DESC");
    $sleep->execute([$userId]);

    $notifications = $pdo->prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC");
    $notifications->execute([$userId]);

    $achievements = $pdo->prepare("SELECT * FROM achievements WHERE user_id = ? ORDER BY id ASC");
    $achievements->execute([$userId]);

    $wearable = $pdo->prepare("SELECT * FROM wearable_logs WHERE user_id = ? ORDER BY log_date DESC");
    $wearable->execute([$userId]);

    $nutritionists = safeFetchAll($pdo, "SELECT * FROM nutritionists ORDER BY rating DESC, experience_years DESC");
    $yogaCoaches = safeFetchAll($pdo, "SELECT * FROM yoga_coaches ORDER BY rating DESC, experience_years DESC");
    $researchArticles = safeFetchAll($pdo, "SELECT * FROM research_hub_articles ORDER BY is_featured DESC, published_date DESC, id DESC");
    $nutritionistHires = safeFetchAll($pdo, "SELECT * FROM nutritionist_hires WHERE user_id = ? ORDER BY created_at DESC", [$userId]);
    $yogaHires = safeFetchAll($pdo, "SELECT * FROM yoga_coach_hires WHERE user_id = ? ORDER BY created_at DESC", [$userId]);
    $researchReads = safeFetchAll($pdo, "SELECT rr.*, a.title, a.category, a.reading_time FROM research_article_reads rr LEFT JOIN research_hub_articles a ON rr.article_id = a.id WHERE rr.user_id = ? ORDER BY rr.last_read_at DESC", [$userId]);
    $rewards = safeFetchAll($pdo, "SELECT * FROM reward_catalog WHERE is_active = TRUE ORDER BY id ASC");
    $userRewards = safeFetchAll($pdo, "SELECT ur.*, rc.reward_name, rc.reward_type, rc.description FROM user_rewards ur LEFT JOIN reward_catalog rc ON ur.reward_id = rc.id WHERE ur.user_id = ? ORDER BY ur.claimed_at DESC", [$userId]);
    $dailyChallenges = safeFetchAll($pdo, "SELECT * FROM daily_challenges WHERE is_active = TRUE ORDER BY id ASC");
    $userChallenges = safeFetchAll($pdo, "SELECT uc.*, dc.title, dc.challenge_type FROM user_challenge_completions uc LEFT JOIN daily_challenges dc ON uc.challenge_id = dc.id WHERE uc.user_id = ? ORDER BY uc.completed_date DESC, uc.created_at DESC", [$userId]);
    $savedArticles = safeFetchAll($pdo, "SELECT sa.*, a.title, a.category, a.reading_time FROM saved_articles sa LEFT JOIN research_hub_articles a ON sa.article_id = a.id WHERE sa.user_id = ? ORDER BY sa.saved_at DESC", [$userId]);

    return [
        "user" => $user,
        "food_logs" => $food->fetchAll(),
        "weight_logs" => $weight->fetchAll(),
        "water_cups" => $waterRow ? $waterRow["cups"] : 0,
        "meal_plans" => $meals->fetchAll(),
        "shopping_list" => $shopping->fetchAll(),
        "sleep_logs" => $sleep->fetchAll(),
        "notifications" => $notifications->fetchAll(),
        "achievements" => $achievements->fetchAll(),
        "wearable_logs" => $wearable->fetchAll(),
        "nutritionists" => $nutritionists,
        "yoga_coaches" => $yogaCoaches,
        "research_articles" => $researchArticles,
        "nutritionist_hires" => $nutritionistHires,
        "yoga_hires" => $yogaHires,
        "research_reads" => $researchReads,
        "rewards" => $rewards,
        "user_rewards" => $userRewards,
        "daily_challenges" => $dailyChallenges,
        "user_challenges" => $userChallenges,
        "saved_articles" => $savedArticles
    ];
}

if ($action === "signup") {
    $data = getBody();

    $first = trim($data["firstName"] ?? "");
    $last = trim($data["lastName"] ?? "");
    $email = strtolower(trim($data["email"] ?? ""));
    $pass = $data["password"] ?? "";
    $confirmPass = $data["confirmPassword"] ?? $pass;

    if ($first === "" || $email === "" || strlen($pass) < 8) {
        response(false, "Invalid signup data");
    }

    if ($pass !== $confirmPass) {
        response(false, "Password and confirm password do not match");
    }

    $check = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $check->execute([$email]);

    if ($check->fetch()) {
        response(false, "Account already exists");
    }

    $hash = password_hash($pass, PASSWORD_DEFAULT);
    $name = trim($first . " " . $last);

    $stmt = $pdo->prepare("
        INSERT INTO users (first_name, last_name, name, email, password_hash)
        VALUES (?, ?, ?, ?, ?)
    ");
    $stmt->execute([$first, $last, $name, $email, $hash]);

    $userId = $pdo->lastInsertId();

    $profile = $pdo->prepare("
        INSERT INTO profiles 
        (user_id, goal, body_type, age, gender, height, weight, target_weight, body_fat, activity_level, diet_pref, health_cond, budget, wearable)
        VALUES
        (?, 'lose', 'average', 22, 'male', 170, 70, 65, 22, 'moderate', JSON_ARRAY(), JSON_ARRAY('None'), 500, 'none')
    ");
    $profile->execute([$userId]);

    $pdo->prepare("INSERT INTO water_logs (user_id, cups) VALUES (?, 0)")
        ->execute([$userId]);

    $pdo->prepare("
        INSERT INTO user_settings 
        (user_id, meal_reminders, ai_health_insights, budget_alerts, weekly_report_email)
        VALUES (?, TRUE, TRUE, FALSE, TRUE)
    ")->execute([$userId]);

    $_SESSION["user_id"] = $userId;

    response(true, "Signup successful", getAllData($pdo, $userId));
}


if ($action === "admin_login") {
    $data = getBody();
    $email = strtolower(trim($data["email"] ?? ""));
    $pass = $data["password"] ?? "";

    $stmt = $pdo->prepare("SELECT * FROM admins WHERE email = ?");
    $stmt->execute([$email]);
    $admin = $stmt->fetch();

    if (!$admin || !password_verify($pass, $admin["password_hash"])) {
        response(false, "Invalid admin email or password");
    }

    $_SESSION["admin_id"] = $admin["id"];
    $_SESSION["admin_email"] = $admin["email"];

    response(true, "Admin login successful", ["admin" => ["id" => $admin["id"], "name" => $admin["name"], "email" => $admin["email"]]]);
}

if ($action === "admin_logout") {
    unset($_SESSION["admin_id"]);
    unset($_SESSION["admin_email"]);
    response(true, "Admin logged out");
}

if ($action === "login") {
    $data = getBody();

    $email = strtolower(trim($data["email"] ?? ""));
    $pass = $data["password"] ?? "";

    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($pass, $user["password_hash"])) {
        response(false, "Invalid email or password");
    }

    $_SESSION["user_id"] = $user["id"];

    response(true, "Login successful", getAllData($pdo, $user["id"]));
}

if ($action === "logout") {
    session_destroy();
    response(true, "Logged out");
}

if ($action === "me") {
    $userId = requireLogin();
    response(true, "User data loaded", getAllData($pdo, $userId));
}

if ($action === "save_profile") {
    $userId = requireLogin();
    $data = getBody();

    $stmt = $pdo->prepare("
        UPDATE profiles SET
            goal = ?,
            body_type = ?,
            age = ?,
            gender = ?,
            height = ?,
            weight = ?,
            target_weight = ?,
            body_fat = ?,
            activity_level = ?,
            diet_pref = ?,
            health_cond = ?,
            budget = ?,
            wearable = ?
        WHERE user_id = ?
    ");

    $stmt->execute([
        $data["goal"] ?? "lose",
        $data["bodyType"] ?? "average",
        $data["age"] ?? 22,
        $data["gender"] ?? "male",
        $data["height"] ?? 170,
        $data["weight"] ?? 70,
        $data["targetWeight"] ?? 65,
        $data["bodyFat"] ?? 22,
        $data["activityLevel"] ?? "moderate",
        json_encode($data["dietPref"] ?? []),
        json_encode($data["healthCond"] ?? []),
        $data["budget"] ?? 500,
        $data["wearable"] ?? "none",
        $userId
    ]);

    response(true, "Profile saved", getAllData($pdo, $userId));
}

if ($action === "add_food") {
    $userId = requireLogin();
    $data = getBody();

    $stmt = $pdo->prepare("
        INSERT INTO food_logs (user_id, emoji, food_name, calories, meal_type)
        VALUES (?, ?, ?, ?, ?)
    ");

    $stmt->execute([
        $userId,
        $data["emoji"] ?? "🍽️",
        $data["food_name"] ?? "Food",
        $data["calories"] ?? 0,
        $data["meal_type"] ?? "Custom"
    ]);

    response(true, "Food added", getAllData($pdo, $userId));
}

if ($action === "delete_food") {
    $userId = requireLogin();
    $data = getBody();

    $stmt = $pdo->prepare("DELETE FROM food_logs WHERE id = ? AND user_id = ?");
    $stmt->execute([$data["id"], $userId]);

    response(true, "Food deleted", getAllData($pdo, $userId));
}

if ($action === "set_water") {
    $userId = requireLogin();
    $data = getBody();

    $cups = $data["cups"] ?? 0;

    $stmt = $pdo->prepare("
        INSERT INTO water_logs (user_id, cups)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE cups = VALUES(cups)
    ");

    $stmt->execute([$userId, $cups]);

    response(true, "Water updated", getAllData($pdo, $userId));
}

if ($action === "add_weight") {
    $userId = requireLogin();
    $data = getBody();

    $weight = $data["weight"] ?? 0;

    $stmt = $pdo->prepare("
        INSERT INTO weight_logs (user_id, weight, note)
        VALUES (?, ?, ?)
    ");

    $stmt->execute([
        $userId,
        $weight,
        $data["note"] ?? ""
    ]);

    $pdo->prepare("UPDATE profiles SET weight = ? WHERE user_id = ?")
        ->execute([$weight, $userId]);

    awardAutomaticGoalReward($pdo, $userId);

    response(true, "Weight added", getAllData($pdo, $userId));
}

if ($action === "read_article") {
    $userId = requireLogin();
    $data = getBody();
    $articleId = intval($data["article_id"] ?? 0);

    if ($articleId <= 0) {
        response(false, "Invalid article");
    }

    $check = $pdo->prepare("SELECT id FROM research_hub_articles WHERE id = ?");
    $check->execute([$articleId]);

    if (!$check->fetch()) {
        response(false, "Article not found");
    }

    $stmt = $pdo->prepare("
        INSERT INTO research_article_reads (user_id, article_id, read_count, first_read_at, last_read_at)
        VALUES (?, ?, 1, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
            read_count = read_count + 1,
            last_read_at = NOW()
    ");
    $stmt->execute([$userId, $articleId]);

    response(true, "Article reading history saved", getAllData($pdo, $userId));
}

if ($action === "hire_nutritionist") {
    $userId = requireLogin();
    $data = getBody();
    $providerId = (int)($data["id"] ?? 0);

    $provider = safeFetchAll($pdo, "SELECT * FROM nutritionists WHERE id = ?", [$providerId]);
    if (!$provider) {
        response(false, "Nutritionist not found");
    }
    $p = $provider[0];
    $paymentMethod = trim($data["payment_method"] ?? "Cash after session");
    $transactionId = trim($data["transaction_id"] ?? "");
    $paymentStatus = ($paymentMethod === "Cash after session" && $transactionId === "") ? "Pending" : "Paid";

    $stmt = $pdo->prepare("INSERT INTO nutritionist_hires
        (user_id, nutritionist_name, specialization, experience_years, consultation_type, session_date, session_time, fee, status, payment_method, payment_status, transaction_id, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?)");
    $stmt->execute([
        $userId,
        $p["full_name"],
        $p["specialization"],
        $p["experience_years"],
        $data["type"] ?? $p["consultation_type"],
        $data["session_date"] ?? null,
        $data["session_time"] ?? null,
        $p["fee"],
        $paymentMethod,
        $paymentStatus,
        $transactionId,
        $data["notes"] ?? ""
    ]);

    response(true, "Nutritionist booking saved", getAllData($pdo, $userId));
}

if ($action === "hire_yoga") {
    $userId = requireLogin();
    $data = getBody();
    $providerId = (int)($data["id"] ?? 0);

    $provider = safeFetchAll($pdo, "SELECT * FROM yoga_coaches WHERE id = ?", [$providerId]);
    if (!$provider) {
        response(false, "Yoga coach not found");
    }
    $p = $provider[0];
    $paymentMethod = trim($data["payment_method"] ?? "Cash after session");
    $transactionId = trim($data["transaction_id"] ?? "");
    $paymentStatus = ($paymentMethod === "Cash after session" && $transactionId === "") ? "Pending" : "Paid";

    $stmt = $pdo->prepare("INSERT INTO yoga_coach_hires
        (user_id, coach_name, yoga_type, experience_years, session_type, session_date, session_time, fee, status, payment_method, payment_status, transaction_id, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?)");
    $stmt->execute([
        $userId,
        $p["full_name"],
        $p["yoga_type"],
        $p["experience_years"],
        $data["type"] ?? $p["session_type"],
        $data["session_date"] ?? null,
        $data["session_time"] ?? null,
        $p["fee"],
        $paymentMethod,
        $paymentStatus,
        $transactionId,
        $data["notes"] ?? ""
    ]);

    response(true, "Yoga coach booking saved", getAllData($pdo, $userId));
}

if ($action === "cancel_hire") {
    $userId = requireLogin();
    $data = getBody();
    $kind = $data["kind"] ?? "";
    $id = (int)($data["id"] ?? 0);

    if ($kind === "nutritionist") {
        $stmt = $pdo->prepare("UPDATE nutritionist_hires SET status = 'Cancelled' WHERE id = ? AND user_id = ?");
    } elseif ($kind === "yoga") {
        $stmt = $pdo->prepare("UPDATE yoga_coach_hires SET status = 'Cancelled' WHERE id = ? AND user_id = ?");
    } else {
        response(false, "Invalid booking type");
    }

    $stmt->execute([$id, $userId]);
    response(true, "Booking cancelled", getAllData($pdo, $userId));
}


if ($action === "claim_reward") {
    $userId = requireLogin();
    $data = getBody();
    $rewardId = intval($data["reward_id"] ?? 0);

    if ($rewardId <= 0) {
        response(false, "Invalid reward");
    }

    $profile = getUserProfile($pdo, $userId);
    if (!isGoalAchieved($profile)) {
        response(false, "Target goal is not achieved yet. Update your weight log after reaching your target.");
    }

    $reward = safeFetchAll($pdo, "SELECT * FROM reward_catalog WHERE id = ? AND is_active = TRUE", [$rewardId]);
    if (!$reward) {
        response(false, "Reward not found");
    }

    $phone = trim($data["phone"] ?? "");
    $address = trim($data["address"] ?? "");
    $tshirtSize = trim($data["tshirt_size"] ?? "");
    $deliveryNote = trim($data["delivery_note"] ?? "");

    if ($phone === "" || $address === "") {
        response(false, "Phone number and delivery address are required to claim a physical reward.");
    }

    $stmt = $pdo->prepare("INSERT INTO user_rewards (user_id, reward_id, goal_snapshot, current_weight, target_weight, status, phone, delivery_address, tshirt_size, delivery_note)
        VALUES (?, ?, ?, ?, ?, 'Claimed', ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE status = 'Claimed', claimed_at = CURRENT_TIMESTAMP, phone = VALUES(phone), delivery_address = VALUES(delivery_address), tshirt_size = VALUES(tshirt_size), delivery_note = VALUES(delivery_note)");
    $stmt->execute([
        $userId,
        $rewardId,
        $profile["goal"] ?? "goal",
        $profile["weight"] ?? 0,
        $profile["targetWeight"] ?? 0,
        $phone,
        $address,
        $tshirtSize,
        $deliveryNote
    ]);

    response(true, "Reward claimed", getAllData($pdo, $userId));
}


if ($action === "toggle_save_article") {
    $userId = requireLogin();
    $data = getBody();
    $articleId = intval($data["article_id"] ?? 0);
    if ($articleId <= 0) response(false, "Invalid article");

    $exists = safeFetchAll($pdo, "SELECT id FROM saved_articles WHERE user_id = ? AND article_id = ?", [$userId, $articleId]);
    if ($exists) {
        $stmt = $pdo->prepare("DELETE FROM saved_articles WHERE user_id = ? AND article_id = ?");
        $stmt->execute([$userId, $articleId]);
        response(true, "Article removed from saved list", getAllData($pdo, $userId));
    }

    $check = safeFetchAll($pdo, "SELECT id FROM research_hub_articles WHERE id = ?", [$articleId]);
    if (!$check) response(false, "Article not found");

    $stmt = $pdo->prepare("INSERT INTO saved_articles (user_id, article_id) VALUES (?, ?)");
    $stmt->execute([$userId, $articleId]);
    response(true, "Article saved to favorites", getAllData($pdo, $userId));
}

if ($action === "complete_challenge") {
    $userId = requireLogin();
    $data = getBody();
    $challengeId = intval($data["challenge_id"] ?? 0);
    if ($challengeId <= 0) response(false, "Invalid challenge");

    $challenge = safeFetchAll($pdo, "SELECT * FROM daily_challenges WHERE id = ? AND is_active = TRUE", [$challengeId]);
    if (!$challenge) response(false, "Challenge not found");

    $points = intval($challenge[0]["points"] ?? 10);
    $stmt = $pdo->prepare("INSERT INTO user_challenge_completions (user_id, challenge_id, completed_date, points_earned)
        VALUES (?, ?, CURRENT_DATE, ?)
        ON DUPLICATE KEY UPDATE points_earned = VALUES(points_earned), created_at = CURRENT_TIMESTAMP");
    $stmt->execute([$userId, $challengeId, $points]);
    response(true, "Challenge completed", getAllData($pdo, $userId));
}

if ($action === "admin_stats") {
    requireAdmin();
    $one = function($sql) use ($pdo) {
        try { return (int)$pdo->query($sql)->fetchColumn(); } catch (PDOException $e) { return 0; }
    };
    $stats = [
        "users" => $one("SELECT COUNT(*) FROM users"),
        "nutritionist_bookings" => $one("SELECT COUNT(*) FROM nutritionist_hires"),
        "yoga_bookings" => $one("SELECT COUNT(*) FROM yoga_coach_hires"),
        "article_reads" => $one("SELECT COALESCE(SUM(read_count),0) FROM research_article_reads"),
        "saved_articles" => $one("SELECT COUNT(*) FROM saved_articles"),
        "reward_claims" => $one("SELECT COUNT(*) FROM user_rewards"),
        "challenge_completions" => $one("SELECT COUNT(*) FROM user_challenge_completions"),
        "challenge_users" => $one("SELECT COUNT(DISTINCT user_id) FROM user_challenge_completions")
    ];
    $recent = [];
    try {
        $recent = safeFetchAll($pdo, "
            (SELECT 'Nutritionist booking' AS type, nutritionist_name AS detail, created_at FROM nutritionist_hires)
            UNION ALL
            (SELECT 'Yoga booking' AS type, coach_name AS detail, created_at FROM yoga_coach_hires)
            UNION ALL
            (SELECT 'Reward claim' AS type, CONCAT('Reward ID ', reward_id) AS detail, claimed_at AS created_at FROM user_rewards)
            ORDER BY created_at DESC LIMIT 8
        ");
    } catch (PDOException $e) { $recent = []; }
    $stats["recent_activity"] = $recent;
    response(true, "Admin stats loaded", ["stats" => $stats]);
}

if ($action === "mark_notification") {
    $userId = requireLogin();
    $data = getBody();

    $stmt = $pdo->prepare("
        UPDATE notifications 
        SET is_read = TRUE 
        WHERE id = ? AND user_id = ?
    ");

    $stmt->execute([$data["id"], $userId]);

    response(true, "Notification updated", getAllData($pdo, $userId));
}

if ($action === "mark_all_notifications") {
    $userId = requireLogin();

    $stmt = $pdo->prepare("
        UPDATE notifications 
        SET is_read = TRUE 
        WHERE user_id = ?
    ");

    $stmt->execute([$userId]);

    response(true, "All notifications read", getAllData($pdo, $userId));
}

response(false, "Invalid action");
?>