# ============================================================
#  backend.py  (CLI logic version – fully synced with cli_chatbot.py)
# ============================================================

import json
import os
import re
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
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
# LOAD DATA
# ============================================================
products = json.load(open("products.json"))
orders = json.load(open("orders.json"))
return_policy = json.load(open("return_policy.json"))

# ============================================================
# MEMORY (SAME AS CLI)
# ============================================================
memory = {
    "conversation_products": [],
    "last_intent": None,
    "last_order_id": None
}

# ============================================================
# LANGUAGE DETECTION (EXACT SAME AS CLI)
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
# MESSAGE CLEANER (CLI VERSION)
# ============================================================
def clean_message(msg):
    text = msg.lower()

    en = [
        "tell me more about","tell me about","tell me more",
        "can you tell me","can you tell me about",
        "please","pls"
    ]

    ar = [
        "أخبرني عن","اخبرني عن",
        "أخبرني أكثر عن","اخبرني اكثر عن",
        "هل يمكنك شرح","من فضلك","لو سمحت"
    ]

    for p in en + ar:
        text = text.replace(p, "")
    return text.strip()

# ============================================================
# SEMANTIC PRODUCT RESOLVER (1:1 CLI)
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
# SEMANTIC ORDER / REFUND (1:1 CLI)
# ============================================================
def ai_wants_order(msg):

    prompt = f"""
Does the user want ORDER TRACKING?

English examples:
- where is my order
- order status
- track my order
- delivery date
- order id is 12345

Arabic examples:
- ما هي حالة الطلب
- ما حالة طلبي
- ما هو وضع الطلب
- اريد معرفة حالة الطلب
- ما هو موعد التسليم
- رقم الطلب
- معرّف الطلب
- معرف الطلب
- تتبع طلبي
- أريد تتبع الطلب

Respond ONLY with YES or NO.

USER: {msg}
"""

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
    return r.choices[0].message.content.strip().upper()=="REFUND"

# ============================================================
# ARABIC DIGITS
# ============================================================
ARABIC_DIGITS = {
    "٠":"0","١":"1","٢":"2","٣":"3","٤":"4",
    "٥":"5","٦":"6","٧":"7","٨":"8","٩":"9"
}

def normalize_digits(msg):
    return "".join(ARABIC_DIGITS.get(ch, ch) for ch in msg)

# ============================================================
# ORDER ID EXTRACTION (CLI)
# ============================================================
def extract_order_id(msg):
    msg = normalize_digits(msg)

    found = re.findall(r"(\d[\s\.\-]?\d[\s\.\-]?\d[\s\.\-]?\d[\s\.\-]?\d)", msg)
    if found:
        clean = re.sub(r"[\s\.\-]", "", found[0])
        if clean.isdigit() and len(clean)==5:
            return clean
    return None

# ============================================================
# NATURAL FORMATTER (CLI VERSION)
# ============================================================
def natural_format(user_msg, tool_data):
    lang = detect_language(user_msg)

    prompt = f"""
Respond ONLY in {lang}.

Convert TOOL_DATA into a clean natural-language answer.
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
# TOOLS — EXACTLY LIKE CLI
# ============================================================
def tool_product_list():
    return {"type":"product_list","products":list(products.values())}

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
# ============================================================
# MAIN CHAT ENDPOINT — 100% CLI LOGIC
# ============================================================
@app.post("/chat")
def chat(req: ChatInput):
    user = req.message
    lower = user.lower()

    # PRODUCT LIST INTENT (CLI)
    triggers = [
        "what are your products","show products","products?",
        "list products","all products","product list",
        "المنتجات","ما هي منتجاتك","عرض المنتجات","قائمة المنتجات"
    ]
    if any(t in lower for t in triggers):
        return {"reply": natural_format(user, tool_product_list())}

    # REFUND INTENT
    if ai_wants_refund(user):
        return {"reply": natural_format(user, tool_refund())}

    # ORDER INTENT
    if ai_wants_order(user):
        oid = extract_order_id(user)
        if oid:
            return {"reply": natural_format(user, tool_order_lookup(oid))}
        return {"reply": natural_format(user, {"type":"info","message":"Please provide your order ID."})}

    # PRODUCT RESOLUTION
    product = ai_resolve_product(user)
    if product:
        return {"reply": natural_format(user, tool_product_info(product))}

    # SUMMARY
    if "summary" in lower or "summarize" in lower or "ملخص" in lower:
        plist = []
        for name in memory["conversation_products"]:
            for p in products.values():
                if p["name"] == name:
                    plist.append(p)
        return {"reply": natural_format(user, {"type":"summary","products":plist})}

    # FALLBACK (CLI)
    return {"reply": natural_format(user, {
        "type":"info",
        "message":"I'm here to help with products, orders, or refunds. How can I assist?"
    })}


# ============================================================
# ROOT ENDPOINT
# ============================================================
@app.get("/", response_class=HTMLResponse)
def index():
    try:
        with open("index.html", "r", encoding="utf-8") as f:
            return f.read()
    except:
        return "<h3>Frontend not found.</h3>"
