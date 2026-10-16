package com.a1lab.echos.windowblur

import android.content.Context
import android.os.Build
import android.view.WindowManager
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.views.ExpoView

class EchosWindowBlurModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("EchosWindowBlur")

    View(EchosWindowBlurView::class) {
      Prop("radius") { view: EchosWindowBlurView, radius: Float ->
        view.radiusDp = radius
      }
    }
  }
}

// RN's Modal is its own Dialog window, out of reach of expo-blur's
// BlurTargetView, so the compositor blurs whatever is behind that window.
class EchosWindowBlurView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  var radiusDp = 0f
    set(value) {
      field = value
      applyBlur()
    }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    applyBlur()
  }

  private fun applyBlur() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || !isAttachedToWindow) return
    val root = rootView
    val params = root.layoutParams as? WindowManager.LayoutParams ?: return
    // Never blur behind the activity's own window.
    if (params.type == WindowManager.LayoutParams.TYPE_BASE_APPLICATION) return
    params.flags = params.flags or WindowManager.LayoutParams.FLAG_BLUR_BEHIND
    params.blurBehindRadius = (radiusDp * resources.displayMetrics.density).toInt()
    root.context.getSystemService(WindowManager::class.java).updateViewLayout(root, params)
  }
}
