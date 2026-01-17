
<?php
declare(strict_types=1);

require_once 'db.php';
require_once 'Gemini.php';

header('Content-Type: application/json');

// Get POST data
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['email'], $input['eventId'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Missing required fields: email and eventId are mandatory.']);
    exit;
}

try {
    $pdo = Database::getConnection();

    // 1. Check for existing registration in this event
    $stmt = $pdo->prepare("SELECT id FROM registrations WHERE email = ? AND eventId = ?");
    $stmt->execute([$input['email'], $input['eventId']]);

    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'This email is already registered for the event.']);
        exit;
    }

    // 2. Prepare user record
    $userId = 'reg_' . uniqid() . bin2hex(random_bytes(2));
    
    // Construct name from parts if provided, otherwise use 'name' field
    $fullName = '';
    if (isset($input['firstName']) && isset($input['lastName'])) {
        $fullName = trim($input['firstName'] . ' ' . $input['lastName']);
    } else {
        $fullName = $input['name'] ?? 'Attendee';
    }
    
    $createdAt = time() * 1000;
    
    // Hash password if provided
    $passwordHash = null;
    if (!empty($input['password'])) {
        $passwordHash = password_hash($input['password'], PASSWORD_DEFAULT);
    }

    // 3. Insert into MariaDB
    $sql = "INSERT INTO registrations (id, eventId, name, email, password_hash, company, role, goals, createdAt, status) 
            VALUES (:id, :eventId, :name, :email, :password_hash, :company, :role, :goals, :createdAt, 'confirmed')";

    $stmt = $pdo->prepare($sql);
    $success = $stmt->execute([
        'id' => $userId,
        'eventId' => $input['eventId'],
        'name' => $fullName,
        'email' => $input['email'],
        'password_hash' => $passwordHash,
        'company' => $input['company'] ?? null,
        'role' => $input['role'] ?? null,
        'goals' => $input['goals'] ?? null,
        'createdAt' => $createdAt
    ]);

    if (!$success) {
        throw new Exception("SQL execution failed.");
    }

    // 4. Trigger AI Background Logic (Gemini)
    // In a full production app, this would be a background task (worker/queue).
    // For this prototype, we call it inline to ensure the confirmation data is generated.
    $gemini = new GeminiService();
    $aiConfirmationData = $gemini->generateConfirmationEmail(
        [
            'name' => $fullName, 
            'goals' => $input['goals'] ?? 'Participate and learn'
        ],
        ['name' => 'The Event'] // This would normally be fetched from the 'events' table
    );

    // 5. Return detailed success response
    echo json_encode([
        'success' => true,
        'user' => [
            'id' => $userId,
            'name' => $fullName,
            'email' => $input['email'],
            'company' => $input['company'] ?? '',
            'role' => $input['role'] ?? '',
            'goals' => $input['goals'] ?? '',
            'createdAt' => $createdAt,
            'status' => 'confirmed'
        ],
        'meta' => [
            'message' => 'Registration complete. A personalized confirmation has been queued.',
            'ai_snapshot' => $aiConfirmationData
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'message' => 'Internal Server Error during registration: ' . $e->getMessage()
    ]);
}
?>
