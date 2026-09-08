package com.a1lab.echos.ime

import java.nio.file.Files
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Learning rules the parity fixtures cannot cover — they replay an empty
 * lexicon. Mirrors UserLexicon.swift, which has no test harness; keep the
 * two in sync by hand.
 */
class UserLexiconTest {

    private fun freshLexicon(): UserLexicon =
        UserLexicon(Files.createTempDirectory("lexicon").toFile()).also { it.load() }

    @Test
    fun dictionaryWordUsageBoostsFrequencyWithoutLearningTheWord() {
        val lexicon = freshLexicon()
        assertNull(lexicon.usageFreqQ("sats"))
        lexicon.observeCommit("sats", isInDictionary = true)
        lexicon.observeCommit("Sats", isInDictionary = true)
        assertEquals(128, lexicon.usageFreqQ("sats"))
        assertFalse(lexicon.contains("sats"))
        assertTrue(lexicon.allWords().isEmpty())
    }

    @Test
    fun learnedWordsShareTheBoostFormula() {
        val lexicon = freshLexicon()
        lexicon.learnNow("figma")
        assertEquals(lexicon.freqQ("figma"), lexicon.usageFreqQ("figma"))
        assertEquals(listOf("figma"), lexicon.allWords())
    }

    @Test
    fun bigramsAreCountedPerOrderedPair() {
        val lexicon = freshLexicon()
        assertNull(lexicon.bigramCount("stack", "sats"))
        lexicon.observeBigram("stack", "sats")
        lexicon.observeBigram("Stack", "sats")
        assertEquals(2, lexicon.bigramCount("stack", "sats"))
        assertNull(lexicon.bigramCount("sats", "stack"))
    }

    @Test
    fun usageSurvivesFlushAndReload() {
        val dir = Files.createTempDirectory("lexicon").toFile()
        val lexicon = UserLexicon(dir).also { it.load() }
        lexicon.observeCommit("sats", isInDictionary = true)
        lexicon.flush()
        val reloaded = UserLexicon(dir).also { it.load() }
        assertEquals(112, reloaded.usageFreqQ("sats"))
    }
}
