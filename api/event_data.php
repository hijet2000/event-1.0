
<?php
declare(strict_types=1);
require_once 'db.php';

header('Content-Type: application/json');

$eventId = $_GET['eventId'] ?? 'main-event';
$pdo = Database::getConnection();

$stmt = $pdo->prepare("SELECT * FROM events WHERE id = ?");
$stmt->execute([$eventId]);
$event = $stmt->fetch();

if (!$event) {
    http_response_code(404);
    echo json_encode(['error' => 'Event not found']);
    exit;
}

// Count registrations
$countStmt = $pdo->prepare("SELECT COUNT(*) FROM registrations WHERE eventId = ?");
$countStmt->execute([$eventId]);
$count = $countStmt->fetchColumn();

echo json_encode([
    'config' => json_decode($event['config']),
    'registrationCount' => (int)$count,
    'sessions' => [], // Placeholder for expansion
    'speakers' => [],
    'sponsors' => [],
    'ticketTiers' => []
]);
