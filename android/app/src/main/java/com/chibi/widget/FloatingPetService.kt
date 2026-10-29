package com.chibi.widget

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlin.math.hypot

class FloatingPetService : Service() {

    private lateinit var windowManager: WindowManager
    private lateinit var overlayView: View
    private lateinit var params: WindowManager.LayoutParams

    private val serviceScope = CoroutineScope(Dispatchers.Main + Job())

    private lateinit var bubbleLayout: LinearLayout
    private lateinit var tvSpeech: TextView
    private lateinit var thinkingProgress: ProgressBar
    private lateinit var characterScene: FrameLayout
    private lateinit var ivChibi: ImageView
    private lateinit var tvBadge: TextView
    private lateinit var btnToggleMenu: TextView
    private lateinit var chatCard: LinearLayout
    private lateinit var etPrompt: EditText
    private lateinit var btnSend: Button
    private lateinit var btnClosePanel: TextView
    private lateinit var btnDismissService: TextView

    private lateinit var chipJoke: TextView
    private lateinit var chipInspire: TextView
    private lateinit var chipFact: TextView
    private lateinit var chipMath: TextView

    private var isKeyboardFocused = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        startForegroundNotification()
        setupOverlay()
    }

    private fun startForegroundNotification() {
        val channelId = "chibi_overlay_channel"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Chibi Screen Pet",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Chibi floating desktop pet companion overlay"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }

        val launchIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification: Notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("☁️ Chibi is floating with you")
            .setContentText("Tap Chibi to chat, poke, or drag anywhere!")
            .setSmallIcon(R.drawable.chibi_standing)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()

        startForeground(1001, notification)
    }

    private fun setupOverlay() {
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        overlayView = LayoutInflater.from(this).inflate(R.layout.floating_pet_overlay, null)

        val layoutFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            layoutFlag,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 80
            y = 350
        }

        bindViews()
        setupTouchDragging()
        setupInteractions()

        windowManager.addView(overlayView, params)
    }

    private fun bindViews() {
        bubbleLayout = overlayView.findViewById(R.id.bubbleLayout)
        tvSpeech = overlayView.findViewById(R.id.tvSpeech)
        thinkingProgress = overlayView.findViewById(R.id.thinkingProgress)
        characterScene = overlayView.findViewById(R.id.characterScene)
        ivChibi = overlayView.findViewById(R.id.ivChibi)
        tvBadge = overlayView.findViewById(R.id.tvBadge)
        btnToggleMenu = overlayView.findViewById(R.id.btnToggleMenu)
        chatCard = overlayView.findViewById(R.id.chatCard)
        etPrompt = overlayView.findViewById(R.id.etPrompt)
        btnSend = overlayView.findViewById(R.id.btnSend)
        btnClosePanel = overlayView.findViewById(R.id.btnClosePanel)
        btnDismissService = overlayView.findViewById(R.id.btnDismissService)

        chipJoke = overlayView.findViewById(R.id.chipJoke)
        chipInspire = overlayView.findViewById(R.id.chipInspire)
        chipFact = overlayView.findViewById(R.id.chipFact)
        chipMath = overlayView.findViewById(R.id.chipMath)
    }

    private fun setupTouchDragging() {
        var initialX = 0
        var initialY = 0
        var initialTouchX = 0f
        var initialTouchY = 0f
        val touchSlop = 12f

        characterScene.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = params.x
                    initialY = params.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (event.rawX - initialTouchX).toInt()
                    val dy = (event.rawY - initialTouchY).toInt()
                    params.x = initialX + dx
                    params.y = initialY + dy
                    windowManager.updateViewLayout(overlayView, params)
                    true
                }
                MotionEvent.ACTION_UP -> {
                    val dist = hypot(
                        (event.rawX - initialTouchX).toDouble(),
                        (event.rawY - initialTouchY).toDouble()
                    )
                    if (dist < touchSlop) {
                        // Clean Tap on Chibi -> Poke Reaction!
                        pokeChibi()
                    }
                    true
                }
                else -> false
            }
        }
    }

    private fun setupInteractions() {
        // Tap speech bubble -> Poke
        bubbleLayout.setOnClickListener {
            pokeChibi()
        }

        // Tap menu pill -> Toggle chat panel
        btnToggleMenu.setOnClickListener {
            toggleChatPanel()
        }

        btnClosePanel.setOnClickListener {
            hideChatPanel()
        }

        btnDismissService.setOnClickListener {
            stopSelf()
        }

        // Action Chips
        chipJoke.setOnClickListener {
            showResponse(ChibiBrain.getRandomJoke())
        }
        chipInspire.setOnClickListener {
            showResponse(ChibiBrain.getRandomInspiration())
        }
        chipFact.setOnClickListener {
            showResponse(ChibiBrain.getRandomFact())
        }
        chipMath.setOnClickListener {
            showResponse(ChibiBrain.getRandomMath())
        }

        // Custom Chat Input
        etPrompt.setOnTouchListener { _, event ->
            if (event.action == MotionEvent.ACTION_UP) {
                enableKeyboardFocus()
            }
            false
        }

        etPrompt.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEND) {
                submitPrompt()
                true
            } else false
        }

        btnSend.setOnClickListener {
            submitPrompt()
        }
    }

    private fun pokeChibi() {
        // Squish and bounce animation
        val scaleDownX = ObjectAnimator.ofFloat(ivChibi, "scaleX", 1f, 1.15f, 0.95f, 1f)
        val scaleDownY = ObjectAnimator.ofFloat(ivChibi, "scaleY", 1f, 0.85f, 1.1f, 1f)
        val bounceY = ObjectAnimator.ofFloat(ivChibi, "translationY", 0f, 10f, -12f, 0f)

        AnimatorSet().apply {
            playTogether(scaleDownX, scaleDownY, bounceY)
            duration = 400
            start()
        }

        // Show expression badge
        val emojis = listOf("✨", "💖", "🌸", "🐾", "🥰", "☁️")
        tvBadge.text = emojis.random()
        tvBadge.visibility = View.VISIBLE

        val poke = ChibiBrain.getPokeReaction()
        showResponse(poke)
    }

    private fun toggleChatPanel() {
        if (chatCard.visibility == View.VISIBLE) {
            hideChatPanel()
        } else {
            showChatPanel()
        }
    }

    private fun showChatPanel() {
        chatCard.visibility = View.VISIBLE
        enableKeyboardFocus()
    }

    private fun hideChatPanel() {
        chatCard.visibility = View.GONE
        disableKeyboardFocus()
    }

    private fun enableKeyboardFocus() {
        if (!isKeyboardFocused) {
            isKeyboardFocused = true
            params.flags = WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
            windowManager.updateViewLayout(overlayView, params)
            etPrompt.requestFocus()

            val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
            imm.showSoftInput(etPrompt, InputMethodManager.SHOW_IMPLICIT)
        }
    }

    private fun disableKeyboardFocus() {
        if (isKeyboardFocused) {
            isKeyboardFocused = false
            params.flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
            windowManager.updateViewLayout(overlayView, params)

            val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
            imm.hideSoftInputFromWindow(overlayView.windowToken, 0)
            etPrompt.clearFocus()
        }
    }

    private fun submitPrompt() {
        val query = etPrompt.text.toString().trim()
        if (query.isEmpty()) return

        etPrompt.setText("")
        disableKeyboardFocus()

        // Show thinking indicator
        tvSpeech.text = "Thinking... 💭"
        thinkingProgress.visibility = View.VISIBLE
        tvBadge.text = "💭"

        serviceScope.launch {
            val response = ChibiBrain.askFreeAI(query)
            thinkingProgress.visibility = View.GONE
            showResponse(response)
        }
    }

    private fun showResponse(response: ChibiResponse) {
        tvSpeech.text = response.text
        tvBadge.text = response.emoji
        tvBadge.visibility = View.VISIBLE
    }

    override fun onDestroy() {
        super.onDestroy()
        if (::overlayView.isInitialized && overlayView.isAttachedToWindow) {
            windowManager.removeView(overlayView)
        }
    }
}
