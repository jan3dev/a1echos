class Session {
  final String id;
  String name;
  final DateTime timestamp;
  DateTime lastModified;
  bool isTemporary;

  Session({
    required this.id,
    required this.name,
    required this.timestamp,
    DateTime? lastModified,
    this.isTemporary = false,
  }) : lastModified = lastModified ?? timestamp;

  factory Session.fromJson(Map<String, dynamic> json) {
    return Session(
      id: json['id'],
      name: json['name'],
      timestamp: DateTime.parse(json['timestamp']),
      lastModified: json.containsKey('lastModified')
          ? DateTime.parse(json['lastModified'])
          : DateTime.parse(json['timestamp']),
      isTemporary: json['isTemporary'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'timestamp': timestamp.toIso8601String(),
      'lastModified': lastModified.toIso8601String(),
      'isTemporary': isTemporary,
    };
  }
}
