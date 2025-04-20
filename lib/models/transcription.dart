class Transcription {
  final String id;
  final String sessionId;
  final String text;
  final DateTime timestamp;
  final String audioPath;

  Transcription({
    required this.id,
    this.sessionId = 'default_session',
    required this.text,
    required this.timestamp,
    required this.audioPath,
  });

  factory Transcription.fromJson(Map<String, dynamic> json) {
    return Transcription(
      id: json['id'],
      sessionId: json['sessionId'] ?? 'default_session',
      text: json['text'],
      timestamp: DateTime.parse(json['timestamp']),
      audioPath: json['audioPath'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'sessionId': sessionId,
      'text': text,
      'timestamp': timestamp.toIso8601String(),
      'audioPath': audioPath,
    };
  }
}
