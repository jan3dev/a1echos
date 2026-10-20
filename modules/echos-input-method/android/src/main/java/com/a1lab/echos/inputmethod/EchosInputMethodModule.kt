package com.a1lab.echos.inputmethod

import android.content.ComponentName
import android.os.Build
import android.provider.Settings
import android.view.inputmethod.InputMethodManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val IME_SERVICE = "com.a1lab.echos.ime.EchosInputMethodService"

class EchosInputMethodModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val imm
    get() = context.getSystemService(InputMethodManager::class.java)

  override fun definition() = ModuleDefinition {
    Name("EchosInputMethod")

    Constant("imeId") {
      ComponentName(context.packageName, IME_SERVICE).flattenToShortString()
    }

    // Our own package is always visible here, so no <queries> entry is needed.
    Function("isEnabled") {
      imm.enabledInputMethodList.any { it.packageName == context.packageName }
    }

    Function("isSelected") {
      val current = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        imm.currentInputMethodInfo?.id
      } else {
        Settings.Secure.getString(context.contentResolver, Settings.Secure.DEFAULT_INPUT_METHOD)
      }
      current?.let { ComponentName.unflattenFromString(it)?.packageName } == context.packageName
    }

    // The system silently ignores this unless our window has focus, so it
    // must come from a tap in the foreground app, never on launch.
    AsyncFunction("showPicker") {
      imm.showInputMethodPicker()
    }.runOnQueue(Queues.MAIN)
  }
}
