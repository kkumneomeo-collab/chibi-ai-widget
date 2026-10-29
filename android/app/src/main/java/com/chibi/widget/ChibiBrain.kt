package com.chibi.widget

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import kotlin.random.Random

data class ChibiResponse(
    val text: String,
    val emoji: String
)

object ChibiBrain {

    private val jokes = listOf(
        ChibiResponse("Why did the cloud stay in bed all day? Because it was feeling a little under the weather! ☁️😹", "😹"),
        ChibiResponse("What do you call a computer that sings? A Dell! 🎵💻", "😆"),
        ChibiResponse("Why do cats love coding? Because they are purr-fect at catching bugs! 🐾🐛", "😺"),
        ChibiResponse("What happens when clouds get rich? They make it rain! 🌧️💸", "✨"),
        ChibiResponse("Why did the smartphone need glasses? Because it lost all its contacts! 👓📱", "😸")
    )

    private val inspirations = listOf(
        ChibiResponse("You're doing amazing! Take a deep breath and keep shining! 💖✨", "💖"),
        ChibiResponse("Even the heaviest storm clouds eventually clear for bright sunshine! ☁️🌈", "🌸"),
        ChibiResponse("One gentle step at a time is how we reach the stars! 🌟🐾", "⭐"),
        ChibiResponse("I'm always cheering for you right here on my cloud! ☁️🥰", "🥰"),
        ChibiResponse("Remember to drink a glass of water and rest your eyes! 💧🌸", "💖")
    )

    private val facts = listOf(
        ChibiResponse("Did you know? A single fluffy cumulus cloud can weigh over 1 million pounds (500,000 kg)! ☁️✨", "☁️"),
        ChibiResponse("Sunlight takes about 8 minutes and 20 seconds to travel from the Sun to Earth! ☀️🚀", "🌟"),
        ChibiResponse("Cats spend about 70% of their lives sleeping or napping! 🐾💤", "😴"),
        ChibiResponse("Honey never spoils! Archaeologists have found 3,000-year-old edible honey in tombs! 🍯✨", "🍯"),
        ChibiResponse("The Moon drifts about 3.8 cm farther away from Earth each year! 🌙🔭", "🌙")
    )

    private val pokeReactions = listOf(
        ChibiResponse("Poke! Hehe, that tickles! (≧◡≦) ☁️", "✨"),
        ChibiResponse("Floating high up in the sky with you! 💖", "💖"),
        ChibiResponse("Boing! Soft as a cloud! ☁️🌸", "🌸"),
        ChibiResponse("Besties forever! (◕‿◕)🐾", "🥰"),
        ChibiResponse("Ready to bongo or answer anything! 🎹✨", "✨")
    )

    fun getRandomJoke(): ChibiResponse = jokes.random()

    fun getRandomInspiration(): ChibiResponse = inspirations.random()

    fun getRandomFact(): ChibiResponse = facts.random()

    fun getPokeReaction(): ChibiResponse = pokeReactions.random()

    fun getRandomMath(): ChibiResponse {
        val a = Random.nextInt(12, 89)
        val b = Random.nextInt(7, 45)
        val op = Random.nextInt(3)
        return when (op) {
            0 -> ChibiResponse("Quick math: $a + $b = ${a + b}! 🔢✨", "🔢")
            1 -> ChibiResponse("Quick math: $a - $b = ${a - b}! 🔢✨", "🔢")
            else -> {
                val m1 = Random.nextInt(6, 15)
                val m2 = Random.nextInt(4, 12)
                ChibiResponse("Quick math: $m1 × $m2 = ${m1 * m2}! 🔢✨", "🔢")
            }
        }
    }

    fun solveMath(prompt: String): ChibiResponse? {
        val clean = prompt.replace(Regex("[^0-9+\\-*/]"), "").trim()
        if (clean.length >= 3 && clean.any { it.isDigit() }) {
            try {
                if (clean.contains("+")) {
                    val p = clean.split("+")
                    if (p.size == 2) return ChibiResponse("That's ${p[0].trim().toLong() + p[1].trim().toLong()}! 🔢✨", "🔢")
                } else if (clean.contains("-")) {
                    val p = clean.split("-")
                    if (p.size == 2) return ChibiResponse("That's ${p[0].trim().toLong() - p[1].trim().toLong()}! 🔢✨", "🔢")
                } else if (clean.contains("*")) {
                    val p = clean.split("*")
                    if (p.size == 2) return ChibiResponse("That's ${p[0].trim().toLong() * p[1].trim().toLong()}! 🔢✨", "🔢")
                } else if (clean.contains("/")) {
                    val p = clean.split("/")
                    if (p.size == 2 && p[1].trim().toLong() != 0L) {
                        return ChibiResponse("That's ${p[0].trim().toDouble() / p[1].trim().toDouble()}! 🔢✨", "🔢")
                    }
                }
            } catch (_: Exception) {}
        }
        return null
    }

    suspend fun askFreeAI(prompt: String): ChibiResponse = withContext(Dispatchers.IO) {
        // 1. Instant math evaluation
        solveMath(prompt)?.let { return@withContext it }

        val p = prompt.trim()

        // 2. Pollinations AI POST
        try {
            val url = URL("https://text.pollinations.ai/")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                connectTimeout = 12000
                readTimeout = 12000
                doOutput = true
            }

            val body = JSONObject().apply {
                val messages = JSONArray().apply {
                    put(JSONObject().apply {
                        put("role", "system")
                        put("content", "You are Chibi, a cute anime desktop pet standing on a fluffy cloud. Answer accurately and very concisely (1-2 sentences) with a cute emoji.")
                    })
                    put(JSONObject().apply {
                        put("role", "user")
                        put("content", p)
                    })
                }
                put("messages", messages)
                put("seed", Random.nextInt(100000, 999999))
            }

            OutputStreamWriter(conn.outputStream).use { it.write(body.toString()) }

            if (conn.responseCode == 200) {
                val responseText = BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }.trim()
                if (responseText.isNotEmpty() && !responseText.contains("Free limit") && !responseText.contains("budget")) {
                    return@withContext ChibiResponse(responseText, "✨")
                }
            }
        } catch (_: Exception) {}

        // 3. Pollinations AI GET fallback
        try {
            val enc = URLEncoder.encode(p, "UTF-8")
            val seed = Random.nextInt(100000, 999999)
            val url = URL("https://text.pollinations.ai/$enc?seed=$seed")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 8000
                readTimeout = 8000
            }
            if (conn.responseCode == 200) {
                val text = BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }.trim()
                if (text.isNotEmpty() && !text.contains("Free limit") && !text.contains("budget")) {
                    return@withContext ChibiResponse(text, "☁️")
                }
            }
        } catch (_: Exception) {}

        // 4. Offline smart fallback
        val lower = p.lowercase()
        return@withContext when {
            lower.contains("joke") -> getRandomJoke()
            lower.contains("inspire") -> getRandomInspiration()
            lower.contains("fact") -> getRandomFact()
            lower.contains("who are you") || lower.contains("your name") ->
                ChibiResponse("I'm Chibi! Your floating companion standing on my fluffy cloud! ☁️(◕‿◕)✨", "💖")
            else -> ChibiResponse("I'm floating right here with you! What else would you like to explore? ☁️✨", "✨")
        }
    }
}
