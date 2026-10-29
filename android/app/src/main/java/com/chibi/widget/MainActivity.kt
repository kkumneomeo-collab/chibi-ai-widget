package com.chibi.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast

class MainActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val layout = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setPadding(48, 80, 48, 48)
            gravity = android.view.Gravity.CENTER_HORIZONTAL
            setBackgroundColor(android.graphics.Color.parseColor("#F0FDF4"))
        }

        val title = TextView(this).apply {
            text = "☁️ Chibi on Cloud Widget"
            textSize = 22f
            setTypeface(null, android.graphics.Typeface.BOLD)
            setTextColor(android.graphics.Color.parseColor("#1E293B"))
            gravity = android.view.Gravity.CENTER
        }
        layout.addView(title)

        val desc = TextView(this).apply {
            text = "\nYour ultra-lightweight Chibi home screen widget is ready!\n\n" +
                    "✨ 0% Battery Drain (No background polling loops)\n" +
                    "☁️ Interactive Quick Action Chips (Joke, Inspire, Fact, Math)\n" +
                    "🐾 Tap Chibi to poke and hear playful reactions!\n\n" +
                    "To add Chibi to your home screen:\n" +
                    "1. Long-press on any empty space on your Home Screen.\n" +
                    "2. Tap 'Widgets'.\n" +
                    "3. Find 'Chibi on Cloud' and drag it to your screen!\n"
            textSize = 14f
            setTextColor(android.graphics.Color.parseColor("#475569"))
            setLineSpacing(4f, 1.2f)
        }
        layout.addView(desc)

        val pinButton = Button(this).apply {
            text = "Add Widget to Home Screen 📌"
            setBackgroundColor(android.graphics.Color.parseColor("#0284C7"))
            setTextColor(android.graphics.Color.WHITE)
            setPadding(32, 24, 32, 24)
            setOnClickListener {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val appWidgetManager = getSystemService(AppWidgetManager::class.java)
                    val provider = ComponentName(this@MainActivity, ChibiWidgetReceiver::class.java)
                    if (appWidgetManager.isRequestPinAppWidgetSupported) {
                        appWidgetManager.requestPinAppWidget(provider, null, null)
                    } else {
                        Toast.makeText(this@MainActivity, "Please add the widget from your home screen launcher!", Toast.LENGTH_LONG).show()
                    }
                } else {
                    Toast.makeText(this@MainActivity, "Long-press your home screen to add the widget!", Toast.LENGTH_LONG).show()
                }
            }
        }
        layout.addView(pinButton)

        setContentView(layout)
    }
}
