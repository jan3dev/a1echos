import 'dart:convert';
import 'dart:math';

import 'package:encrypt/encrypt.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class EncryptionService {
  static const _keyStorageKey = 'aes_data_key';
  final _secureStorage = FlutterSecureStorage();

  Future<Encrypter> _getEncrypter() async {
    // 1) Fetch or generate a 256-bit key
    String? base64Key = await _secureStorage.read(key: _keyStorageKey);
    if (base64Key == null) {
      final keyBytes = List<int>.generate(
        32,
        (_) => Random.secure().nextInt(256),
      );
      base64Key = base64Encode(keyBytes);
      await _secureStorage.write(key: _keyStorageKey, value: base64Key);
    }

    final key = Key(base64Decode(base64Key));
    return Encrypter(AES(key, mode: AESMode.cbc, padding: 'PKCS7'));
  }

  Future<String> encrypt(String plainText) async {
    final encrypter = await _getEncrypter();
    // Generate a fresh 16‑byte IV on each encrypt
    final iv = IV.fromSecureRandom(16);
    final encrypted = encrypter.encrypt(plainText, iv: iv);
    // Prepend IV so we can extract it on decrypt
    return '${iv.base64}:${encrypted.base64}';
  }

  Future<String> decrypt(String cipherText) async {
    final encrypter = await _getEncrypter();
    final parts = cipherText.split(':');
    final iv = IV.fromBase64(parts[0]);
    final encrypted = Encrypted.fromBase64(parts[1]);
    return encrypter.decrypt(encrypted, iv: iv);
  }
}
