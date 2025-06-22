import 'package:intl/intl.dart';

String formatSessionSubtitle({
  required DateTime now,
  required DateTime created,
  required DateTime lastModified,
  required String modifiedPrefix,
}) {
  String dateStr;
  if (_isSameDay(now, lastModified)) {
    dateStr = DateFormat('h:mm a').format(lastModified);
  } else if (_isSameWeek(now, lastModified)) {
    dateStr = DateFormat('EEEE').format(lastModified);
  } else if (now.year == lastModified.year) {
    dateStr = DateFormat('MMM d').format(lastModified);
  } else {
    dateStr = DateFormat('MMM d, yyyy').format(lastModified);
  }
  final isModified = lastModified.difference(created).inSeconds > 0;
  return isModified ? '$modifiedPrefix $dateStr' : dateStr;
}

bool _isSameDay(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;

bool _isSameWeek(DateTime a, DateTime b) {
  final aMonday = a.subtract(Duration(days: a.weekday - 1));
  final bMonday = b.subtract(Duration(days: b.weekday - 1));
  return _isSameDay(aMonday, bMonday) && a.year == b.year;
}
