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
    lowered = msg.lower()
    if "respond me in arabic" in lowered or "reply in arabic" in lowered:
        return "Arabic"
    if "respond me in english" in lowered or "reply in english" in lowered:
        return "English"
    return None

def detect_language(msg):
    forced = detect_explicit_language_request(msg)
    if forced: return forced

    try:
        detected = lang_detect(msg)
        if detected.startswith("en"): return "English"
        if detected.startswith("ar"): return "Arabic"
    except:
        pass

    return "English"

# ============================================================
# POLITE CLEANER (EN + AR)
# ============================================================
def clean_user_message(msg):
    lowered = msg.lower()

    polite_en = [
        "tell me more about","tell me more","tell me about",
        "can you tell me about","can you tell me",
        "i want to know about","i would like to know about",
        "i want to learn about","i would like to learn about",
        "explain","can you explain","please","pls",
        "give me info about"
    ]

    polite_ar = [
        "أخبرني عن","اخبرني عن",
        "أخبرني أكثر عن","اخبرني اكثر عن",
        "أريد معرفة المزيد عن","اريد معرفة المزيد عن",
        "هل يمكنك أن تخبرني عن","هل يمكنك اخباري عن",
        "هل يمكنك شرح","اشرح لي",
        "من فضلك","لو سمحت","ارجو",
        "حاب اعرف عن","ودي اعرف عن","ابي اعرف عن"
    ]

    cleaned = lowered
    for p in polite_en + polite_ar:
        cleaned = cleaned.replace(p, "")

    return cleaned.strip()

# ============================================================
# ARABIC DIGIT NORMALIZATION  <-- FIX
# ============================================================
ARABIC_DIGITS = {
    "٠":"0","١":"1","٢":"2","٣":"3","٤":"4",
    "٥":"5","٦":"6","٧":"7","٨":"8","٩":"9"
}

def normalize_digits(msg):
    return "".join(ARABIC_DIGITS.get(ch, ch) for ch in msg)

# ============================================================
# HYBRID SEMANTIC RESOLVERS
# ============================================================
def ai_resolve_product_name(msg):
    cleaned = clean_user_message(msg)
    product_names = [p["name"] for p in products.values()]

    prompt = f"""
The user is referring to a product.
USER: "{cleaned}"

Available products:
{product_names}

TASK:
- Identify the intended product.
- Respond EXACTLY with a product name from list.
- If none match, respond ONLY with: NONE.
"""
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )
    name = r.choices[0].message.content.strip()
    return name if name in product_names else None


def ai_resolve_order_intent(msg):
    prompt = f"""
Does the user want ORDER TRACKING?
Respond ONLY YES or NO.
USER: "{msg}"
"""
    r = client.chat.completions.create(model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}])
    return r.choices[0].message.content.strip().lower() == "yes"


def ai_resolve_refund_intent(msg):
    prompt = f"""
Is the user requesting a RETURN or REFUND?
Respond ONLY with: REFUND or NO.
USER: "{msg}"
"""
    r = client.chat.completions.create(model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}])
    return r.choices[0].message.content.strip().upper() == "REFUND"

# ============================================================
# ORDER ID EXTRACTION (FIXED)
# ============================================================
def extract_order_id(msg):
    msg = normalize_digits(msg)   # <-- CRITICAL FIX

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
Return STRICT JSON with category + products.
CATALOG: {json.dumps(product_list)}
"""
    r = client.chat.completions.create(model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}])

    raw = r.choices[0].message.content.strip()

    try:
        data = json.loads(raw)
        for p in data.get("products", []):
            if p["name"] not in memory["conversation_products"]:
                memory["conversation_products"].append(p["name"])
        return {"type":"product_list", "category":data["category"], "products":data["products"]}

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
            return {"type":"product_info","name":p["name"],"price":p["price"],"stock":p["stock"]}

    return {"type":"info","message":"Product not found."}


def tool_order_lookup(order_id):
    memory["last_intent"] = "order"
    memory["last_order_id"] = order_id

    if order_id in orders:
        info = orders[order_id]
        return {
            "type":"order_info",
            "order_id":order_id,
            "status":info["status"],
            "delivery":info["delivery_date"]
        }

    return {"type":"order_info","error":"Order not found"}


def tool_refund_policy():
    memory["last_intent"] = "refund"
    memory["order_product"] = None
    return {"type":"refund_policy","policy":return_policy["policy"]}
# ============================================================
# MAIN CHAT ENDPOINT (AI-FIRST + HYBRID INTENT)
# ============================================================
@app.post("/chat")
def chat(req: ChatInput):
    user = req.message
    lower = user.lower()

    # --------------------------------------------------------
    # PRODUCT-LIST TRIGGERS (EN + AR)
    # --------------------------------------------------------
    product_list_triggers = [
        "what are your products",
        "products?", "show products",
        "list products", "products",
        "all products",

        # Arabic
        "المنتجات",
        "ما هي منتجاتك",
        "اخبرني عن منتجاتك",
        "أخبرني عن منتجاتك",
        "عرض المنتجات",
        "قائمة المنتجات"
    ]

    if any(t in lower for t in product_list_triggers):
        return {
            "reply": natural_format(user, tool_ai_product_explorer("all products"))
        }

    # --------------------------------------------------------
    # SEMANTIC REFUND INTENT
    # --------------------------------------------------------
    if ai_resolve_refund_intent(user):
        return {
            "reply": natural_format(user, tool_refund_policy())
        }

    # --------------------------------------------------------
    # SEMANTIC ORDER INTENT
    # --------------------------------------------------------
    if ai_resolve_order_intent(user):
        order_id = extract_order_id(user)
        if order_id:
            return {
                "reply": natural_format(user, tool_order_lookup(order_id))
            }
        return {
            "reply": natural_format(user, {
                "type":"info",
                "message":"Please provide your order ID."
            })
        }

    # --------------------------------------------------------
    # SEMANTIC PRODUCT RESOLVE
    # --------------------------------------------------------
    resolved = ai_resolve_product_name(user)
    if resolved:
        return {
            "reply": natural_format(user, tool_product_lookup(resolved))
        }

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
        items = memory["conversation_products"]
        summary = []

        for name in items:
            for p in products.values():
                if p["name"] == name:
                    summary.append({
                        "name": p["name"],
                        "price": p["price"],
                        "stock": p["stock"]
                    })

        return {
            "reply": natural_format(user, {"type":"summary", "products": summary})
        }

    # --------------------------------------------------------
    # TOPIC RECALL
    # --------------------------------------------------------
    if ai_topic_recall(user):
        if memory["conversation_products"]:
            last = memory["conversation_products"][-1]
            return {
                "reply": natural_format(user, tool_product_lookup(last))
            }
        return {
            "reply": natural_format(user, {"type":"summary","products":[]})
        }

    # --------------------------------------------------------
    # REFERENTIAL MEMORY ("this", "that", "هو", ...)
    # --------------------------------------------------------
    refer_words = ["it","this","that","هو","هي","هذا","هذه","ذلك","تلك"]

    if any(w in lower.split() for w in refer_words):
        if memory["conversation_products"]:
            last = memory["conversation_products"][-1]
            return {
                "reply": natural_format(user, tool_product_lookup(last))
            }

    # --------------------------------------------------------
    # REFUND INTENT (KEYWORD FALLBACK)
    # --------------------------------------------------------
    refund_keywords = [
        "refund","return",
        "استرجاع","ارجاع","إرجاع",
        "مرتجعات","رجوع","اعادة"
    ]

    if any(k in lower for k in refund_keywords):
        return {
            "reply": natural_format(user, tool_refund_policy())
        }

    # --------------------------------------------------------
    # ORDER ID EXTRACTION → ORDER LOOKUP
    # --------------------------------------------------------
    extracted = extract_order_id(user)
    if extracted:
        return {
            "reply": natural_format(user, tool_order_lookup(extracted))
        }

    # --------------------------------------------------------
    # ORDER-ID-MISSING FALLBACK
    # --------------------------------------------------------
    # (If user asked for order but didn't give ID)
    if memory["last_intent"] == "order" and ai_order_id_missing(user):

        product_name = ai_resolve_product_name(user)

        if product_name:
            return {
                "reply": natural_format(user, tool_product_lookup(product_name))
            }

        return {
            "reply": natural_format(user, {
                "type":"info",
                "message":"Please check your email for your order confirmation ID."
            })
        }

    # --------------------------------------------------------
    # SAFE FINAL FALLBACK (NO DRIFT)
    # --------------------------------------------------------
    return {
        "reply": natural_format(user, {
            "type": "info",
            "message": "I'm here to help with products, orders, or refunds. How can I assist you?"
        })
    }
