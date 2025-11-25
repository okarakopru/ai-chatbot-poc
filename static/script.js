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

// Thinking bubble (chat message typing indicator)
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

// Send message
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
        addMessage(data.reply, "bot");
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

// Show/hide scroll-to-bottom button
function checkScrollButton() {
    const box = document.getElementById("chat-box");
    const btn = document.getElementById("scroll-down-btn");

    const atBottom = box.scrollHeight - box.scrollTop <= box.clientHeight + 20;

    if (atBottom) btn.classList.add("hidden");
    else btn.classList.remove("hidden");
}

// On scroll
document.getElementById("chat-box")
    .addEventListener("scroll", checkScrollButton);

// Scroll button click
document.getElementById("scroll-down-btn")
    .addEventListener("click", () => {
        const box = document.getElementById("chat-box");
        box.scrollTop = box.scrollHeight;
    });


// ==========================
// RANDOM BLINK SYSTEM
// ==========================
function doBlink() {
    const leftEye = document.querySelector(".left-eyelid");
    const rightEye = document.querySelector(".right-eyelid");

    // Play eyelid animation
    leftEye.style.animation = "blinkDown 0.25s ease";
    rightEye.style.animation = "blinkDown 0.25s ease";

    // Reset animation
    setTimeout(() => {
        leftEye.style.animation = "";
        rightEye.style.animation = "";
    }, 300);

    // Next blink at a random interval (4–9 seconds)
    const nextBlink = Math.random() * (9000 - 4000) + 4000;
    setTimeout(doBlink, nextBlink);
}

// Start blinking after page loads
window.addEventListener("load", () => {
    setTimeout(doBlink, 2000);
});
