package com.chibi.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast

class MainActivity : Activity() {

    private lateinit var btnToggleOverlay: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 64, 48, 48)
            gravity = android.view.Gravity.CENTER_HORIZONTAL
            setBackgroundColor(android.graphics.Color.parseColor("#F0FDF4"))
        }

        val title = TextView(this).apply {
            text = "☁️ Chibi Floating Screen Pet"
            textSize = 22f
            setTypeface(null, android.graphics.Typeface.BOLD)
            setTextColor(android.graphics.Color.parseColor("#1E293B"))
            gravity = android.view.Gravity.CENTER
        }
        layout.addView(title)

        val desc = TextView(this).apply {
            text = "\n🌟 Floating Desktop Pet Overlay (Bongo Cat / Shimeji Style):\n" +
                    "• Chibi floats directly over your wallpaper & any open app!\n" +
                    "• Drag her anywhere on your screen.\n" +
                    "• Tap Chibi to poke, giggle, and bounce.\n" +
                    "• Tap the chat prompt to type & ask anything without launching a full app!\n" +
                    "• Interactive Quick Action Chips (Joke, Inspire, Fact, Math).\n"
            textSize = 13.5f
            setTextColor(android.graphics.Color.parseColor("#475569"))
            setLineSpacing(4f, 1.2f)
        }
        layout.addView(desc)

        // Button: Enable / Toggle Floating Screen Pet
        btnToggleOverlay = Button(this).apply {
            textSize = 14f
            setTypeface(null, android.graphics.Typeface.BOLD)
            setBackgroundColor(android.graphics.Color.parseColor("#F472B6"))
            setTextColor(android.graphics.Color.WHITE)
            setPadding(32, 28, 32, 28)
            setOnClickListener {
                handleOverlayButtonClick()
            }
        }
        layout.addView(btnToggleOverlay)

        val spacer = android.view.View(this).apply {
            layoutParams = LinearLayout.LayoutParams(1, 32)
        }
        layout.addView(spacer)

        // Button: Home Screen AppWidget
        val btnAddWidget = Button(this).apply {
            text = "Or Add Home Screen Widget 📌"
            textSize = 13f
            setBackgroundColor(android.graphics.Color.parseColor("#0284C7"))
            setTextColor(android.graphics.Color.WHITE)
            setPadding(32, 20, 32, 20)
            setOnClickListener {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val appWidgetManager = getSystemService(AppWidgetManager::class.java)
                    val provider = ComponentName(this@MainActivity, ChibiWidgetReceiver::class.java)
                    if (appWidgetManager.isRequestPinAppWidgetSupported) {
                        appWidgetManager.requestPinAppWidget(provider, null, null)
                    } else {
                        Toast.makeText(this@MainActivity, "Long-press your home screen to add the widget!", Toast.LENGTH_LONG).show()
                    }
                } else {
                    Toast.makeText(this@MainActivity, "Long-press your home screen to add the widget!", Toast.LENGTH_LONG).show()
                }
            }
        }
        layout.addView(btnAddWidget)

        setContentView(layout)
    }

    override fun onResume() {
        super.onResume()
        updateButtonState()
    }

    private fun updateButtonState() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(this)) {
                btnToggleOverlay.text = "1. Enable 'Display Over Other Apps' 🔓"
                btnToggleOverlay.setBackgroundColor(android.graphics.Color.parseColor("#E11D48"))
            } else {
                btnToggleOverlay.text = "🌟 Launch Chibi Floating Pet On Screen!"
                btnToggleOverlay.setBackgroundColor(android.graphics.Color.parseColor("#10B981"))
            }
        } else {
            btnToggleOverlay.text = "🌟 Launch Chibi Floating Pet On Screen!"
        }
    }

    private fun handleOverlayButtonClick() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:$packageName")
            )
            startActivity(intent)
            Toast.makeText(this, "Please enable 'Allow display over other apps'", Toast.LENGTH_LONG).show()
        } else {
            val serviceIntent = Intent(this, FloatingPetService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent)
            } else {
                startService(serviceIntent)
            }
            Toast.makeText(this, "Chibi is floating on your screen! ☁️✨", Toast.LENGTH_SHORT).show()
            finish() // Return directly to the home screen so they see Chibi floating immediately!
        }
    }
}
