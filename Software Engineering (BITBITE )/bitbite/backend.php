<?php
session_start();

header("Content-Type: application/json; charset=UTF-8");

$host = "localhost";
$port="3306";
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
        "wearable_logs" => $wearable->fetchAll()
    ];
}

if ($action === "signup") {
    $data = getBody();

    $first = trim($data["firstName"] ?? "");
    $last = trim($data["lastName"] ?? "");
    $email = strtolower(trim($data["email"] ?? ""));
    $pass = $data["password"] ?? "";

    if ($first === "" || $email === "" || strlen($pass) < 8) {
        response(false, "Invalid signup data");
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

    response(true, "Weight added", getAllData($pdo, $userId));
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