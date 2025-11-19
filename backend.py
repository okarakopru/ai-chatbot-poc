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
# MEMORY (Dual-channel + Product History Array)
# ============================================================
memory = {
    "conversation_products": [],  # list of product names discussed in history
    "order_product": None,
    "last_intent": None,
    "last_order_id": None
}

# ============================================================
# EXPLICIT LANGUAGE OVERRIDE DETECTOR
# ============================================================
def detect_explicit_language_request(msg):
    lowered = msg.lower()
    if "respond me in arabic" in lowered or "reply in arabic" in lowered:
        return "Arabic"
    if "respond me in turkish" in lowered or "reply in turkish" in lowered:
        return "Turkish"
    if "respond me in english" in lowered or "reply in english" in lowered:
        return "English"
    if "respond me in spanish" in lowered or "reply in spanish" in lowered:
        return "Spanish"
    return None

# ============================================================
# HYBRID LANGUAGE DETECTION (ISO + LLM fallback)
# ============================================================
def detect_language(msg):
    # 1. explicit override
    forced = detect_explicit_language_request(msg)
    if forced:
        return forced

    # 2. ISO detection
    try:
        lang = lang_detect(msg)
        if lang.startswith("en"): return "English"
        if lang.startswith("tr"): return "Turkish"
        if lang.startswith("ar"): return "Arabic"
        if lang.startswith("es"): return "Spanish"
        return "English"
    except:
        # 3. LLM fallback
        prompt = f"""
        Detect the language of this message.
        Respond ONLY with: English, Turkish, Arabic, Spanish, Other.

        Message: "{msg}"
        """
        r = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role":"user","content":prompt}]
        )
        detected = r.choices[0].message.content.strip()

        if detected not in ["English","Turkish","Arabic","Spanish"]:
            return "English"
        return detected

# ============================================================
# AI TOPIC RECALL DETECTOR (safe)
# ============================================================
def ai_topic_recall(msg):
    prompt = f"""
    Determine if the user is asking to recall the earlier topic of conversation.

    Examples of YES:
    - what were we talking about?
    - what did we discuss earlier?
    - ne konuşuyorduk az önce?
    - konuşmanın başında ne konuşuyorduk?
    - عن ماذا كنا نتحدث سابقاً؟

    Respond ONLY YES or NO.

    Message: "{msg}"
    """
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )
    return r.choices[0].message.content.strip().lower() == "yes"

# ============================================================
# ORDER ID MISSING (AI-based)
# ============================================================
def ai_order_id_missing(msg):
    prompt = f"""
    Does the user indicate they DO NOT know their order ID?

    Examples:
    - I don't know my order ID
    - I forgot my order number
    - sipariş numaramı hatırlamıyorum
    - لا أعرف رقم الطلب

    Respond ONLY YES or NO.

    Message: "{msg}"
    """
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )
    return r.choices[0].message.content.strip().lower() == "yes"

# ============================================================
# ORDER ID EXTRACTION (regex + LLM fallback)
# ============================================================
def extract_order_id(msg):
    # 1. Regex extraction (handles 24 839, 24839??, etc)
    ids = re.findall(r"\b(\d{5})\b", msg)
    if ids:
        return ids[0]

    # 2. AI fallback
    prompt = f"""
    Extract the 5-digit order ID from the following message.
    Respond ONLY with the number or NONE.

    Message: "{msg}"
    """
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )

    ans = r.choices[0].message.content.strip()

    if ans.isdigit() and len(ans)==5:
        return ans

    return None

# ============================================================
# PRODUCT EXTRACTION FOR ORDER-CONTEXT (hybrid)
# ============================================================
def extract_product_from_order_context(msg):
    lowered = msg.lower()

    # 1. Direct name match
    for p in products.values():
        if p["name"].lower() in lowered:
            return p["name"]

    # 2. Keyword → product map
    keyword_map = {
        "earbud": "Wireless Earbuds",
        "earbuds": "Wireless Earbuds",
        "kulak": "Wireless Earbuds",
        "headphone": "Noise Cancelling Headphones",
        "speaker": "Bluetooth Speaker Mini",
        "hoparlör": "Bluetooth Speaker Mini",
        "kamera": "4K Action Camera",
        "camera": "4K Action Camera",
        "كاميرا": "4K Action Camera",
        "سماعة": "Wireless Earbuds",
        "fitness": "Fitness Tracker Band",
        "spor": "Fitness Tracker Band"
    }

    for keyword, product_name in keyword_map.items():
        if keyword in lowered:
            return product_name

    # 3. AI fallback
    options = [p["name"] for p in products.values()]

    prompt = f"""
    The user is referring to a product they bought in an order context.

    USER MESSAGE:
    "{msg}"

    Products you must choose from:
    {options}

    Respond ONLY with exactly one product name or NONE.
    """
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )

    ans = r.choices[0].message.content.strip()

    return ans if ans in options else None
# ============================================================
# LEVEL 7/8 — FULL AI PRODUCT EXPLORER (STRICT & FACTUAL)
# ============================================================
def tool_ai_product_explorer(query):
    """Fully AI-driven product filtering and category naming."""

    product_list = list(products.values())

    prompt = f"""
    You are an advanced AI product discovery engine.

    USER QUERY:
    "{query}"

    PRODUCT CATALOG:
    {json.dumps(product_list, indent=2)}

    TASK:
    - Identify products semantically relevant to the query.
    - If user asks a general question like:
      "what products do you have", 
      "ürünleriniz neler",
      "ما هي المنتجات المتوفرة",
      → return ALL products.
    - If the query implies audio/sound/ear/fones, sport, camera, charging,
      → filter intelligently.
    - Create a short category name (1–3 words).
    - Respond with STRICT JSON ONLY:

    {{
       "category": "Category Name",
       "products": [
          {{
             "name":"...",
             "price":"...",
             "stock":"..."
          }}
       ]
    }}

    RULES:
    - DO NOT invent new products.
    - NEVER modify price or stock.
    - NEVER add fake availability (no "low stock", "popular", etc).
    - Only use products in the catalog.
    """

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )

    raw = r.choices[0].message.content.strip()

    try:
        data = json.loads(raw)
        memory["last_intent"] = "product"

        # Update conversation history
        for p in data.get("products", []):
            name = p["name"]
            if name not in memory["conversation_products"]:
                memory["conversation_products"].append(name)

        return {
            "type":"product_list",
            "category": data.get("category","Products"),
            "products": data.get("products",[])
        }

    except:
        # fallback: return everything
        for p in product_list:
            name = p["name"]
            if name not in memory["conversation_products"]:
                memory["conversation_products"].append(name)

        return {
            "type":"product_list",
            "category":"All Products",
            "products":product_list
        }

# ============================================================
# HYBRID PRODUCT LOOKUP (AI + fallback)
# ============================================================
def tool_product_lookup(query):
    """Choose ONE best product via AI reasoning (strict factual)."""

    result = tool_ai_product_explorer(query)

    # If single item
    if len(result["products"]) == 1:
        p = result["products"][0]

        # Update memory
        if p["name"] not in memory["conversation_products"]:
            memory["conversation_products"].append(p["name"])

        return {
            "type":"product_info",
            "name": p["name"],
            "price": p["price"],
            "stock": p["stock"]
        }

    # If multiple results: let AI choose one
    names = [p["name"] for p in result["products"]]

    prompt = f"""
    The user asked: "{query}"
    Candidate products: {names}

    Choose ONE product name from the list.
    Respond ONLY with that name.
    """

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )

    choice = r.choices[0].message.content.strip()

    # Validate
    for p in result["products"]:
        if p["name"].lower() == choice.lower():
            if p["name"] not in memory["conversation_products"]:
                memory["conversation_products"].append(p["name"])
            return {
                "type":"product_info",
                "name": p["name"],
                "price": p["price"],
                "stock": p["stock"]
            }

    # fallback: first item
    p = result["products"][0]

    if p["name"] not in memory["conversation_products"]:
        memory["conversation_products"].append(p["name"])

    return {
        "type":"product_info",
        "name": p["name"],
        "price": p["price"],
        "stock": p["stock"]
    }

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
# REFUND POLICY (STRICT — NO UPSELL)
# ============================================================
def tool_refund_policy():
    memory["last_intent"] = "refund"

    return {
        "type":"refund_policy",
        "policy": return_policy["policy"]
    }

# ============================================================
# NATURAL FORMATTER (DRIFT-PROOF + FACTUAL STRICT + SUMMARY SAFE)
# ============================================================
def natural_format(user_msg, tool_data):
    user_lang = detect_language(user_msg)

    prompt = f"""
    You are a multilingual e-commerce customer assistant.

    LANGUAGE RULES:
    - Respond ONLY in {user_lang}.
    - IGNORE: language of tool data, previous assistant messages.
    - NO DRIFT allowed.

    FACTUAL RULES:
    - NEVER modify price.
    - NEVER modify stock.
    - NEVER add stock comments ("low stock", "popular", etc).
    - NEVER invent product details.
    - NEVER upsell in refund policy responses.

    CONTEXT:
    USER SAID: "{user_msg}"

    TOOL_DATA:
    {json.dumps(tool_data, indent=2)}

    FORMATTING RULES:
    - product_list → list items cleanly.
    - product_info → describe factual details + one friendly suggestion.
    - order_info → state delivery + next steps.
    - refund_policy → explain return window (NO upsell).
    - summary → summarize memory["conversation_products"] items only.

    Now respond in {user_lang}.
    """

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "assistant", "content": prompt}]
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
# MAIN AGENT — LEVEL 8.4 FINAL
# ============================================================
@app.post("/chat")
def chat(req: ChatInput):
    user = req.message
    lower = user.lower()

    # =======================================================
    # (A) SUMMARY INTENT (EN + TR + AR SUPPORT)
    # =======================================================
    summary_keywords = [
        # Turkish
        "özetle", "konuştuklarımız", "konuştugumuz", "bana özetle",

        # English
        "summarize", "summary", "products we talked", "summary of", "made a summary",

        # Arabic
        "ملخص",           # summary
        "لخص",            # summarize
        "تلخيص",          # summarization
        "ما تحدثنا عنه",  # what we talked about
        "ما ناقشنا",       # what we discussed
        "الأشياء التي تحدثنا عنها", 
        "المنتجات التي تحدثنا عنها",
        "اعطني ملخص",     # give me a summary
        "نظرة عامة"       # overview
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

        summary_data = {
            "type": "summary",
            "products": product_summary
        }

        return {"reply": natural_format(user, summary_data)}

    # =======================================================
    # (B) TOPIC RECALL
    # =======================================================
    product_keywords = [
        # English product indicators
        "camera","earbud","earbuds","speaker","charger","headphone",
        "fitness","video","sound","audio",

        # Turkish product indicators
        "kulak","kulaklık","hoparlör","spor","şarj","kamera","video",

        # Arabic product indicators
        "سماعة",     # headphone / speaker / earphone
        "سماعات",    # plural
        "كاميرا",     # camera
        "الصوت",      # the sound
        "صوت",        # sound / audio
        "شاحن",       # charger
        "بطارية",     # battery
        "طاقة",       # power
        "رياضة",      # sport
        "لياقة"       # fitness
    ]

    order_keywords = [
        # English
        "order","track","tracking",

        # Turkish
        "sipariş","takip",

        # Arabic
        "تتبع",   # tracking
        "طلب"     # order
    ]

    want_recall = ai_topic_recall(user)

    # Trigger topic recall only if:
    # - user asked a recall question
    # - AND it’s NOT a product or order intent
    if want_recall and not any(w in lower for w in product_keywords + order_keywords):
        if memory["conversation_products"]:
            last_product = memory["conversation_products"][-1]
            info = tool_product_lookup(last_product)
            return {"reply": natural_format(user, info)}

        return {"reply": natural_format(user, {"type":"summary", "products":[]})}

    # =======================================================
    # (C) REFERENTIAL MEMORY 
    # ("it", "this", "that", "bu", "şu" + Arabic demonstratives)
    # =======================================================
    refer_words = [
        # English demonstratives
        "it", "this", "that",

        # Turkish demonstratives
        "bu", "şu",

        # Arabic demonstratives (masculine/feminine, near/far)
        "هو",    # he / it (masc.)
        "هي",    # she / it (fem.)
        "هذا",   # this (masc.)
        "هذه",   # this (fem.)
        "ذلك",   # that (masc.)
        "تلك"    # that (fem.)
    ]

    # Tokenize strictly — safer for multi-language scripts
    tokens = lower.split()

    if any(w in tokens for w in refer_words):

        # 1) ORDER-CONTEXT REFERENTIAL
        if memory["order_product"]:
            data = tool_product_lookup(memory["order_product"])
            return {"reply": natural_format(user, data)}

        # 2) CONVERSATION-CONTEXT REFERENTIAL
        if memory["conversation_products"]:
            last_product = memory["conversation_products"][-1]
            data = tool_product_lookup(last_product)
            return {"reply": natural_format(user, data)}

    # =======================================================
    # (D) ORDER ID EXTRACTION (ALWAYS BEFORE ROUTER)
    # =======================================================
    extracted_id = extract_order_id(user)
    if extracted_id:
        data = tool_order_lookup(extracted_id)
        return {"reply": natural_format(user, data)}

    # =======================================================
    # (E) ORDER-ID-MISSING FLOW (ONLY IF TRUE ORDER CONTEXT)
    # =======================================================
    if memory["last_intent"] == "order" and ai_order_id_missing(user):

        product_name = extract_product_from_order_context(user)

        if product_name:
            memory["order_product"] = product_name
            p = next(item for item in products.values() if item["name"] == product_name)

            return {"reply": natural_format(user, {
                "type":"product_info",
                "name": p["name"],
                "price": p["price"],
                "stock": p["stock"]
            })}

        # fallback if product cannot be extracted
        return {"reply": natural_format(user, {
            "type":"info",
            "message":"Please check your email for your order confirmation ID."
        })}

    # =======================================================
    # (F) REFUND POLICY (TAKES PRIORITY)
    # =======================================================
    refund_keywords = [
        # English
        "refund","return",

        # Turkish
        "iade","geri",

        # Arabic (existing)
        "استرجاع","تبديل",

        # Arabic (new additions)
        "ارجاع",      # returning
        "مرتجعات",    # returns
        "رجوع",       # going back / returning
        "اعادة"       # repeating / returning in context
    ]

    if any(w in lower for w in refund_keywords):
        data = tool_refund_policy()
        return {"reply": natural_format(user, data)}

    # =======================================================
    # (G) AI ROUTER — TOOL SELECTION
    # =======================================================
    router = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role":"system",
                "content":"You are an AI support agent. Choose the correct tool."
            },
            {"role":"user","content":user}
        ],
        tools=[
            {
                "type":"function",
                "function":{
                    "name":"tool_ai_product_explorer",
                    "description":"AI-driven product explorer",
                    "parameters":{
                        "type":"object",
                        "properties":{"query":{"type":"string"}},
                        "required":["query"]
                    }
                }
            },
            {
                "type":"function",
                "function":{
                    "name":"tool_product_lookup",
                    "description":"Find one best matching product",
                    "parameters":{
                        "type":"object",
                        "properties":{"query":{"type":"string"}},
                        "required":["query"]
                    }
                }
            },
            {
                "type":"function",
                "function":{
                    "name":"tool_order_lookup",
                    "description":"Track order by ID",
                    "parameters":{
                        "type":"object",
                        "properties":{"order_id":{"type":"string"}},
                        "required":["order_id"]
                    }
                }
            },
            {
                "type":"function",
                "function":{
                    "name":"tool_refund_policy",
                    "description":"Return refund policy steps",
                    "parameters":{"type":"object","properties":{}}
                }
            }
        ],
        tool_choice="auto"
    )

    choice = router.choices[0]

    # =======================================================
    # (H) TOOL EXECUTION
    # =======================================================
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

    # =======================================================
    # (I) FALLBACK RESPONSE
    # =======================================================
    return {"reply": choice.message.content}
