import 'package:flutter_test/flutter_test.dart';
import 'package:echos/utils/session_formatter.dart';

void main() {
  final now = DateTime(2024, 6, 11, 15, 30); // Tuesday

  test('Today shows time', () {
    final lastModified = DateTime(2024, 6, 11, 14, 0);
    final created = lastModified;
    final result = formatSessionSubtitle(
      now: now,
      created: created,
      lastModified: lastModified,
      modifiedPrefix: 'Modified',
    );
    expect(result, '2:00 PM');
  });

  test('Earlier this week shows weekday', () {
    final lastModified = DateTime(2024, 6, 10, 10, 0); // Monday
    final created = lastModified;
    final result = formatSessionSubtitle(
      now: now,
      created: created,
      lastModified: lastModified,
      modifiedPrefix: 'Modified',
    );
    expect(result, 'Monday');
  });

  test('Earlier this year shows date', () {
    final lastModified = DateTime(2024, 3, 5, 10, 0);
    final created = lastModified;
    final result = formatSessionSubtitle(
      now: now,
      created: created,
      lastModified: lastModified,
      modifiedPrefix: 'Modified',
    );
    expect(result, 'Mar 5');
  });

  test('Previous year shows date and year', () {
    final lastModified = DateTime(2023, 3, 5, 10, 0);
    final created = lastModified;
    final result = formatSessionSubtitle(
      now: now,
      created: created,
      lastModified: lastModified,
      modifiedPrefix: 'Modified',
    );
    expect(result, 'Mar 5, 2023');
  });

  test('Modified prefix is added', () {
    final created = DateTime(2024, 6, 1, 11, 0);
    final lastModified = DateTime(2024, 6, 11, 14, 0);
    final result = formatSessionSubtitle(
      now: now,
      created: created,
      lastModified: lastModified,
      modifiedPrefix: 'Modified',
    );
    expect(result, 'Modified 2:00 PM');
  });
}
