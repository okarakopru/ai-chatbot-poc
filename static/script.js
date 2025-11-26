const API_URL = "https://orhankarakopru.com.tr/chat";

/* ============================================================
   LANGUAGE DETECTION (EN vs AR)
============================================================ */
function detectLang(text) {
    return /[\u0600-\u06FF]/.test(text) ? "ar" : "en";
}


/* ============================================================
   GLOBALS
============================================================ */
let currentBotReply = "";      // Stop sonrası yazılacak mesaj
let speakingBubble = null;     // DOM speaking bubble referansı


/* ============================================================
   TYPEWRITER EFFECT
============================================================ */
function typewriterMessage(fullText) {
    const box = document.getElementById("chat-box");
    const div = document.createElement("div");
    div.className = "message bot";
    box.appendChild(div);

    let i = 0;
    function type() {
        if (i <= fullText.length) {
            div.textContent = fullText.slice(0, i);
            i++;
            box.scrollTop = box.scrollHeight;
            setTimeout(type, 15);
        }
    }
    type();
}


/* ============================================================
   TEXT TO SPEECH (EN/AR)
============================================================ */
function speak(text, lang) {
    currentBotReply = text;

    // Clear old speaking bubble
    if (speakingBubble) speakingBubble.remove();

    // Create speaking bubble
    const box = document.getElementById("chat-box");
    speakingBubble = document.createElement("div");
    speakingBubble.className = "speaking-bubble";
    speakingBubble.innerHTML = `
        🔊 Speaking...
        <button class="speaking-stop-btn">⏹</button>
    `;
    box.appendChild(speakingBubble);
    box.scrollTop = box.scrollHeight;

    // Stop button listener
    speakingBubble
        .querySelector(".speaking-stop-btn")
        .onclick = () => stopSpeaking();

    // TTS
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang === "ar" ? "ar-SA" : "en-US";
    utter.rate = 1;
    utter.pitch = 1;

    speechSynthesis.speak(utter);

    utter.onend = () => {
        // Remove speaking bubble
        if (speakingBubble) speakingBubble.remove();
        speakingBubble = null;

        // Then typewriter text
        typewriterMessage(text);
    };
}


/* ============================================================
   STOP SPEAKING
============================================================ */
function stopSpeaking() {
    speechSynthesis.cancel();

    if (speakingBubble) speakingBubble.remove();
    speakingBubble = null;

    typewriterMessage(currentBotReply);
}


/* ============================================================
   THINKING ANIMATION
============================================================ */
let thinking = null;
let dotTimer = null;

function showThinking() {
    const box = document.getElementById("chat-box");

    thinking = document.createElement("div");
    thinking.className = "message bot";
    thinking.textContent = "Thinking";
    box.appendChild(thinking);

    let dots = 0;
    dotTimer = setInterval(() => {
        dots = (dots + 1) % 4;
        thinking.textContent = "Thinking" + ".".repeat(dots);
    }, 400);

    box.scrollTop = box.scrollHeight;
}

function hideThinking() {
    if (dotTimer) clearInterval(dotTimer);
    if (thinking) thinking.remove();
}


/* ============================================================
   SPEECH RECOGNITION (STT)
============================================================ */
let rec;
if ("webkitSpeechRecognition" in window) {
    rec = new webkitSpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
}

document.getElementById("mic-btn").onclick = () => {
    if (!rec) return alert("Browser does not support voice recognition.");

    rec.lang = "en-US"; // Start as EN, detect after transcript.

    // Show voice recording UI
    document.getElementById("input-area").classList.add("hidden");
    document.getElementById("voice-bar").classList.remove("hidden");

    rec.start();
};

rec.onresult = (e) => {
    const text = e.results[0][0].transcript;
    const lang = detectLang(text);

    // Auto-send after ✓
    document.getElementById("voice-send").onclick = () => {
        sendDirect(text, lang);
    };
};

rec.onerror = () => {
    stopRecordingUI();
};

rec.onend = () => {
    // Eğer kullanıcı mic'e basmadıysa UI geri dönmeli
    stopRecordingUI();
};


/* ============================================================
   RECORDING UI CONTROL
============================================================ */
function stopRecordingUI() {
    document.getElementById("voice-bar").classList.add("hidden");
    document.getElementById("input-area").classList.remove("hidden");
}

document.getElementById("voice-cancel").onclick = () => {
    rec.stop();
    stopRecordingUI();
};


/* ============================================================
   AUTO-SEND VOICE MESSAGE
============================================================ */
function sendDirect(text, lang) {
    stopRecordingUI();
    addMessage(text, "user");

    showThinking();

    fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
    })
        .then((r) => r.json())
        .then((data) => {
            hideThinking();

            const reply = data.reply;
            const replyLang = detectLang(reply);

            speak(reply, replyLang);
        })
        .catch(() => {
            hideThinking();
            addMessage("Error: Backend unreachable.", "bot");
        });
}


/* ============================================================
   NORMAL TEXT SEND BUTTON
============================================================ */
function sendMessage() {
    const input = document.getElementById("user-input");
    const text = input.value.trim();
    if (!text) return;

    const lang = detectLang(text);

    addMessage(text, "user");
    input.value = "";

    showThinking();

    fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
    })
        .then((r) => r.json())
        .then((data) => {
            hideThinking();

            const reply = data.reply;
            const replyLang = detectLang(reply);

            speak(reply, replyLang);
        })
        .catch(() => {
            hideThinking();
            addMessage("Error: Backend unreachable.", "bot");
        });
}

document.getElementById("user-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
});


/* ============================================================
   ADD MESSAGE TO CHAT
============================================================ */
function addMessage(msg, type) {
    const box = document.getElementById("chat-box");

    const div = document.createElement("div");
    div.className = "message " + type;
    div.textContent = msg;

    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}


/* ============================================================
   SCROLL BUTTON
============================================================ */
function checkScrollButton() {
    const box = document.getElementById("chat-box");
    const btn = document.getElementById("scroll-down-btn");

    const atBottom =
        box.scrollHeight - box.scrollTop <= box.clientHeight + 20;

    if (atBottom) btn.classList.add("hidden");
    else btn.classList.remove("hidden");
}

document.getElementById("chat-box").addEventListener("scroll", checkScrollButton);

document.getElementById("scroll-down-btn").addEventListener("click", () => {
    const box = document.getElementById("chat-box");
    box.scrollTop = box.scrollHeight;
});
