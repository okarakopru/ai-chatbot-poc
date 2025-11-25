// Canlı backend URL'in (Render üzerinden çalışan)
const API_URL = "https://orhankarakopru.com.tr/chat";

// Mesaj gönderme işlemi
function sendMessage() {
    const input = document.getElementById("user-input");
    const text = input.value.trim();
    if (!text) return;

    // Kullanıcı mesajını göster
    addMessage(text, "user");

    // Input alanını temizle
    input.value = "";

    // Robot “düşünüyor” animasyonunu aç
    showThinking(true);

    // Backend'e mesaj gönder
    fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
    })
    .then(res => res.json())
    .then(data => {
        // Düşünme balonunu kapat
        showThinking(false);

        // Bot cevabını ekrana yaz
        addMessage(data.reply, "bot");
    })
    .catch(err => {
        showThinking(false);
        addMessage("⚠️ Error: Backend is unreachable.", "bot");
    });
}

// Chat kutusuna mesaj ekleme fonksiyonu
function addMessage(msg, type) {
    const box = document.getElementById("chat-box");

    const div = document.createElement("div");
    div.className = "message " + type;
    div.textContent = msg;

    box.appendChild(div);

    // En alta kaydır
    box.scrollTop = box.scrollHeight;
}

// Robot düşünme animasyonu
function showThinking(show) {
    const bubble = document.getElementById("thinking-bubble");

    if (show) {
        bubble.classList.remove("hidden");
        bubble.classList.add("thinking");
    } else {
        bubble.classList.add("hidden");
        bubble.classList.remove("thinking");
    }
}

// Enter tuşu ile gönderme
document.getElementById("user-input").addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
        sendMessage();
    }
});
