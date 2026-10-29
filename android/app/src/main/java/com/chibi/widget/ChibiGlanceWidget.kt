package com.chibi.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.datastore.preferences.core.Preferences
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.action.actionParametersOf
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider

class ChibiGlanceWidget : GlanceAppWidget() {

    override var stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            GlanceTheme {
                val prefs = currentState<Preferences>()
                val speech = prefs[ChibiWidgetKeys.SPEECH_TEXT] 
                    ?: "Hello! Tap any chip below to chat with me right on your home screen! ☁️✨"
                val expression = prefs[ChibiWidgetKeys.EXPRESSION] ?: "✨"
                val pokeCount = prefs[ChibiWidgetKeys.POKE_COUNT] ?: 0

                ChibiWidgetBody(speech = speech, expression = expression, pokeCount = pokeCount)
            }
        }
    }
}

@Composable
fun ChibiWidgetBody(speech: String, expression: String, pokeCount: Int) {
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .padding(4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // 1. Floating Speech Bubble (Above Chibi's Head)
        Box(
            modifier = GlanceModifier
                .fillMaxWidth()
                .background(ImageProvider(R.drawable.bubble_bg))
                .padding(horizontal = 10.dp, vertical = 6.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = speech,
                style = TextStyle(
                    color = ColorProvider(Color(0xFF1E293B)),
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                ),
                maxLines = 3
            )
        }

        Spacer(modifier = GlanceModifier.height(4.dp))

        // 2. Chibi Character Standing on the Fluffy Cloud (Tap to Poke!)
        Box(
            modifier = GlanceModifier
                .clickable(actionRunCallback<ChibiActionCallback>(actionParametersOf(ActionTypeKey to "poke"))),
            contentAlignment = Alignment.BottomCenter
        ) {
            // Chibi Character Sprite
            Image(
                provider = ImageProvider(R.drawable.chibi_standing),
                contentDescription = "Chibi",
                modifier = GlanceModifier.size(width = 95.dp, height = 135.dp)
            )

            // Cloud Pedestal under feet
            Image(
                provider = ImageProvider(R.drawable.cloud_pedestal),
                contentDescription = "Cloud Pedestal",
                modifier = GlanceModifier
                    .size(width = 115.dp, height = 55.dp)
                    .padding(top = 90.dp)
            )
        }

        Spacer(modifier = GlanceModifier.height(6.dp))

        // 3. Quick Action Chips Row (Zero Keyboard, 0% Battery Drain)
        Row(
            modifier = GlanceModifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            GlanceChip(label = "😆 Joke", action = "joke")
            Spacer(modifier = GlanceModifier.width(4.dp))
            GlanceChip(label = "💖 Inspire", action = "inspire")
            Spacer(modifier = GlanceModifier.width(4.dp))
            GlanceChip(label = "🌟 Fact", action = "fact")
            Spacer(modifier = GlanceModifier.width(4.dp))
            GlanceChip(label = "🔢 Math", action = "math")
        }
    }
}

@Composable
fun GlanceChip(label: String, action: String) {
    Box(
        modifier = GlanceModifier
            .background(ImageProvider(R.drawable.chip_bg))
            .padding(horizontal = 7.dp, vertical = 4.dp)
            .clickable(actionRunCallback<ChibiActionCallback>(actionParametersOf(ActionTypeKey to action))),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            style = TextStyle(
                color = ColorProvider(Color(0xFF334155)),
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold
            )
        )
    }
}

