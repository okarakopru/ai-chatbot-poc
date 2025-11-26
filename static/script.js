const API_URL = "https://orhankarakopru.com.tr/chat";

/* ============================================================
   FORCE NORMAL UI ON PAGE LOAD
============================================================ */
window.addEventListener("load", () => {
    document.getElementById("voice-row").classList.add("hidden");
    document.getElementById("text-row").classList.remove("hidden");
});

/* ============================================================
   LANGUAGE DETECTION (EN vs AR)
============================================================ */
function detectLang(text) {
    return /[\u0600-\u06FF]/.test(text) ? "ar" : "en";
}

/* ============================================================
   GLOBAL STATE
============================================================ */
let speakingBubble = null;
let currentBotReply = "";
let lastUserMessageSource = "text";   // "text" | "voice"

/* ============================================================
   TYPEWRITER EFFECT
============================================================ */
function typewriterMessage(fullText) {
    const box = document.getElementById("chat-box");
    const bubble = document.createElement("div");
    bubble.className = "message bot";
    box.appendChild(bubble);

    let i = 0;
    function type() {
        if (i <= fullText.length) {
            bubble.textContent = fullText.substring(0, i);
            i++;
            box.scrollTop = box.scrollHeight;
            setTimeout(type, 15);
        }
    }

    type();
}

/* ============================================================
   AI TEXT-TO-SPEECH (WITH SPEAKING BUBBLE)
============================================================ */
function speak(text, lang) {
    currentBotReply = text;

    if (speakingBubble) speakingBubble.remove();

    const box = document.getElementById("chat-box");

    speakingBubble = document.createElement("div");
    speakingBubble.className = "speaking-bubble";
    speakingBubble.innerHTML = `
        🔊 Speaking...
        <button class="speaking-stop-btn">⏹</button>
    `;
    box.appendChild(speakingBubble);

    box.scrollTop = box.scrollHeight;

    speakingBubble.querySelector(".speaking-stop-btn").onclick = () => stopSpeaking();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang === "ar" ? "ar-SA" : "en-US";
    utter.rate = 1;

    speechSynthesis.speak(utter);

    utter.onend = () => {
        if (speakingBubble) speakingBubble.remove();
        speakingBubble = null;
        typewriterMessage(text);
    };
}

/* ============================================================
   STOP SPEAKING (⏹ INSIDE SPEAKING BUBBLE)
============================================================ */
function stopSpeaking() {
    speechSynthesis.cancel();

    if (speakingBubble) speakingBubble.remove();
    speakingBubble = null;

    typewriterMessage(currentBotReply);
}

/* ============================================================
   THINKING BUBBLE
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
   SPEECH RECOGNITION (VOICE INPUT)
============================================================ */
let rec;

if ("webkitSpeechRecognition" in window) {
    rec = new webkitSpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
}

document.getElementById("mic-btn").onclick = () => {
    lastUserMessageSource = "voice";

    if (!rec) {
        alert("Your browser does not support voice recognition.");
        return;
    }

    rec.lang = "en-US";

    document.getElementById("text-row").classList.add("hidden");
    document.getElementById("voice-row").classList.remove("hidden");

    rec.start();
};

rec.onresult = (e) => {
    const text = e.results[0][0].transcript;
    const lang = detectLang(text);

    document.getElementById("voice-send").onclick = () => {
        sendDirect(text, lang);
    };
};

rec.onerror = () => {
    stopRecordingUI();
};

rec.onend = () => {
    stopRecordingUI();
};

/* ============================================================
   RECORDING UI CONTROL (STOP & EXIT VOICE MODE)
============================================================ */
function stopRecordingUI() {
    document.getElementById("voice-row").classList.add("hidden");
    document.getElementById("text-row").classList.remove("hidden");
}

document.getElementById("voice-stop").onclick = () => {
    rec.stop();
    stopRecordingUI();
};

/* ============================================================
   AUTO-SEND VOICE MESSAGE
============================================================ */
function sendDirect(text, lang) {
    lastUserMessageSource = "voice";

    stopRecordingUI();
    addMessage(text, "user");

    showThinking();

    fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
    })
        .then(res => res.json())
        .then(data => {
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
   NORMAL TEXT SEND (TEXT MODE OUTPUT ONLY)
============================================================ */
function sendMessage() {
    lastUserMessageSource = "text";

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
        .then(res => res.json())
        .then(data => {
            hideThinking();

            const reply = data.reply;

            // TEXT MODE → NO TTS
            typewriterMessage(reply);
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
   SCROLL DOWN BUTTON
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
