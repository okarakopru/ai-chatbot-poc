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
# OPENAI CLIENT (SAFE)
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
# EXPLICIT LANGUAGE OVERRIDE
# ============================================================
def detect_explicit_language_request(msg):
    lowered = msg.lower()
    if "respond me in arabic" in lowered or "reply in arabic" in lowered:
        return "Arabic"
    if "respond me in english" in lowered or "reply in english" in lowered:
        return "English"
    return None

# ============================================================
# LANGUAGE DETECTION (EN + AR ONLY)
# ============================================================
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
        prompt = f"""
        Detect the language of this message.
        Respond ONLY with: English or Arabic.
        Message: "{msg}"
        """
        r = client.chat.completions.create(model="gpt-4o-mini",
              messages=[{"role":"user","content":prompt}])
        detected = r.choices[0].message.content.strip()
        return "Arabic" if detected == "Arabic" else "English"

# ============================================================
# AI TOPIC RECALL
# ============================================================
def ai_topic_recall(msg):
    prompt = f"""
    Determine if the user is asking to recall the earlier topic.
    Respond ONLY YES or NO.
    Message: "{msg}"
    """
    r = client.chat.completions.create(model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}])
    return r.choices[0].message.content.strip().lower() == "yes"

# ============================================================
# ORDER ID MISSING INTENT
# ============================================================
def ai_order_id_missing(msg):
    prompt = f"""
    Does the user indicate they DO NOT know their order ID?
    Respond ONLY YES or NO.
    Message: "{msg}"
    """
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

    prompt = f"""
    Extract the 5-digit order ID ONLY or NONE.
    Message: "{msg}"
    """
    r = client.chat.completions.create(model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}])
    ans = r.choices[0].message.content.strip()
    clean = re.sub(r"[\s\.\-]", "", ans)
    if clean.isdigit() and len(clean) == 5:
        return clean
    return None

# ============================================================
# PRODUCT EXTRACTION (EN + AR)
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

    prompt = f"""
    The user refers to a product.
    Message: "{msg}"
    Options: {options}
    Respond with exact name or NONE.
    """

    r = client.chat.completions.create(model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}])

    ans = r.choices[0].message.content.strip()
    return ans if ans in options else None
# ============================================================
# FULL AI PRODUCT EXPLORER (STRICT)
# ============================================================
def tool_ai_product_explorer(query):
    product_list = list(products.values())

    prompt = f"""
    You are an advanced AI product discovery engine.
    USER QUERY: "{query}"
    PRODUCT CATALOG: {json.dumps(product_list, indent=2)}
    Return STRICT JSON ONLY with category and products.
    """

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}]
    )

    raw = r.choices[0].message.content.strip()

    try:
        data = json.loads(raw)
        memory["last_intent"] = "product"

        for p in data.get("products", []):
            if p["name"] not in memory["conversation_products"]:
                memory["conversation_products"].append(p["name"])

        return {
            "type": "product_list",
            "category": data.get("category", "Products"),
            "products": data.get("products", [])
        }

    except:
        # fallback: return all
        for p in product_list:
            if p["name"] not in memory["conversation_products"]:
                memory["conversation_products"].append(p["name"])

        return {"type": "product_list", "category": "All Products", "products": product_list}


# ============================================================
# PRODUCT LOOKUP
# ============================================================
def tool_product_lookup(query):
    result = tool_ai_product_explorer(query)
    p = result["products"][0]
    return {"type": "product_info", "name": p["name"], "price": p["price"], "stock": p["stock"]}


# ============================================================
# ORDER LOOKUP
# ============================================================
def tool_order_lookup(order_id):
    memory["last_intent"] = "order"
    memory["last_order_id"] = order_id

    if order_id in orders:
        info = orders[order_id]
        return {
            "type": "order_info",
            "order_id": order_id,
            "status": info["status"],
            "delivery": info["delivery_date"]
        }

    return {"type": "order_info", "error": "Order not found"}


# ============================================================
# REFUND POLICY
# ============================================================
def tool_refund_policy():
    memory["last_intent"] = "refund"
    return {"type": "refund_policy", "policy": return_policy["policy"]}


# ============================================================
# NATURAL FORMATTER (DRIFT-PROOF)
# ============================================================
def natural_format(user_msg, tool_data):
    user_lang = detect_language(user_msg)

    prompt = f"""
    You are a multilingual e-commerce assistant.
    Respond ONLY in {user_lang}.
    USER SAID: "{user_msg}"
    TOOL_DATA: {json.dumps(tool_data, indent=2)}
    RULES:
    - NEVER modify price or stock.
    - NEVER invent product details.
    - NEVER upsell.
    - Keep responses clean and factual.
    """

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}]  # FIXED ROLE ✔
    )

    return r.choices[0].message.content.strip()


# ============================================================
# FRONTEND SERVE
# ============================================================
@app.get("/", response_class=HTMLResponse)
def serve_frontend():
    with open("index.html", "r", encoding="utf-8") as f:
        return f.read()


# ============================================================
# REQUEST MODEL
# ============================================================
class ChatInput(BaseModel):
    message: str


# ============================================================
# MAIN CHAT ENDPOINT
# ============================================================
@app.post("/chat")
def chat(req: ChatInput):
    user = req.message
    lower = user.lower()

    # --------------------------------------------------------
    # PRODUCT-LIST TRIGGERS (DETERMINISTIC)
    # --------------------------------------------------------
    product_list_triggers = [
        "what are your products",
        "show products",
        "products?",
        "list products",
        "products",
        "all products"
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

    if want_recall and not any(w in lower for w in product_keywords + order_keywords):
        if memory["conversation_products"]:
            last_product = memory["conversation_products"][-1]
            data = tool_product_lookup(last_product)
            return {"reply": natural_format(user, data)}

        return {"reply": natural_format(user, {"type": "summary", "products": []})}

    # --------------------------------------------------------
    # REFERENTIAL MEMORY
    # --------------------------------------------------------
    refer_words = ["it", "this", "that", "هو", "هي", "هذا", "هذه", "ذلك", "تلك"]

    if any(w in lower.split() for w in refer_words):
        if memory["order_product"]:
            return {"reply": natural_format(user, tool_product_lookup(memory["order_product"]))}

        if memory["conversation_products"]:
            last_product = memory["conversation_products"][-1]
            return {"reply": natural_format(user, tool_product_lookup(last_product))}

    # --------------------------------------------------------
    # REFUND KEYWORDS (PRIORITY BEFORE ORDER) ✔✔✔
    # --------------------------------------------------------
    refund_keywords = [
        "refund", "return",
        "استرجاع", "تبديل", "ارجاع",
        "مرتجعات", "رجوع", "اعادة"
    ]

    if any(k in lower for k in refund_keywords):
        return {"reply": natural_format(user, tool_refund_policy())}

    # --------------------------------------------------------
    # ORDER ID EXTRACTION (AFTER REFUND CHECK) ✔
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
    # TOOL ROUTER (SAFE)
    # --------------------------------------------------------
    router = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": """
You are an AI support agent.
You MUST choose a tool.
Never reply with plain text.
If unsure, default to tool_ai_product_explorer.
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
    # SAFETY FALLBACK (NO DRIFT)
    # --------------------------------------------------------
    return {"reply": natural_format(user, {
        "type": "info",
        "message": "I'm here to help with products, orders, or refunds. How can I assist you?"
    })}