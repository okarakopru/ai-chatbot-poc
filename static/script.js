const API_URL = "https://orhankarakopru.com.tr/chat";

// ==========================
// DETECT ARABIC OR ENGLISH
// ==========================
function detectLang(text) {
    return /[\u0600-\u06FF]/.test(text) ? "ar" : "en";
}


// ==========================
// GLOBALS
// ==========================
let currentBotReply = ""; // fallback for Stop


// ==========================
// TYPEWRITER
// ==========================
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


// ==========================
// TEXT TO SPEECH (EN/AR)
// ==========================
function speak(text, lang) {
    currentBotReply = text;

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang === "ar" ? "ar-SA" : "en-US";

    const indicator = document.getElementById("speaking-indicator");
    const stopBtn = document.getElementById("stop-speaking-btn");

    indicator.classList.remove("hidden");
    stopBtn.classList.remove("hidden");

    speechSynthesis.speak(utter);

    utter.onend = () => {
        indicator.classList.add("hidden");
        stopBtn.classList.add("hidden");
        typewriterMessage(text);
    };
}

// STOP → fallback yazı
document.getElementById("stop-speaking-btn").onclick = () => {
    speechSynthesis.cancel();
    document.getElementById("speaking-indicator").classList.add("hidden");
    document.getElementById("stop-speaking-btn").classList.add("hidden");

    typewriterMessage(currentBotReply);
};


// ==========================
// THINKING
// ==========================
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

    rec.lang = "en-US"; // Start default EN

    document.getElementById("input-area").classList.add("hidden");
    document.getElementById("voice-bar").classList.remove("hidden");

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
    // Keep wave bar open until cancel or send
};


// ==========================
// RECORDING UI CONTROL
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
// AUTO-SEND (VOICE MESSAGE)
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
        .then(r => r.json())
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


// ==========================
// NORMAL SEND BUTTON
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
        .then(r => r.json())
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

document.getElementById("user-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
});


// ==========================
// ADD MESSAGE
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
    const b = document.getElementById("scroll-down-btn");

    const atBottom = box.scrollHeight - box.scrollTop <= box.clientHeight + 20;

    if (atBottom) b.classList.add("hidden");
    else b.classList.remove("hidden");
}

document.getElementById("chat-box").addEventListener("scroll", checkScrollButton);
document.getElementById("scroll-down-btn").addEventListener("click", () => {
    const b = document.getElementById("chat-box");
    b.scrollTop = b.scrollHeight;
});
