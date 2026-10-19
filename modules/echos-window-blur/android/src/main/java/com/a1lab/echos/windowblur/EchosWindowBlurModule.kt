package com.a1lab.echos.windowblur

import android.animation.ValueAnimator
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
      applyBlur(animate = true)
    }

  private var appliedPx = 0
  private var animator: ValueAnimator? = null

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    applyBlur(animate = false)
  }

  override fun onDetachedFromWindow() {
    animator?.cancel()
    super.onDetachedFromWindow()
  }

  // Radius changes after attach ease in: the blur sits on the window, so a
  // fading parent View can't fade it.
  private fun applyBlur(animate: Boolean) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || !isAttachedToWindow) return
    val root = rootView
    val params = root.layoutParams as? WindowManager.LayoutParams ?: return
    // Never blur behind the activity's own window.
    if (params.type == WindowManager.LayoutParams.TYPE_BASE_APPLICATION) return
    val windowManager = root.context.getSystemService(WindowManager::class.java)
    val setRadius = { px: Int ->
      params.flags = params.flags or WindowManager.LayoutParams.FLAG_BLUR_BEHIND
      params.blurBehindRadius = px
      windowManager.updateViewLayout(root, params)
      appliedPx = px
    }
    val target = (radiusDp * resources.displayMetrics.density).toInt()
    animator?.cancel()
    if (!animate || target == appliedPx) {
      setRadius(target)
      return
    }
    animator = ValueAnimator.ofInt(appliedPx, target).apply {
      duration = RADIUS_ANIMATION_MS
      addUpdateListener { if (isAttachedToWindow) setRadius(it.animatedValue as Int) }
      start()
    }
  }

  private companion object {
    // Matches the JS backdrop fade (TranscriptionSettingsSheet CLOSE_FADE_MS).
    const val RADIUS_ANIMATION_MS = 200L
  }
}
