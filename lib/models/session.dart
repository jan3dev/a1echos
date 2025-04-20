class Session {
  final String id;
  String name;
  final DateTime timestamp;

  Session({required this.id, required this.name, required this.timestamp});

  factory Session.fromJson(Map<String, dynamic> json) {
    return Session(
      id: json['id'],
      name: json['name'],
      timestamp: DateTime.parse(json['timestamp']),
    );
  }

  Map<String, dynamic> toJson() {
    return {'id': id, 'name': name, 'timestamp': timestamp.toIso8601String()};
  }
}
