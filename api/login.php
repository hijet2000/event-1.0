
<?php
declare(strict_types=1);
require_once 'db.php';

header('Content-Type: application/json');

$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON input.']);
    exit;
}

$type = $input['type'] ?? 'admin';

if (!$input || !isset($input['email'], $input['password'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Email and password required.']);
    exit;
}

try {
    $pdo = Database::getConnection();

    if ($type === 'admin') {
        $stmt = $pdo->prepare("SELECT u.*, r.permissions FROM admin_users u JOIN roles r ON u.roleId = r.id WHERE u.email = ?");
        $stmt->execute([$input['email']]);
        $user = $stmt->fetch();

        if ($user && password_verify($input['password'], $user['password_hash'])) {
            $tokenPayload = [
                'id' => $user['id'],
                'email' => $user['email'],
                'type' => 'admin',
                'permissions' => json_decode($user['permissions']),
                'exp' => time() + 86400
            ];
            $token = base64_encode(json_encode($tokenPayload));

            echo json_encode([
                'success' => true,
                'token' => $token,
                'user' => [
                    'id' => $user['id'],
                    'email' => $user['email'],
                    'permissions' => json_decode($user['permissions'])
                ]
            ]);
        } else {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Invalid admin credentials.']);
        }
    } else {
        $stmt = $pdo->prepare("SELECT * FROM registrations WHERE email = ? AND eventId = ?");
        $stmt->execute([$input['email'], $input['eventId'] ?? 'main-event']);
        $user = $stmt->fetch();

        if ($user && ($user['password_hash'] === null || password_verify($input['password'], $user['password_hash']))) {
            $tokenPayload = [
                'id' => $user['id'],
                'email' => $user['email'],
                'type' => 'delegate',
                'eventId' => $user['eventId'],
                'exp' => time() + 86400
            ];
            $token = base64_encode(json_encode($tokenPayload));

            echo json_encode([
                'success' => true,
                'token' => $token,
                'user' => $user
            ]);
        } else {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Invalid delegate credentials.']);
        }
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>
