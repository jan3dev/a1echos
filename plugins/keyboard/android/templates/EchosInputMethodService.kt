package com.a1lab.echos.ime

import android.content.Context
import android.content.res.Configuration
import android.inputmethodservice.InputMethodService
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.LinearLayout

/**
 * Echos system keyboard with voice transcription.
 *
 * Layout (vertical):
 *   1. Echos top bar — logo + record/stop button driving transcription.
 *   2. Echos keyboard view — the key grid.
 *
 * Transcription runs in the same process as the main app, via
 * [ImeSherpaTranscriber] which calls sherpa-onnx directly.
 */
class EchosInputMethodService : InputMethodService(), EchosKeyboardView.KeyboardActionListener,
    EchosKeyboardTopBar.Listener {

    private lateinit var container: LinearLayout
    private lateinit var topBar: EchosKeyboardTopBar
    private lateinit var keyboardView: EchosKeyboardView
    private lateinit var transcriber: ImeSherpaTranscriber
    private var currentEditorAction: Int = EditorInfo.IME_ACTION_NONE

    override fun onCreate() {
        super.onCreate()
        transcriber = ImeSherpaTranscriber(this)
    }

    override fun onCreateInputView(): View {
        container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            )
        }

        topBar = EchosKeyboardTopBar(this).apply {
            val h = resources.getIdentifier("keyboard_top_bar_height", "dimen", packageName)
                .let { if (it != 0) resources.getDimensionPixelSize(it) else (48 * resources.displayMetrics.density).toInt() }
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, h)
            setListener(this@EchosInputMethodService)
        }

        keyboardView = EchosKeyboardView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            )
            setKeyboardActionListener(this@EchosInputMethodService)
        }

        container.addView(topBar)
        container.addView(keyboardView)
        return container
    }

    override fun onStartInputView(info: EditorInfo, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        currentEditorAction = info.imeOptions and EditorInfo.IME_MASK_ACTION
        keyboardView.updateReturnKeyType(currentEditorAction)

        val inputType = info.inputType and android.text.InputType.TYPE_MASK_CLASS
        when (inputType) {
            android.text.InputType.TYPE_CLASS_NUMBER,
            android.text.InputType.TYPE_CLASS_PHONE -> keyboardView.showNumberLayout()
            android.text.InputType.TYPE_CLASS_TEXT -> keyboardView.showLetterLayout()
            else -> keyboardView.showLetterLayout()
        }
    }

    override fun onFinishInputView(finishingInput: Boolean) {
        super.onFinishInputView(finishingInput)
        transcriber.cancelIfActive()
        topBar.setMicState(MicState.IDLE)
    }

    override fun onDestroy() {
        transcriber.release()
        super.onDestroy()
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        // Theme and orientation changes are handled by recreating the view
    }

    // -- KeyboardActionListener --

    override fun onKeyPress(char: String) {
        currentInputConnection?.commitText(char, 1)
    }

    override fun onDeletePress() {
        currentInputConnection?.deleteSurroundingText(1, 0)
    }

    override fun onSpacePress() {
        currentInputConnection?.commitText(" ", 1)
    }

    override fun onReturnPress() {
        val ic = currentInputConnection ?: return
        if (currentEditorAction != EditorInfo.IME_ACTION_NONE) {
            ic.performEditorAction(currentEditorAction)
        } else {
            ic.commitText("\n", 1)
        }
    }

    /** Legacy bottom-row mic — the button is gone from the layout, but keep
     *  the hooks so a stale layout doesn't crash. */
    override fun onMicPress() = toggleRecording()
    override fun onMicRelease() { /* toggle on press, no action on release */ }

    override fun onEmojiPress() {
        // Android doesn't expose a direct "open emoji keyboard" API to third-
        // party IMEs. Cycling to the next installed IME is the closest
        // equivalent — works when the user has Gboard / emoji keyboard
        // installed alongside Echos.
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager ?: return
        val token = window?.window?.attributes?.token
        if (token != null) {
            @Suppress("DEPRECATION")
            imm.switchToNextInputMethod(token, false)
        } else {
            imm.showInputMethodPicker()
        }
    }

    override fun onSwitchKeyboard() {
        switchToNextInputMethod(false)
    }

    // -- TopBar.Listener --

    override fun onRecordClick() {
        toggleRecording()
    }

    // -- Transcription --

    private var micState: MicState = MicState.IDLE

    private fun setMicState(state: MicState) {
        micState = state
        topBar.setMicState(state)
    }

    private fun toggleRecording() {
        when (micState) {
            MicState.RECORDING -> {
                setMicState(MicState.TRANSCRIBING)
                transcriber.stopRecording()
            }
            MicState.TRANSCRIBING -> Unit // Ignore taps while transcribing.
            MicState.IDLE -> startTranscription()
        }
    }

    private fun startTranscription() {
        if (!RecordingLock.tryAcquire("ime")) {
            setMicState(MicState.IDLE)
            return
        }
        setMicState(MicState.RECORDING)
        transcriber.startTranscription(
            onResult = { text ->
                currentInputConnection?.commitText(text, 1)
                setMicState(MicState.IDLE)
                RecordingLock.release("ime")
            },
            onError = {
                setMicState(MicState.IDLE)
                RecordingLock.release("ime")
            },
            onTranscribing = {
                setMicState(MicState.TRANSCRIBING)
            }
        )
    }
}

enum class MicState {
    IDLE, RECORDING, TRANSCRIBING
}
