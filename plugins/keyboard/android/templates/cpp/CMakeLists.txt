# React Native's default app CMake setup, plus the keyboard LM reranker.
#
# A Gradle module has exactly one `externalNativeBuild.cmake.path`, and RN only
# installs its own default when that path is still null
# (@react-native/gradle-plugin NdkConfiguratorUtils, inside `finalizeDsl`, which
# runs after this project's build.gradle is evaluated). Because the config
# plugin points that single slot here, RN silently skips
# `ReactAndroid/cmake-utils/default-app-setup/CMakeLists.txt` — so `appmodules`
# would never be built. That library carries OnLoad.cpp, which installs the
# TurboModule and Fabric component providers, plus the generated descriptors for
# autolinked packages. Without it SoLoader can't find libappmodules.so and the
# first `TurboModuleRegistry.getEnforcing` call — RN's own 'PlatformConstants',
# from InitializeCore — throws before any app code runs. So this file mirrors
# RN's documented "copy the default CMakeLists into your project" path and pulls
# echoslm in as a subdirectory.
#
# echoslm lives in a subdirectory on purpose: ReactNative-application.cmake
# globs `*.cpp` next to this file and, when it finds any, treats them as a
# replacement for RN's default OnLoad.cpp. Keeping this directory free of .cpp
# sources is what lets RN compile its own.
cmake_minimum_required(VERSION 3.22)
project(appmodules)

include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

add_subdirectory(echoslm)
