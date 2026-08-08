# Builds libechoslm.so — the JNI bridge for the keyboard LM reranker.
#
# The llama.cpp static libs are prebuilt per ABI by
# scripts/keyboard-lm/build-llama-android.sh into vendor/ (staged next to this
# file by the config plugin). ABIs without vendor libs (armeabi-v7a, x86) get
# a stub that reports "model unavailable", so every ABI links and the Kotlin
# side degrades gracefully.
set(VENDOR ${CMAKE_CURRENT_SOURCE_DIR}/vendor)

add_library(echoslm SHARED llama_jni.cpp)

if(EXISTS ${VENDOR}/${ANDROID_ABI}/libllama.a)
    target_include_directories(echoslm PRIVATE ${VENDOR}/include)
    file(GLOB LLAMA_STATIC_LIBS ${VENDOR}/${ANDROID_ABI}/*.a)
    target_link_libraries(echoslm
        -Wl,--start-group ${LLAMA_STATIC_LIBS} -Wl,--end-group
        android log)
else()
    target_compile_definitions(echoslm PRIVATE ECHOS_LM_STUB)
endif()
