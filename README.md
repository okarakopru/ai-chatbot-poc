# ai-chatbot-poc

AI-powered customer support assistant for an e-commerce store.  
Built as part of the **Lean Scale – AI-First Product Engineer** case study.

The prototype focuses on three core support flows:

- **Product discovery & product information**
- **Order tracking**
- **Returns & refund policy**

and adds a bit of:

- Multi-turn memory (topic recall, pronouns like *this / that / bu / şu / هذا / هذه*)
- Multilingual support (English, Arabic, Turkish, Spanish)

This public repo contains the **web demo** version of the assistant:  
a FastAPI backend (`backend.py`) and a minimal HTML frontend (`index.html`).

---

## Tech Stack

- Python 3.10+
- FastAPI + Uvicorn
- OpenAI API (chat completions + tool calling)
- langdetect
- pydantic
- Plain HTML + JavaScript (for the web UI)

---

## Repository Structure

    .
    ├── backend.py         # FastAPI backend used by the web demo
    ├── index.html         # Minimal web UI (talks to /chat)
    ├── orders.json        # Sample order data
    ├── products.json      # Sample product catalog
    ├── return_policy.json # Sample return / refund policy
    ├── requirements.txt   # Python dependencies
    └── README.md          # This file

The JSON files are the single source of truth for products, orders and refund policy in this prototype.

---

## Prerequisites

1. **Python 3.10+**
2. An **OpenAI API key**

Install dependencies:

    pip install -r requirements.txt

(veya isterseniz: `pip install fastapi uvicorn openai langdetect pydantic`)

---

## Environment Variable

The backend reads the OpenAI key from:

    OPENAI_API_KEY

### macOS / Linux

    export OPENAI_API_KEY="YOUR_KEY_HERE"

İsterseniz bu satırı `~/.zshrc` veya `~/.bashrc` içine ekleyip ardından:

    source ~/.zshrc   # veya: source ~/.bashrc

komutunu çalıştırabilirsiniz.

### Windows (PowerShell)

    setx OPENAI_API_KEY "YOUR_KEY_HERE"

Yeni bir terminal açın.

---

## Running the Web Demo

Proje kök klasöründe:

    uvicorn backend:app --reload --port 8000

Sonra tarayıcıdan:

- `http://localhost:8000/` → `index.html` üzerinden basit chat arayüzü

API’yi doğrudan test etmek isterseniz:

    curl -X POST "http://localhost:8000/chat" -H "Content-Type: application/json" -d '{"message": "Hello"}'

Aynı backend canlı ortamda (Render) deploy edilerek demo olarak da kullanılmıştır.

---

## Notes & Limitations

- Ürünler, siparişler ve iade politikası küçük, statik JSON dosyalarından okunur; bu bir POC’tur, tam üretim sistemi değildir.
- Konuşma hafızası sadece process içinde tutulur (session / database yok).
- Güvenlik, rate limiting ve hata yönetimi POC seviyesindedir; gerçek bir projede sertleştirilmelidir.
