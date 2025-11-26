# ============================================================
#  backend.py  (Telegram + Email + Location Fix + UID + Summary)
# ============================================================

import json
import os
import re
import requests
import smtplib
from email.mime.text import MIMEText
from datetime import datetime
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from openai import OpenAI
from langdetect import detect as lang_detect

# ============================================================
# OPENAI CLIENT
# ============================================================
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ============================================================
# FASTAPI + CORS
# ============================================================
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# STATIC FILE SERVE
# ============================================================
app.mount("/static", StaticFiles(directory="static"), name="static")

# ============================================================
# LOAD DATA
# ============================================================
products = json.load(open("products.json"))
orders = json.load(open("orders.json"))
return_policy = json.load(open("return_policy.json"))

# ============================================================
# MEMORY
# ============================================================
memory = {
    "conversation_products": [],
    "last_intent": None,
    "last_order_id": None,
    "conversation_transcript": []
}

# ============================================================
# TELEGRAM CONFIG
# ============================================================
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

def notify_telegram(text):
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        return
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
        data = {"chat_id": TELEGRAM_CHAT_ID, "text": text}
        requests.post(url, data=data)
    except Exception as e:
        print("Telegram error:", e)


# ============================================================
# EMAIL CONFIG
# ============================================================
EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 587
EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASS = os.getenv("EMAIL_PASS")
EMAIL_TO   = os.getenv("EMAIL_TO")

def notify_email(subject, body):
    if not EMAIL_USER or not EMAIL_PASS or not EMAIL_TO:
        return
    try:
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = EMAIL_USER
        msg["To"] = EMAIL_TO

        server = smtplib.SMTP(EMAIL_HOST, EMAIL_PORT)
        server.starttls()
        server.login(EMAIL_USER, EMAIL_PASS)
        server.sendmail(EMAIL_USER, EMAIL_TO, msg.as_string())
        server.quit()
    except Exception as e:
        print("Email error:", e)


# ============================================================
# LANGUAGE DETECTION
# ============================================================
def detect_language(msg):
    try:
        code = lang_detect(msg)
        if code.startswith("en"):
            return "English"
        if code.startswith("ar"):
            return "Arabic"
    except:
        pass
    return "English"


# ============================================================
# CLEAN MESSAGE
# ============================================================
def clean_message(msg):
    text = msg.lower()
    en = ["tell me more about","tell me about","tell me more","can you tell me","can you tell me about","please","pls"]
    ar = ["أخبرني عن","اخبرني عن","أخبرني أكثر عن","اخبرني اكثر عن","هل يمكنك شرح","من فضلك","لو سمحت"]
    for p in en + ar:
        text = text.replace(p, "")
    return text.strip()


# ============================================================
# PRODUCT RESOLUTION
# ============================================================
def ai_resolve_product(msg):
    cleaned = clean_message(msg)
    names = [p["name"] for p in products.values()]
    prompt = f"""
The user refers to a product.
USER: "{cleaned}"
Products:
{names}
Respond ONLY with the exact product name or NONE.
"""
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )
    out = r.choices[0].message.content.strip()
    return out if out in names else None


# ============================================================
# INTENTS
# ============================================================
def ai_wants_order(msg):
    prompt = f"Does user want order tracking? Respond YES or NO.\nUSER: {msg}"
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )
    return r.choices[0].message.content.strip().lower() == "yes"

def ai_wants_refund(msg):
    prompt = f"Is user asking REFUND/RETURN? Respond REFUND or NO.\nUSER: {msg}"
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )
    return r.choices[0].message.content.strip().upper() == "REFUND"


# ============================================================
# ARABIC DIGITS + ORDER ID
# ============================================================
ARABIC_DIGITS = {"٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9"}

def normalize_digits(msg):
    return "".join(ARABIC_DIGITS.get(ch, ch) for ch in msg)

def extract_order_id(msg):
    msg = normalize_digits(msg)
    found = re.findall(r"(\d[\s\.\-]?\d[\s\.\-]?\d[\s\.\-]?\d[\s\.\-]?\د\d)", msg)
    if found:
        clean = re.sub(r"[\s\.\-]", "", found[0])
        if clean.isdigit() and len(clean)==5:
            return clean
    return None


# ============================================================
# NATURAL FORMATTER
# ============================================================
def natural_format(user_msg, tool_data):
    lang = detect_language(user_msg)
    prompt = f"""
Respond ONLY in {lang}.
Convert TOOL_DATA into a clean natural answer.
No hallucinations.

TOOL_DATA:
{json.dumps(tool_data, indent=2)}
"""
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )
    return r.choices[0].message.content.strip()


# ============================================================
# GPT SESSION SUMMARY
# ============================================================
def generate_session_summary():
    transcript = memory["conversation_transcript"]
    if len(transcript) == 0:
        return "No conversation yet."
    convo = "\n".join(transcript)
    prompt = f"Summarize this conversation in 1–2 sentences.\n\n{convo}"
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}]
    )
    return r.choices[0].message.content.strip()


# ============================================================
# GEOLOCATION (CITY + COUNTRY) — FIXED VERSION
# ============================================================
def get_geo_info(ip):
    try:
        r = requests.get(f"http://ip-api.com/json/{ip}")
        data = r.json()

        if data.get("status") != "success":
            return "Unknown", "Unknown"

        city = data.get("city", "Unknown")
        country = data.get("country", "Unknown")
        return city, country

    except Exception as e:
        print("Geo error:", e)
        return "Unknown", "Unknown"


# ============================================================
# TOOLS
# ============================================================
def tool_product_list():
    return {"type": "product_list", "products": list(products.values())}

def tool_product_info(name):
    for p in products.values():
        if p["name"].lower() == name.lower():
            if p["name"] not in memory["conversation_products"]:
                memory["conversation_products"].append(p["name"])
            return {"type":"product_info", **p}
    return {"type":"info","message":"Product not found."}

def tool_order_lookup(id):
    if id in orders:
        return {"type":"order_info", **orders[id]}
    return {"type":"order_info","error":"Order not found"}

def tool_refund():
    return {"type":"refund_policy","policy":return_policy["policy"]}


# ============================================================
# REQUEST MODEL
# ============================================================
class ChatInput(BaseModel):
    message: str
    uid: str = "unknown"


# ============================================================
# MAIN CHAT ENDPOINT
# ============================================================
@app.post("/chat")
def chat(req: ChatInput, request: Request):

    # REAL IP (X-Forwarded-For FIX)
    ip = request.headers.get("x-forwarded-for", request.client.host).split(",")[0].strip()

    user = req.message
    uid = req.uid
    timestamp = datetime.now().strftime("%d-%m-%Y %H:%M:%S")

    # GEOLOCATION
    city, country = get_geo_info(ip)
    location_text = f"{city}, {country}"

    # SAVE TRANSCRIPT
    memory["conversation_transcript"].append(f"USER: {user}")

    # GPT SUMMARY
    session_summary = generate_session_summary()

    # ---------------------------------------------------------
    # TELEGRAM + EMAIL NOTIFICATION
    # ---------------------------------------------------------
    notify_text = (
        f"CHATBOT KULLANILDI!\n\n"
        f"UID: {uid}\n"
        f"IP: {ip}\n"
        f"Location: {location_text}\n"
        f"Time: {timestamp}\n\n"
        f"User Message:\n{user}\n\n"
        f"Session Summary:\n{session_summary}\n"
    )

    notify_telegram(notify_text)
    notify_email("CHATBOT KULLANILDI!", notify_text)

    # ---------------------------------------------------------
    # LOGIC
    # ---------------------------------------------------------
    lower = user.lower()

    # PRODUCT LIST
    triggers = [
        "what are your products","show products","products?",
        "list products","all products","product list",
        "المنتجات","ما هي منتجاتك","عرض المنتجات","قائمة المنتجات"
    ]
    if any(t in lower for t in triggers):
        reply = natural_format(user, tool_product_list())
        memory["conversation_transcript"].append(f"BOT: {reply}")
        return {"reply": reply}

    # REFUND
    if ai_wants_refund(user):
        reply = natural_format(user, tool_refund())
        memory["conversation_transcript"].append(f"BOT: {reply}")
        return {"reply": reply}

    # ORDER
    if ai_wants_order(user):
        oid = extract_order_id(user)

        if oid:
            reply = natural_format(user, tool_order_lookup(oid))
        else:
            reply = natural_format(user, {"type":"info","message":"Please provide your order ID."})

        memory["conversation_transcript"].append(f"BOT: {reply}")
        return {"reply": reply}

    # PRODUCT INFO
    product = ai_resolve_product(user)
    if product:
        reply = natural_format(user, tool_product_info(product))
        memory["conversation_transcript"].append(f"BOT: {reply}")
        return {"reply": reply}

    # SUMMARY COMMAND
    if "summary" in lower or "summarize" in lower or "ملخص" in lower:
        full_summary = generate_session_summary()
        memory["conversation_transcript"].append(f"BOT: {full_summary}")
        return {"reply": full_summary}

    # FALLBACK
    reply = natural_format(user, {
        "type":"info",
        "message":"I'm here to help with products, orders, or refunds. How can I assist?"
    })

    memory["conversation_transcript"].append(f"BOT: {reply}")

    return {
        "reply": reply,
        "uid": uid,
        "ip": ip,
        "location": location_text,
        "time": timestamp,
        "summary": session_summary
    }


# ============================================================
# ROOT ENDPOINT
# ============================================================
@app.get("/", response_class=HTMLResponse)
def index():
    with open("index.html", "r", encoding="utf-8") as f:
        return f.read()
