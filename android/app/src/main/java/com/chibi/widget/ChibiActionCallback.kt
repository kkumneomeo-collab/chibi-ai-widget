package com.chibi.widget

import android.content.Context
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.glance.GlanceId
import androidx.glance.action.ActionParameters
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.state.PreferencesGlanceStateDefinition

object ChibiWidgetKeys {
    val SPEECH_TEXT = stringPreferencesKey("chibi_speech_text")
    val EXPRESSION = stringPreferencesKey("chibi_expression")
    val POKE_COUNT = intPreferencesKey("chibi_poke_count")
}

val ActionTypeKey = ActionParameters.Key<String>("action_type")

class ChibiActionCallback : ActionCallback {
    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        val action = parameters[ActionTypeKey] ?: "poke"
        val response = when (action) {
            "joke" -> ChibiBrain.getRandomJoke()
            "inspire" -> ChibiBrain.getRandomInspiration()
            "fact" -> ChibiBrain.getRandomFact()
            "math" -> ChibiBrain.getRandomMath()
            else -> ChibiBrain.getPokeReaction()
        }

        updateAppWidgetState(context, PreferencesGlanceStateDefinition, glanceId) { prefs ->
            prefs.toMutablePreferences().apply {
                this[ChibiWidgetKeys.SPEECH_TEXT] = response.text
                this[ChibiWidgetKeys.EXPRESSION] = response.emoji
                if (action == "poke") {
                    val count = (this[ChibiWidgetKeys.POKE_COUNT] ?: 0) + 1
                    this[ChibiWidgetKeys.POKE_COUNT] = count
                }
            }
        }

        ChibiGlanceWidget().update(context, glanceId)
    }
}

