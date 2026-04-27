package com.a1lab.echos.ime

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Settings activity for the Echos keyboard IME.
 * Provides basic configuration and links to system keyboard settings.
 */
class ImeSettingsActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 48, 48, 48)
        }

        val title = TextView(this).apply {
            text = "Echos Keyboard"
            textSize = 24f
            setPadding(0, 0, 0, 32)
        }
        layout.addView(title)

        val description = TextView(this).apply {
            text = "Echos Keyboard provides a full QWERTY keyboard with on-device voice " +
                "transcription powered by sherpa-onnx. Tap the microphone button to dictate " +
                "text in any app."
            textSize = 16f
            setPadding(0, 0, 0, 32)
        }
        layout.addView(description)

        // Model status
        val modelFiles = SherpaModelManager.getModelFiles(this)
        val statusText = TextView(this).apply {
            text = if (modelFiles != null) {
                "Voice model: Ready (${modelFiles.modelType})"
            } else {
                "Voice model: Not loaded. Open the Echos app to set up the model."
            }
            textSize = 14f
            setPadding(0, 0, 0, 32)
        }
        layout.addView(statusText)

        // Open system keyboard settings
        val settingsButton = Button(this).apply {
            text = "Open Keyboard Settings"
            setOnClickListener {
                startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS))
            }
        }
        layout.addView(settingsButton)

        setContentView(layout)
    }
}
