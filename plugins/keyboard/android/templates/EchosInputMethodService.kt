package com.a1lab.echos.ime

import android.content.res.Configuration
import android.inputmethodservice.InputMethodService
import android.view.View
import android.view.inputmethod.EditorInfo

/**
 * Echos system keyboard with voice transcription.
 *
 * Provides a full QWERTY layout with a microphone button that records audio
 * and transcribes it using Whisper (via whisper.rn JNI in the same process).
 */
class EchosInputMethodService : InputMethodService(), EchosKeyboardView.KeyboardActionListener {

    private lateinit var keyboardView: EchosKeyboardView
    private lateinit var transcriber: ImeWhisperTranscriber
    private var currentEditorAction: Int = EditorInfo.IME_ACTION_NONE

    override fun onCreate() {
        super.onCreate()
        transcriber = ImeWhisperTranscriber(this)
    }

    override fun onCreateInputView(): View {
        keyboardView = EchosKeyboardView(this)
        keyboardView.setKeyboardActionListener(this)
        return keyboardView
    }

    override fun onStartInputView(info: EditorInfo, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        currentEditorAction = info.imeOptions and EditorInfo.IME_MASK_ACTION
        keyboardView.updateReturnKeyType(currentEditorAction)

        // Configure keyboard mode based on input type
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

    override fun onMicPress() {
        if (!RecordingLock.tryAcquire("ime")) {
            keyboardView.showMicError("Recording in use by Echos")
            return
        }

        keyboardView.setMicState(MicState.RECORDING)

        transcriber.startTranscription(
            onResult = { text ->
                currentInputConnection?.commitText(text, 1)
                keyboardView.setMicState(MicState.IDLE)
                RecordingLock.release("ime")
            },
            onError = { error ->
                keyboardView.showMicError(error)
                keyboardView.setMicState(MicState.IDLE)
                RecordingLock.release("ime")
            },
            onTranscribing = {
                keyboardView.setMicState(MicState.TRANSCRIBING)
            }
        )
    }

    override fun onMicRelease() {
        transcriber.stopRecording()
    }

    override fun onSwitchKeyboard() {
        switchToNextInputMethod(false)
    }
}

enum class MicState {
    IDLE, RECORDING, TRANSCRIBING
}
