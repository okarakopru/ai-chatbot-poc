const API_URL = "https://orhankarakopru.com.tr/chat";

// ==========================
// LANGUAGE DETECTION (EN vs AR)
// ==========================
function detectLang(text) {
    return /[\u0600-\u06FF]/.test(text) ? "ar" : "en";
}


// ==========================
// GLOBALS
// ==========================
let currentBotReply = "";     // fallback for Stop
let speakingBubble = null;    // DOM element for speaking bubble


// ==========================
// TYPEWRITER EFFECT
// ==========================
function typewriterMessage(fullText) {
    const box = document.getElementById("chat-box");

    const div = document.createElement("div");
    div.className = "message bot";
    box.appendChild(div);

    let i = 0;
    function type() {
        if (i <= fullText.length) {
            div.textContent = fullText.substring(0, i);
            i++;
            box.scrollTop = box.scrollHeight;
            setTimeout(type, 15);
        }
    }

    type();
}


// ==========================
// AI TEXT-TO-SPEECH (EN/AR)
// ==========================
function speak(text, lang) {
    currentBotReply = text;

    // Remove old speaking bubble if exists
    if (speakingBubble) speakingBubble.remove();

    // Create speaking bubble dynamically
    const box = document.getElementById("chat-box");
    speakingBubble = document.createElement("div");
    speakingBubble.className = "speaking-bubble";
    speakingBubble.innerHTML = `
        🔊 Speaking...
        <button class="speaking-stop-btn">⏹</button>
    `;
    box.appendChild(speakingBubble);
    box.scrollTop = box.scrollHeight;

    // Stop button inside bubble
    const stopBtn = speakingBubble.querySelector(".speaking-stop-btn");
    stopBtn.onclick = () => stopSpeaking();


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

        // Write message after speaking (Option C)
        typewriterMessage(text);
    };
}


// ==========================
// STOP SPEAKING
// ==========================
function stopSpeaking() {
    speechSynthesis.cancel();

    // Remove speaking bubble
    if (speakingBubble) speakingBubble.remove();
    speakingBubble = null;

    // Write the message
    typewriterMessage(currentBotReply);
}


// ==========================
// THINKING ANIMATION
// ==========================
let thinking = null;
let dotTimer = null;

function showThinking() {
    const box = document.getElementById("chat-box");

    thinking = document.createElement("div");
    thinking.className = "message bot";
    thinking.textContent = "Thinking";

    box.appendChild(thinking);
    box.scrollTop = box.scrollHeight;

    let dots = 0;
    dotTimer = setInterval(() => {
        dots = (dots + 1) % 4;
        thinking.textContent = "Thinking" + ".".repeat(dots);
    }, 400);
}

function hideThinking() {
    if (dotTimer) clearInterval(dotTimer);
    if (thinking) thinking.remove();
}


// ==========================
// SPEECH RECOGNITION (STT)
// ==========================
let rec;
if ("webkitSpeechRecognition" in window) {
    rec = new webkitSpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
}

document.getElementById("mic-btn").onclick = () => {
    if (!rec) return alert("Browser does not support voice recognition.");

    // Default EN to start; detect after transcript
    rec.lang = "en-US";

    document.getElementById("input-area").classList.add("hidden");
    document.getElementById("voice-bar").classList.remove("hidden");

    rec.start();
};

rec.onresult = (e) => {
    const text = e.results[0][0].transcript;
    const lang = detectLang(text);

    // Auto-send on ✓ 
    document.getElementById("voice-send").onclick = () => {
        sendDirect(text, lang);
    };
};

rec.onerror = () => {
    stopRecordingUI();
};

rec.onend = () => {
    // voice-bar stays open until cancel or send
};


// ==========================
// VOICE RECORDING UI CONTROL
// ==========================
function stopRecordingUI() {
    document.getElementById("voice-bar").classList.add("hidden");
    document.getElementById("input-area").classList.remove("hidden");
}

document.getElementById("voice-cancel").onclick = () => {
    rec.stop();
    stopRecordingUI();
};


// ==========================
// AUTO-SEND VOICE MESSAGE
// ==========================
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


// ==========================
// NORMAL TEXT SEND BUTTON
// ==========================
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


// ==========================
// ADD MESSAGE (USER/BOT)
// ==========================
function addMessage(msg, type) {
    const box = document.getElementById("chat-box");

    const div = document.createElement("div");
    div.className = "message " + type;
    div.textContent = msg;

    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}


// ==========================
// SCROLL BUTTON
// ==========================
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
