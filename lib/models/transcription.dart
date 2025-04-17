class Transcription {
  final String id;
  final String text;
  final DateTime timestamp;
  final String audioPath;

  Transcription({
    required this.id,
    required this.text,
    required this.timestamp,
    required this.audioPath,
  });

  factory Transcription.fromJson(Map<String, dynamic> json) {
    return Transcription(
      id: json['id'],
      text: json['text'],
      timestamp: DateTime.parse(json['timestamp']),
      audioPath: json['audioPath'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'text': text,
      'timestamp': timestamp.toIso8601String(),
      'audioPath': audioPath,
    };
  }
}
