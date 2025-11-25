const API_URL = "https://orhankarakopru.com.tr/chat";

// ========================
// AUTO LANGUAGE DETECTION
// ========================
function detectLang(text) {
    const arRegex = /[\u0600-\u06FF]/;
    return arRegex.test(text) ? "ar" : "en";
}


// ========================
// TYPEWRITER EFFECT
// ========================
function typewriterMessage(fullText) {
    const box = document.getElementById("chat-box");
    const div = document.createElement("div");
    div.className = "message bot";
    box.appendChild(div);

    let index = 0;
    function typeChar() {
        if (index <= fullText.length) {
            div.textContent = fullText.substring(0, index);
            index++;
            box.scrollTop = box.scrollHeight;
            setTimeout(typeChar, 15);
        }
    }
    typeChar();
}


// ========================
// TTS (AI SPEAKING)
// ========================
let speaking = false;

function speak(text, lang) {
    const indicator = document.getElementById("speaking-indicator");
    const stopBtn = document.getElementById("stop-speaking-btn");

    const utter = new SpeechSynthesisUtterance(text);

    utter.lang = lang === "ar" ? "ar-SA" : "en-US";
    utter.rate = 1;
    utter.pitch = 1;

    speaking = true;
    indicator.classList.remove("hidden");
    stopBtn.classList.remove("hidden");

    speechSynthesis.speak(utter);

    utter.onend = () => {
        speaking = false;
        indicator.classList.add("hidden");
        stopBtn.classList.add("hidden");
        typewriterMessage(text); // Option C: speak first, then typewriter
    };
}

document.getElementById("stop-speaking-btn").onclick = () => {
    speechSynthesis.cancel();
    speaking = false;
    document.getElementById("speaking-indicator").classList.add("hidden");
    document.getElementById("stop-speaking-btn").classList.add("hidden");
};


// ========================
// AI THINKING ANIMATION
// ========================
let thinkingMsg = null;
let thinkingInterval = null;

function showThinkingMessage() {
    const box = document.getElementById("chat-box");

    thinkingMsg = document.createElement("div");
    thinkingMsg.className = "message bot";
    thinkingMsg.textContent = "Thinking";

    box.appendChild(thinkingMsg);
    box.scrollTop = box.scrollHeight;

    let dots = 0;
    thinkingInterval = setInterval(() => {
        dots = (dots + 1) % 4;
        thinkingMsg.textContent = "Thinking" + ".".repeat(dots);
    }, 400);
}

function hideThinkingMessage() {
    if (thinkingInterval) clearInterval(thinkingInterval);
    if (thinkingMsg) thinkingMsg.remove();
}


// ========================
// SPEECH RECOGNITION (STT)
// ========================
let recognition;
if ("webkitSpeechRecognition" in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
}

document.getElementById("mic-btn").onclick = () => {
    const mic = document.getElementById("mic-btn");

    if (!recognition) {
        alert("Speech recognition not supported.");
        return;
    }

    // temporarily set to English (we will re-evaluate after text returns)
    recognition.lang = "en-US";

    recognition.start();
};

if (recognition) {
    recognition.onresult = (event) => {
        const result = event.results[0][0].transcript;
        document.getElementById("user-input").value = result;
    };
}


// ========================
// SEND MESSAGE
// ========================
function sendMessage() {
    const input = document.getElementById("user-input");
    const text = input.value.trim();
    if (!text) return;

    const lang = detectLang(text);

    addMessage(text, "user");
    input.value = "";

    showThinkingMessage();

    fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
    })
        .then(res => res.json())
        .then(data => {
            hideThinkingMessage();

            const reply = data.reply;
            const replyLang = detectLang(reply);

            speak(reply, replyLang); // 🌟 speak first
        })
        .catch(() => {
            hideThinkingMessage();
            addMessage("Error: Backend unreachable.", "bot");
        });
}


// ========================
// ADD MESSAGE (USER ONLY)
// ========================
function addMessage(msg, type) {
    const box = document.getElementById("chat-box");

    const div = document.createElement("div");
    div.className = "message " + type;
    div.textContent = msg;

    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}


// ========================
// SCROLL BUTTON
// ========================
function checkScrollButton() {
    const box = document.getElementById("chat-box");
    const btn = document.getElementById("scroll-down-btn");

    const atBottom = box.scrollHeight - box.scrollTop <= box.clientHeight + 20;

    if (atBottom) btn.classList.add("hidden");
    else btn.classList.remove("hidden");
}

document.getElementById("chat-box")
    .addEventListener("scroll", checkScrollButton);

document.getElementById("scroll-down-btn")
    .addEventListener("click", () => {
        const box = document.getElementById("chat-box");
        box.scrollTop = box.scrollHeight;
    });
