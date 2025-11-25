const API_URL = "https://orhankarakopru.com.tr/chat"; // Backend URL

// Thinking message references
let thinkingMsg = null;
let thinkingInterval = null;

// Add message to chat box
function addMessage(msg, type) {
    const box = document.getElementById("chat-box");

    const div = document.createElement("div");
    div.className = "message " + type;
    div.textContent = msg;

    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

// Thinking bubble in chat messages (NOT robot PNG)
function showThinkingMessage() {
    const box = document.getElementById("chat-box");

    // Create bubble
    thinkingMsg = document.createElement("div");
    thinkingMsg.className = "message bot";
    thinkingMsg.textContent = "Thinking";

    box.appendChild(thinkingMsg);
    box.scrollTop = box.scrollHeight;

    // Animated dots
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

// Send message
function sendMessage() {
    const input = document.getElementById("user-input");
    const text = input.value.trim();
    if (!text) return;

    // User message
    addMessage(text, "user");
    input.value = "";

    // Start thinking animation
    showThinkingMessage();

    // Backend request
    fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
    })
    .then(res => res.json())
    .then(data => {
        hideThinkingMessage();
        addMessage(data.reply, "bot");
    })
    .catch(() => {
        hideThinkingMessage();
        addMessage("Error: Backend unreachable.", "bot");
    });
}

// Send message on Enter
document.getElementById("user-input").addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
        sendMessage();
    }
});
