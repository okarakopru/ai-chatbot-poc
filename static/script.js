const API_URL = "https://orhankarakopru.com.tr/chat"; // Backend URL

// Thinking animation references
let thinkingMsg = null;
let thinkingInterval = null;

// Add message to chat box
function addMessage(msg, type) {
    const box = document.getElementById("chat-box");

    const div = document.createElement("div");
    div.className = "message " + type;
    div.textContent = msg;

    box.appendChild(div);

    // Always scroll to bottom when message arrives
    box.scrollTop = box.scrollHeight;

    // Update scroll-to-bottom button visibility
    checkScrollButton();
}

// ==========================
// TYPEWRITER EFFECT
// ==========================
function typewriterMessage(fullText) {
    const box = document.getElementById("chat-box");

    // Create empty bot bubble
    const div = document.createElement("div");
    div.className = "message bot";
    box.appendChild(div);

    let index = 0;

    function typeChar() {
        if (index <= fullText.length) {
            div.textContent = fullText.substring(0, index);
            index++;
            box.scrollTop = box.scrollHeight; // auto scroll during typing
            setTimeout(typeChar, 15); // typing speed
        }
    }

    typeChar();
}

// ==========================
// THINKING ANIMATION
// ==========================
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
    thinkingMsg = null;
}

// ==========================
// SEND MESSAGE
// ==========================
function sendMessage() {
    const input = document.getElementById("user-input");
    const text = input.value.trim();
    if (!text) return;

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

        // 🔥 NEW: typewriter animation instead of static message
        typewriterMessage(data.reply);
    })
    .catch(() => {
        hideThinkingMessage();
        addMessage("Error: Backend unreachable.", "bot");
    });
}

// Enter key sends message
document.getElementById("user-input").addEventListener("keypress", function (e) {
    if (e.key === "Enter") sendMessage();
});


// ==========================
// SCROLL-TO-BOTTOM BUTTON
// ==========================
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
