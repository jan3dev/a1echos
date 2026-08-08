package com.a1lab.echos.ime

import java.io.File
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.BeforeClass
import org.junit.Test

/**
 * JVM parity suite for the Kotlin correction engine: replays the fixtures in
 * `data/keyboard-dictionary/parity-fixtures.json` (generated from decoder.js,
 * the reference implementation) and fails on any divergence. The dictionary,
 * confusables table, and fixtures are read straight out of
 * data/keyboard-dictionary — `withAndroidIme.js` puts that directory on the
 * test resource path, so the suite can never replay a stale copy.
 *
 * This file and that Gradle wiring are both generated, so `android/` must exist
 * first:
 *
 *   npx expo prebuild -p android
 *   npm run test:parity:android
 */
class CorrectionEngineParityTest {

    companion object {
        private lateinit var engine: CorrectionEngine
        private lateinit var fixtures: JSONObject

        private fun resource(name: String): ByteArray =
            checkNotNull(
                CorrectionEngineParityTest::class.java.classLoader
                    ?.getResourceAsStream(name)
            ) { "missing test resource $name" }.use { it.readBytes() }

        /** Every string in a fixture array, in order. */
        private fun JSONArray.strings(): List<String> =
            (0 until length()).map { getString(it) }

        /** A fixture field that is either a string or JSON null. */
        private fun JSONObject.stringOrNull(key: String): String? =
            if (isNull(key)) null else getString(key)

        @BeforeClass
        @JvmStatic
        fun setUp() {
            // A never-loaded lexicon: empty, no blacklist, writes nothing.
            engine = CorrectionEngine(
                UserLexicon(File(System.getProperty("java.io.tmpdir") ?: "."))
            )
            engine.load(
                resource("keyboard_dictionary.echd"),
                resource("confusables.json").toString(Charsets.UTF_8),
                verifyChecksum = true,
            )
            check(engine.isLoaded) { "engine failed to load (bad header or CRC)" }
            fixtures = JSONObject(
                resource("parity-fixtures.json").toString(Charsets.UTF_8)
            )
        }
    }

    @Test
    fun evaluateMatchesReference() {
        val vectors = fixtures.getJSONArray("evaluate")
        for (i in 0 until vectors.length()) {
            val v = vectors.getJSONObject(i)
            val typed = v.getString("typed")
            val prevWord = v.stringOrNull("prevWord")
            val touches = if (v.isNull("touches")) {
                null
            } else {
                val arr = v.getJSONArray("touches")
                (0 until arr.length()).map { j ->
                    arr.optJSONObject(j)?.let {
                        CorrectionEngine.TouchPoint(
                            it.getDouble("x").toFloat(),
                            it.getDouble("y").toFloat(),
                        )
                    }
                }
            }
            val label = "evaluate($typed${prevWord?.let { ", prev=$it" } ?: ""})"
            val r = engine.evaluate(typed, prevWord, false, touches)
            assertEquals(
                "$label candidates",
                v.getJSONArray("candidates").strings(),
                r.candidates,
            )
            assertEquals(
                "$label topIsCorrection",
                v.getBoolean("topIsCorrection"),
                r.topIsCorrection,
            )
            assertEquals("$label replacement", v.stringOrNull("replacement"), r.replacement)
            assertEquals("$label verbatim", v.stringOrNull("verbatim"), r.verbatim)
        }
    }

    @Test
    fun nextWordsMatchesReference() {
        val vectors = fixtures.getJSONArray("nextWords")
        for (i in 0 until vectors.length()) {
            val v = vectors.getJSONObject(i)
            val prevWord = v.getString("prevWord")
            assertEquals(
                "nextWords($prevWord)",
                v.getJSONArray("predictions").strings(),
                engine.nextWords(prevWord),
            )
        }
    }

    @Test
    fun nextCharWeightsMatchReference() {
        val vectors = fixtures.getJSONArray("nextCharWeights")
        for (i in 0 until vectors.length()) {
            val v = vectors.getJSONObject(i)
            val prefix = v.getString("prefix")
            val expected = v.getJSONObject("weights")
            val actual = engine.nextCharWeights(prefix)
            assertEquals(
                "nextCharWeights($prefix) keys",
                expected.keys().asSequence().toSet(),
                actual.keys.map { it.toString() }.toSet(),
            )
            // Exact, not tolerant: both sides are quantized to 4 decimals by
            // construction, so a tolerance would mask an off-by-one-quantum
            // rounding divergence — exactly the ties-to-even bug that
            // kotlin.math.round used to introduce here.
            for (key in expected.keys()) {
                val want = expected.getDouble(key)
                val got = (actual.getValue(key[0]).toDouble() * 10000).let {
                    Math.round(it) / 10000.0
                }
                assertEquals("nextCharWeights($prefix) [$key]", want, got, 0.0)
            }
        }
    }

    /**
     * Deterministic stand-in for the llama.cpp reranker, mirroring the stub
     * in generate-parity-fixtures.js: context -> word -> logprob, unknown
     * word -10, unknown context -> null ("model unavailable").
     */
    private class StubReranker(
        private val table: Map<String, Map<String, Double>>,
    ) : LmRerankerProviding {
        override fun scores(leftContext: String, words: List<String>): FloatArray? {
            val row = table[leftContext] ?: return null
            return FloatArray(words.size) { (row[words[it]] ?: -10.0).toFloat() }
        }
    }

    @Test
    fun lmRerankMatchesReference() {
        val vectors = fixtures.getJSONArray("lmRerank")
        check(vectors.length() > 0) { "fixture section 'lmRerank' is empty" }
        for (i in 0 until vectors.length()) {
            val v = vectors.getJSONObject(i)
            val typed = v.getString("typed")
            val leftContext = v.getString("leftContext")
            val stubJson = v.getJSONObject("stub")
            val table = stubJson.keys().asSequence().associateWith { ctx ->
                val row = stubJson.getJSONObject(ctx)
                row.keys().asSequence().associateWith { row.getDouble(it) }
            }
            val label = "lmRerank($typed, ctx=$leftContext)"
            val r = engine.evaluate(
                typed,
                v.stringOrNull("prevWord"),
                externallyValid = false,
                touchPoints = null,
                leftContext = leftContext,
                reranker = StubReranker(table),
                lmStrength = v.getDouble("lmStrength").toFloat(),
            )
            assertEquals(
                "$label candidates",
                v.getJSONArray("candidates").strings(),
                r.candidates,
            )
            assertEquals(
                "$label topIsCorrection",
                v.getBoolean("topIsCorrection"),
                r.topIsCorrection,
            )
            assertEquals("$label replacement", v.stringOrNull("replacement"), r.replacement)
            assertEquals("$label verbatim", v.stringOrNull("verbatim"), r.verbatim)
        }
    }

    @Test
    fun confusablesMatchReference() {
        val vectors = fixtures.getJSONArray("confusables")
        for (i in 0 until vectors.length()) {
            val v = vectors.getJSONObject(i)
            val prev = v.getString("prevWord")
            val next = v.getString("nextWord")
            assertEquals(
                "confusable($prev $next)",
                if (v.isNull("contraction")) null else v.getString("contraction"),
                engine.contextualContraction(prev, next),
            )
        }
    }
}
