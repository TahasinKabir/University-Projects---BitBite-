<?php
// BitBite no-F12 database checker. Open this file in browser: http://localhost/your-folder/test_connection.php
header('Content-Type: text/html; charset=utf-8');
$host = 'localhost';
$dbname = 'bitbite_db';
$username = 'root';
$password = '';
function ok($msg){ echo "<div style='padding:8px;margin:6px 0;background:#e8f5ee;border:1px solid #9bd3ad;border-radius:8px'>✅ ".$msg."</div>"; }
function bad($msg){ echo "<div style='padding:8px;margin:6px 0;background:#fff0f0;border:1px solid #ffb2b2;border-radius:8px'>❌ ".$msg."</div>"; }
function warn($msg){ echo "<div style='padding:8px;margin:6px 0;background:#fff8e6;border:1px solid #ffd36c;border-radius:8px'>⚠️ ".$msg."</div>"; }
echo "<body style='font-family:Arial,sans-serif;max-width:900px;margin:30px auto;line-height:1.5'><h2>BitBite Database Test</h2>";
try {
    $pdo = new PDO("mysql:host=$host;charset=utf8mb4", $username, $password, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    ok('MySQL connected successfully.');
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbname` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE `$dbname`");
    ok("Database `$dbname` selected.");
} catch (Exception $e) {
    bad('Connection failed: '.htmlspecialchars($e->getMessage()));
    echo '<p>Make sure XAMPP MySQL is running and database name is bitbite_db.</p></body>'; exit;
}
$tables = [
 'admins','users','profiles','research_hub_articles','research_article_reads','saved_articles','nutritionists','nutritionist_hires','yoga_coaches','yoga_coach_hires','reward_catalog','user_rewards','daily_challenges','user_challenge_completions'
];
foreach($tables as $t){
    try { $pdo->query("SELECT 1 FROM `$t` LIMIT 1"); ok("Table exists: `$t`"); }
    catch(Exception $e){ bad("Missing/problem table `$t`: ".htmlspecialchars($e->getMessage())); }
}
$columns = [
 'admins'=>['name','email','password_hash'],
 'nutritionist_hires'=>['payment_method','payment_status','transaction_id'],
 'yoga_coach_hires'=>['payment_method','payment_status','transaction_id'],
 'research_article_reads'=>['user_id','article_id','read_count','first_read_at','last_read_at'],
 'user_rewards'=>['user_id','reward_id','goal_snapshot','current_weight','target_weight','status','phone','delivery_address','tshirt_size','delivery_note'],
 'saved_articles'=>['user_id','article_id','saved_at'],
 'user_challenge_completions'=>['user_id','challenge_id','completed_date','points_earned']
];
foreach($columns as $table=>$cols){
    foreach($cols as $col){
        try { $st=$pdo->prepare("SHOW COLUMNS FROM `$table` LIKE ?"); $st->execute([$col]); if($st->fetch()) ok("Column exists: `$table`.`$col`"); else bad("Missing column: `$table`.`$col`"); }
        catch(Exception $e){ bad("Cannot check `$table`.`$col`: ".htmlspecialchars($e->getMessage())); }
    }
}
try {
    foreach(['research_hub_articles','nutritionists','yoga_coaches','reward_catalog','daily_challenges'] as $t){
        $c=$pdo->query("SELECT COUNT(*) AS c FROM `$t`")->fetch()['c'];
        if($c>0) ok("$t has $c rows."); else warn("$t is empty. Run bitbite_extra_features_update_sql.txt again.");
    }
} catch(Exception $e) { bad('Count check failed: '.htmlspecialchars($e->getMessage())); }
echo "<h3>How to test saving without F12</h3><ol><li>Log in to BitBite.</li><li>Click Research Hub → Read article.</li><li>Refresh phpMyAdmin and check <b>research_article_reads</b>.</li><li>Book Nutritionist/Yoga and check <b>nutritionist_hires</b> or <b>yoga_coach_hires</b>.</li><li>Save an article and check <b>saved_articles</b>.</li><li>Complete a challenge and check <b>user_challenge_completions</b>.</li><li>Claim a reward and check delivery columns in <b>user_rewards</b>.</li><li>Admin login should work from the first login page with <b>admin@bitbite.com</b> / <b>admin12345</b>.</li></ol>";
echo "</body>";
?>
