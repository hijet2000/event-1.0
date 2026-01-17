
<?php
declare(strict_types=1);

class GeminiService {
    private string $apiKey;
    private string $baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/";

    public function __construct() {
        // Exclusively from environment variable
        $this->apiKey = getenv('API_KEY') ?: '';
    }

    /**
     * Generates personalized registration email content using gemini-3-flash-preview.
     */
    public function generateConfirmationEmail(array $userData, array $eventData): array {
        $model = 'gemini-3-flash-preview';
        $prompt = "Create a personalized welcome email for an event attendee. 
                   Name: {$userData['name']}
                   Event: {$eventData['name']}
                   Goals: {$userData['goals']}
                   Return a JSON object with 'subject' and 'body' keys.";

        $payload = [
            "contents" => [
                ["parts" => [["text" => $prompt]]]
            ],
            "generationConfig" => [
                "responseMimeType" => "application/json"
            ]
        ];

        return $this->callApi($model, $payload);
    }

    private function callApi(string $model, array $payload): array {
        $url = $this->baseUrl . $model . ":generateContent?key=" . $this->apiKey;

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        
        $response = curl_exec($ch);
        $err = curl_error($ch);
        curl_close($ch);

        if ($err) return ['subject' => 'Registration Confirmed', 'body' => 'Welcome to the event!'];

        $result = json_decode($response, true);
        $text = $result['candidates'][0]['content']['parts'][0]['text'] ?? '{}';
        
        return json_decode($text, true) ?: ['subject' => 'Registration Confirmed', 'body' => 'Welcome to the event!'];
    }
}
?>
