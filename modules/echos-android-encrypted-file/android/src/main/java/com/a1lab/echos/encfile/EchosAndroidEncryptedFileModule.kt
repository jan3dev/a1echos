package com.a1lab.echos.encfile

import android.content.Context
import androidx.security.crypto.EncryptedFile
import androidx.security.crypto.MasterKey
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream

class EchosAndroidEncryptedFileModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("EchosAndroidEncryptedFile")

    AsyncFunction("copyToEncrypted") { srcPath: String, dstPath: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val srcFile = File(stripFileScheme(srcPath))
      val dstFile = File(stripFileScheme(dstPath))

      if (!srcFile.exists()) {
        throw IllegalArgumentException("Source file does not exist: ${srcFile.absolutePath}")
      }
      // EncryptedFile refuses to write to an existing file — delete first.
      if (dstFile.exists()) {
        dstFile.delete()
      }
      dstFile.parentFile?.mkdirs()

      val encryptedFile = buildEncryptedFile(context, dstFile)
      FileInputStream(srcFile).use { input ->
        encryptedFile.openFileOutput().use { output -> input.copyTo(output) }
      }
    }

    AsyncFunction("decryptToCacheFile") { srcPath: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val srcFile = File(stripFileScheme(srcPath))
      if (!srcFile.exists()) {
        throw IllegalArgumentException("Encrypted file does not exist: ${srcFile.absolutePath}")
      }
      val cacheFile = File(context.cacheDir, "dec_${System.currentTimeMillis()}_${srcFile.name}")
      val encryptedFile = buildEncryptedFile(context, srcFile)
      encryptedFile.openFileInput().use { input ->
        FileOutputStream(cacheFile).use { output -> input.copyTo(output) }
      }
      return@AsyncFunction cacheFile.absolutePath
    }

    AsyncFunction("isEncrypted") { path: String ->
      val file = File(stripFileScheme(path))
      if (!file.exists() || file.length() < 8) return@AsyncFunction false
      // Tink streaming AEAD prepends a 5-byte header — first byte is the version (0x01 today).
      val firstByte = FileInputStream(file).use { it.read() }
      return@AsyncFunction firstByte == 0x01
    }

    AsyncFunction("deleteFile") { path: String ->
      val file = File(stripFileScheme(path))
      if (file.exists()) {
        file.delete()
      }
    }
  }

  private fun buildEncryptedFile(context: Context, file: File): EncryptedFile {
    val masterKey = MasterKey.Builder(context)
      .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
      .build()
    return EncryptedFile.Builder(
      context,
      file,
      masterKey,
      EncryptedFile.FileEncryptionScheme.AES256_GCM_HKDF_4KB
    ).build()
  }

  private fun stripFileScheme(path: String): String {
    return if (path.startsWith("file://")) path.removePrefix("file://") else path
  }
}
