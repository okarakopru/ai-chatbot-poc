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
    if forced:
        return forced
    try:
        lang = lang_detect(msg)
        if lang.startswith("en"):
            return "English"
        if lang.startswith("ar"):
            return "Arabic"
        return "English"
    except:
        return "English"

# ============================================================
# AI HELPERS
# ============================================================
def ai_topic_recall(msg):
    prompt = f"Is the user asking to recall the earlier topic? ONLY YES/NO.\nMessage: {msg}"
    r = client.chat.completions.create(model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}])
    return r.choices[0].message.content.strip().lower() == "yes"

def ai_order_id_missing(msg):
    prompt = f"Does the user NOT know their order ID? ONLY YES/NO.\nMessage: {msg}"
    r = client.chat.completions.create(model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}])
    return r.choices[0].message.content.strip().lower() == "yes"

# ============================================================
# ORDER ID EXTRACTION (ROBUST)
# ============================================================
def extract_order_id(msg):
    pattern = r"(\d[\s\.\-]?\d[\s\.\-]?\d[\s\.\-]?\d[\s\.\-]?\d)"
    matches = re.findall(pattern, msg)
    if matches:
        clean = re.sub(r"[\s\.\-]", "", matches[0])
        if clean.isdigit() and len(clean) == 5:
            return clean

    prompt = f"Extract ONLY the 5-digit order ID or NONE.\nMessage: {msg}"
    r = client.chat.completions.create(model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}])
    ans = r.choices[0].message.content.strip()
    clean = re.sub(r"[\s\.\-]", "", ans)
    if clean.isdigit() and len(clean) == 5:
        return clean
    return None

# ============================================================
# PRODUCT EXTRACTION
# ============================================================
def extract_product_from_order_context(msg):
    lowered = msg.lower()

    for p in products.values():
        if p["name"].lower() in lowered:
            return p["name"]

    keyword_map = {
        "earbud": "Wireless Earbuds",
        "earbuds": "Wireless Earbuds",
        "headphone": "Noise Cancelling Headphones",
        "speaker": "Bluetooth Speaker Mini",
        "camera": "4K Action Camera",
        "كاميرا": "4K Action Camera",
        "سماعة": "Wireless Earbuds",
        "رياضة": "Fitness Tracker Band",
        "لياقة": "Fitness Tracker Band"
    }

    for k, v in keyword_map.items():
        if k in lowered:
            return v

    options = [p["name"] for p in products.values()]
    prompt = f"The user refers to a product.\nMessage: {msg}\nOptions: {options}\nReturn exact name or NONE."
    r = client.chat.completions.create(model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}])
    ans = r.choices[0].message.content.strip()
    return ans if ans in options else None

# ============================================================
# PRODUCT EXPLORER
# ============================================================
def tool_ai_product_explorer(query):
    product_list = list(products.values())

    prompt = f"""
    You are a strict product-discovery engine.
    USER QUERY: "{query}"
    CATALOG: {json.dumps(product_list)}
    Return STRICT JSON: {{"category":"All Products","products":[...]}}
    """

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )

    raw = r.choices[0].message.content.strip()
    try:
        data = json.loads(raw)
        memory["last_intent"] = "product"

        for p in data["products"]:
            if p["name"] not in memory["conversation_products"]:
                memory["conversation_products"].append(p["name"])

        return {"type":"product_list","category":data["category"],"products":data["products"]}

    except:
        for p in product_list:
            if p["name"] not in memory["conversation_products"]:
                memory["conversation_products"].append(p["name"])

        return {"type":"product_list","category":"All Products","products":product_list}

# ============================================================
# PRODUCT LOOKUP
# ============================================================
def tool_product_lookup(query):
    result = tool_ai_product_explorer(query)
    p = result["products"][0]
    return {"type":"product_info","name":p["name"],"price":p["price"],"stock":p["stock"]}

# ============================================================
# ORDER LOOKUP
# ============================================================
def tool_order_lookup(order_id):
    memory["last_intent"] = "order"
    memory["last_order_id"] = order_id

    if order_id in orders:
        info = orders[order_id]
        return {
            "type":"order_info",
            "order_id": order_id,
            "status": info["status"],
            "delivery": info["delivery_date"]
        }

    return {"type":"order_info","error":"Order not found"}

# ============================================================
# REFUND POLICY
# ============================================================
def tool_refund_policy():
    memory["last_intent"] = "refund"
    return {"type":"refund_policy","policy": return_policy["policy"]}

# ============================================================
# NATURAL FORMATTER (FIXED + ARABIC-SAFE)
# ============================================================
def natural_format(user_msg, tool_data):
    lang = detect_language(user_msg)

    prompt = f"""
You are a multilingual assistant.
Respond ONLY in {lang}.

Convert TOOL_DATA into a natural sentence.
NEVER mix product info inside an order reply.
NEVER hallucinate.

TOOL_DATA:
{json.dumps(tool_data, indent=2)}

Rules:
- If type="order_info": mention ONLY order_id, status, delivery.
- If type="product_info": mention name, price, stock.
- If type="product_list": clean list.
- If type="refund_policy": show policy only.
- If type="info": show the message.
"""

    r = client.chat.completions.create(model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}])
    return r.choices[0].message.content.strip()


# ============================================================
# FRONTEND SERVE
# ============================================================
@app.get("/", response_class=HTMLResponse)
def serve_frontend():
    with open("index.html","r",encoding="utf-8") as f:
        return f.read()

# ============================================================
# REQUEST MODEL
# ============================================================
class ChatInput(BaseModel):
    message: str
# ============================================================
# MAIN CHAT ENDPOINT (EN + AR ONLY)
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
        "products?",
        "list products",
        "show products",
        "products",
        "all products",

        # Arabic triggers
        "المنتجات",
        "ما هي منتجاتك",
        "اخبرني عن منتجاتك",
        "أخبرني عن منتجاتك",
        "قائمة المنتجات",
        "عرض المنتجات"
    ]

    if any(t in lower for t in product_list_triggers):
        return {"reply": natural_format(user, tool_ai_product_explorer("all products"))}

    # --------------------------------------------------------
    # SUMMARY INTENT
    # --------------------------------------------------------
    summary_keywords = [
        "summarize", "summary",
        "ملخص", "لخص", "تلخيص",
        "ما تحدثنا عنه", "ما ناقشنا",
        "الأشياء التي تحدثنا عنها",
        "اعطني ملخص", "نظرة عامة"
    ]

    if any(k in lower for k in summary_keywords):
        items = memory["conversation_products"]
        product_summary = []

        for name in items:
            for p in products.values():
                if p["name"] == name:
                    product_summary.append({
                        "name": p["name"],
                        "price": p["price"],
                        "stock": p["stock"]
                    })

        return {"reply": natural_format(user, {"type": "summary", "products": product_summary})}

    # --------------------------------------------------------
    # TOPIC RECALL
    # --------------------------------------------------------
    product_keywords = [
        "camera", "earbud", "earbuds", "speaker", "charger",
        "headphone", "fitness", "video", "sound", "audio",
        "سماعة", "سماعات", "كاميرا", "الصوت", "صوت",
        "شاحن", "بطارية", "طاقة", "رياضة", "لياقة"
    ]

    order_keywords = ["order", "track", "tracking", "تتبع", "طلب"]

    want_recall = ai_topic_recall(user)

    if want_recall and not any(k in lower for k in product_keywords + order_keywords):
        if memory["conversation_products"]:
            last_product = memory["conversation_products"][-1]
            return {"reply": natural_format(user, tool_product_lookup(last_product))}
        return {"reply": natural_format(user, {"type": "summary", "products": []})}

    # --------------------------------------------------------
    # REFERENTIAL MEMORY
    # --------------------------------------------------------
    refer_words = [
        "it", "this", "that",
        "هو", "هي", "هذا", "هذه", "ذلك", "تلك"
    ]

    if any(w in lower.split() for w in refer_words):
        if memory["order_product"]:
            return {"reply": natural_format(user, tool_product_lookup(memory["order_product"]))}

        if memory["conversation_products"]:
            last_product = memory["conversation_products"][-1]
            return {"reply": natural_format(user, tool_product_lookup(last_product))}

    # --------------------------------------------------------
    # REFUND INTENT (PRIORITY BEFORE ORDER)
    # --------------------------------------------------------
    refund_keywords = [
        "refund", "return",
        "استرجاع", "تبديل", "ارجاع",
        "مرتجعات", "رجوع", "اعادة"
    ]

    if any(k in lower for k in refund_keywords):
        return {"reply": natural_format(user, tool_refund_policy())}

    # --------------------------------------------------------
    # ORDER ID EXTRACTION (AFTER REFUND)
    # --------------------------------------------------------
    extracted = extract_order_id(user)
    if extracted:
        return {"reply": natural_format(user, tool_order_lookup(extracted))}

    # --------------------------------------------------------
    # ORDER-ID-MISSING FLOW
    # --------------------------------------------------------
    if memory["last_intent"] == "order" and ai_order_id_missing(user):

        product_name = extract_product_from_order_context(user)

        if product_name:
            memory["order_product"] = product_name
            p = next(item for item in products.values() if item["name"] == product_name)
            return {"reply": natural_format(user, {
                "type": "product_info",
                "name": p["name"],
                "price": p["price"],
                "stock": p["stock"]
            })}

        return {"reply": natural_format(user, {
            "type": "info",
            "message": "Please check your email for your order confirmation ID."
        })}

    # --------------------------------------------------------
    # ROUTER (SAFER, TOOL-FORCED)
    # --------------------------------------------------------
    router = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": """
You are an AI support agent.
You MUST call exactly ONE tool.
Never answer with plain text.
If unsure, default to tool_ai_product_explorer with query="all products".
"""
            },
            {"role": "user", "content": user}
        ],
        tools=[
            {"type": "function", "function": {
                "name": "tool_ai_product_explorer",
                "description": "AI product explorer",
                "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}
            }},
            {"type": "function", "function": {
                "name": "tool_product_lookup",
                "description": "Product lookup",
                "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}
            }},
            {"type": "function", "function": {
                "name": "tool_order_lookup",
                "description": "Order tracking",
                "parameters": {"type": "object", "properties": {"order_id": {"type": "string"}}, "required": ["order_id"]}
            }},
            {"type": "function", "function": {
                "name": "tool_refund_policy",
                "description": "Refund policy",
                "parameters": {"type": "object", "properties": {}}
            }}
        ],
        tool_choice="auto"
    )

    choice = router.choices[0]

    # --------------------------------------------------------
    # TOOL EXECUTION
    # --------------------------------------------------------
    if choice.finish_reason == "tool_calls":
        call = choice.message.tool_calls[0]
        fname = call.function.name
        args = json.loads(call.function.arguments)

        if fname == "tool_ai_product_explorer":
            return {"reply": natural_format(user, tool_ai_product_explorer(args["query"]))}

        if fname == "tool_product_lookup":
            return {"reply": natural_format(user, tool_product_lookup(args["query"]))}

        if fname == "tool_order_lookup":
            return {"reply": natural_format(user, tool_order_lookup(args["order_id"]))}

        if fname == "tool_refund_policy":
            return {"reply": natural_format(user, tool_refund_policy())}

    # --------------------------------------------------------
    # SAFE FALLBACK (NEVER DRIFT)
    # --------------------------------------------------------
    return {"reply": natural_format(user, {
        "type": "info",
        "message": "I'm here to help with products, orders, or refunds. How can I assist you?"
    })}
