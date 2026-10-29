package com.chibi.widget

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
}
