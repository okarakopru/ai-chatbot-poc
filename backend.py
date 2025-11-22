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
# MEMORY
# ============================================================
memory = {
    "conversation_products": [],
    "order_product": None,
    "last_intent": None,
    "last_order_id": None
}

# ============================================================
# LANGUAGE DETECTION
# ============================================================
def detect_explicit_language_request(msg):
    l = msg.lower()
    if "respond me in arabic" in l or "reply in arabic" in l:
        return "Arabic"
    if "respond me in english" in l or "reply in english" in l:
        return "English"
    return None

def detect_language(msg):
    forced = detect_explicit_language_request(msg)
    if forced:
        return forced

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
# MESSAGE CLEANER (EN + AR)
# ============================================================
def clean_user_message(msg):
    text = msg.lower()

    polite_en = [
        "tell me more about","tell me about","tell me more",
        "can you tell me about","can you tell me",
        "i want to know about","i would like to know about",
        "please","pls","explain","can you explain"
    ]

    polite_ar = [
        "أخبرني عن","اخبرني عن","أخبرني أكثر عن","اخبرني اكثر عن",
        "هل يمكنك شرح","من فضلك","لو سمحت","ارجو","اريد معرفة","اريد أن اعرف"
    ]

    for p in polite_en + polite_ar:
        text = text.replace(p, "")
    return text.strip()

# ============================================================
# ARABIC DIGIT NORMALIZATION
# ============================================================
ARABIC_DIGITS = {
    "٠":"0","١":"1","٢":"2","٣":"3","٤":"4",
    "٥":"5","٦":"6","٧":"7","٨":"8","٩":"9"
}

def normalize_digits(msg):
    return "".join(ARABIC_DIGITS.get(ch, ch) for ch in msg)

# ============================================================
# SEMANTIC ORDER INTENT (UPDATED)
# ============================================================
def ai_resolve_order_intent(msg):

    prompt = f"""
Does the user want ORDER TRACKING?

English patterns:
- where is my order
- order status
- track my order
- delivery date
- order id is 12345

Arabic patterns:
- ما هي حالة الطلب
- ما حالة طلبي
- ما هو وضع الطلب
- تتبع الطلب
- تتبع طلبي
- أريد تتبع طلبي
- اريد معرفة حالة الطلب
- ما هو موعد التسليم
- رقم الطلب
- رقم الطلب هو
- لمعرف الطلب
- معرف الطلب
- معرّف الطلب

Respond ONLY YES or NO.

USER: {msg}
"""

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )

    return r.choices[0].message.content.strip().lower() == "yes"

# ============================================================
# SEMANTIC PRODUCT RESOLVER
# ============================================================
def ai_resolve_product_name(msg):
    cleaned = clean_user_message(msg)
    product_names = [p["name"] for p in products.values()]

    prompt = f"""
The user is referring to a product.
USER: "{cleaned}"

Available products:
{product_names}

Respond EXACTLY with one product name or NONE.
"""

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )

    name = r.choices[0].message.content.strip()
    return name if name in product_names else None

# ============================================================
# REFUND INTENT
# ============================================================
def ai_resolve_refund_intent(msg):
    prompt = f"""
Is the user requesting a REFUND/RETURN?
Respond ONLY with REFUND or NO.

USER: {msg}
"""
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )
    return r.choices[0].message.content.strip().upper() == "REFUND"

# ============================================================
# ORDER ID EXTRACTION  (WITH ARABIC NORMALIZATION)
# ============================================================
def extract_order_id(msg):
    msg = normalize_digits(msg)

    matches = re.findall(r"(\d[\s\.\-]?\d[\s\.\-]?\d[\s\.\-]?\d[\s\.\-]?\d)", msg)
    if matches:
        clean = re.sub(r"[\s\.\-]","",matches[0])
        if clean.isdigit() and len(clean)==5:
            return clean
    return None

# ============================================================
# TOOL FUNCTIONS
# ============================================================
def tool_ai_product_explorer(query):
    memory["last_intent"] = "product"
    product_list = list(products.values())

    prompt = f"""
You are a strict product-discovery engine.
USER QUERY: "{query}"
Return STRICT JSON.
CATALOG: {json.dumps(product_list)}
"""

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )

    raw = r.choices[0].message.content.strip()

    try:
        data = json.loads(raw)
        for p in data.get("products", []):
            if p["name"] not in memory["conversation_products"]:
                memory["conversation_products"].append(p["name"])
        return {"type":"product_list","category":data["category"],"products":data["products"]}

    except:
        for p in product_list:
            if p["name"] not in memory["conversation_products"]:
                memory["conversation_products"].append(p["name"])
        return {"type":"product_list","category":"All Products","products":product_list}


def tool_product_lookup(name):
    memory["last_intent"] = "product"
    memory["order_product"] = None

    for p in products.values():
        if p["name"].lower() == name.lower():
            if p["name"] not in memory["conversation_products"]:
                memory["conversation_products"].append(p["name"])
            return {"type":"product_info", **p}

    return {"type":"info","message":"Product not found."}


def tool_order_lookup(order_id):
    memory["last_intent"] = "order"
    memory["last_order_id"] = order_id

    if order_id in orders:
        info = orders[order_id]
        return {"type":"order_info", **info}

    return {"type":"order_info","error":"Order not found"}


def tool_refund_policy():
    memory["last_intent"] = "refund"
    memory["order_product"] = None
    return {"type":"refund_policy","policy":return_policy["policy"]}
# ============================================================
# REQUEST MODEL
# ============================================================
class ChatInput(BaseModel):
    message: str


# ============================================================
# TOPIC RECALL DETECTOR
# ============================================================
def ai_topic_recall(msg):
    prompt = f"""
Is the user asking to recall what we were discussing earlier?
Respond ONLY YES or NO.

Examples:
- what were we talking about?
- remind me what we discussed
- عن ماذا كنا نتحدث؟
- ما الذي تحدثنا عنه؟

USER: "{msg}"
"""
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}]
    )
    return r.choices[0].message.content.strip().lower() == "yes"


# ============================================================
# ORDER-ID-MISSING DETECTOR
# ============================================================
def ai_order_id_missing(msg):
    prompt = f"""
Does the user indicate they DO NOT know their order ID?

Examples:
- I forgot my order ID
- I don't know my order number
- لا أعرف رقم الطلب
- نسيت رقم الطلب

Respond ONLY YES or NO.

USER: "{msg}"
"""
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )
    return r.choices[0].message.content.strip().lower() == "yes"


# ============================================================
# ROOT ENDPOINT (SERVE index.html)
# ============================================================
@app.get("/", response_class=HTMLResponse)
def serve_frontend():
    try:
        with open("index.html", "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        return f"<h3>index.html not found</h3><p>{str(e)}</p>"


# ============================================================
# NATURAL FORMATTER (DRIFT-PROOF)
# ============================================================
def natural_format(user_msg, tool_data):
    lang = detect_language(user_msg)

    prompt = f"""
You are a multilingual agent. Respond ONLY in {lang}.

Convert TOOL_DATA into a clean natural-language answer.

STRICT RULES:
- order_info → ONLY order_id, status, delivery
- product_info → ONLY name, price, stock
- product_list → clean bullet list
- refund_policy → ONLY the policy text
- NO mixing of types
- NO invented details
- NO hallucinations
- NO upsell

TOOL_DATA:
{json.dumps(tool_data, indent=2)}
"""
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )
    return r.choices[0].message.content.strip()


# ============================================================
# MAIN CHAT ENDPOINT (AI-FIRST ROUTING)
# ============================================================
@app.post("/chat")
def chat(req: ChatInput):
    user = req.message
    lower = user.lower()

    # --------------------------------------------------------
    # PRODUCT-LIST TRIGGERS
    # --------------------------------------------------------
    product_list_triggers = [
        "what are your products","products?","show products",
        "list products","products","all products",
        "المنتجات","ما هي منتجاتك","اخبرني عن منتجاتك",
        "أخبرني عن منتجاتك","عرض المنتجات","قائمة المنتجات"
    ]

    if any(t in lower for t in product_list_triggers):
        return {"reply": natural_format(user,
                 tool_ai_product_explorer("all products"))}

    # --------------------------------------------------------
    # REFUND INTENT (SEMANTIC)
    # --------------------------------------------------------
    if ai_resolve_refund_intent(user):
        return {"reply": natural_format(user, tool_refund_policy())}

    # --------------------------------------------------------
    # ORDER INTENT (SEMANTIC)
    # --------------------------------------------------------
    if ai_resolve_order_intent(user):
        order_id = extract_order_id(user)
        if order_id:
            return {"reply": natural_format(user,
                     tool_order_lookup(order_id))}
        return {"reply": natural_format(user, {
            "type":"info",
            "message":"Please provide your order ID."
        })}

    # --------------------------------------------------------
    # PRODUCT INTENT (SEMANTIC)
    # --------------------------------------------------------
    resolved = ai_resolve_product_name(user)
    if resolved:
        return {"reply": natural_format(user,
                 tool_product_lookup(resolved))}

    # --------------------------------------------------------
    # SUMMARY INTENT
    # --------------------------------------------------------
    summary_keywords = [
        "summarize","summary",
        "ملخص","لخص","تلخيص",
        "ما تحدثنا عنه","ما ناقشنا",
        "الأشياء التي تحدثنا عنها",
        "اعطني ملخص","نظرة عامة"
    ]

    if any(k in lower for k in summary_keywords):
        summary_list = []
        for name in memory["conversation_products"]:
            for p in products.values():
                if p["name"] == name:
                    summary_list.append({
                        "name": p["name"],
                        "price": p["price"],
                        "stock": p["stock"]
                    })

        return {"reply": natural_format(user,
                 {"type":"summary","products":summary_list})}

    # --------------------------------------------------------
    # TOPIC RECALL
    # --------------------------------------------------------
    if ai_topic_recall(user):
        if memory["conversation_products"]:
            last_product = memory["conversation_products"][-1]
            return {"reply": natural_format(user,
                     tool_product_lookup(last_product))}
        return {"reply": natural_format(user,
                 {"type":"summary","products":[]})}

    # --------------------------------------------------------
    # REFERENTIAL MEMORY (this/that/هو/هذه)
    # --------------------------------------------------------
    refer_words = ["it","this","that","هو","هي","هذا","هذه","ذلك","تلك"]

    if any(w in lower.split() for w in refer_words):
        if memory["conversation_products"]:
            last_product = memory["conversation_products"][-1]
            return {"reply": natural_format(user,
                     tool_product_lookup(last_product))}

    # --------------------------------------------------------
    # REFUND KEYWORD FALLBACK
    # --------------------------------------------------------
    refund_keywords = [
        "refund","return",
        "استرجاع","ارجاع","إرجاع",
        "مرتجعات","رجوع","اعادة"
    ]

    if any(k in lower for k in refund_keywords):
        return {"reply": natural_format(user,
                 tool_refund_policy())}

    # --------------------------------------------------------
    # ORDER ID EXTRACTION → LOOKUP
    # --------------------------------------------------------
    extracted = extract_order_id(user)
    if extracted:
        return {"reply": natural_format(user,
                 tool_order_lookup(extracted))}

    # --------------------------------------------------------
    # ORDER-ID-MISSING FLOW
    # --------------------------------------------------------
    if memory["last_intent"] == "order" and ai_order_id_missing(user):

        product_name = ai_resolve_product_name(user)

        if product_name:
            return {"reply": natural_format(user,
                     tool_product_lookup(product_name))}

        return {"reply": natural_format(user, {
            "type":"info",
            "message":"Please check your email for your order confirmation ID."
        })}

    # --------------------------------------------------------
    # SAFE FINAL FALLBACK
    # --------------------------------------------------------
    return {"reply": natural_format(user, {
        "type":"info",
        "message":"I'm here to help with products, orders, or refunds. How can I assist you?"
    })}
