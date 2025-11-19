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
# OPENAI CLIENT (SAFE — env var)
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
# LOAD DATASETS
# ============================================================
products = json.load(open("products.json"))
orders = json.load(open("orders.json"))
return_policy = json.load(open("return_policy.json"))

# ============================================================
# MEMORY (Dual-Channel + Product History Array)
# ============================================================
memory = {
    "conversation_products": [],   # history list (NEW)
    "order_product": None,
    "last_intent": None,
    "last_order_id": None
}

# ============================================================
# LANGUAGE DETECTION (Drift-Proof, Hybrid)
# ============================================================
def detect_language(msg):
    try:
        lang = lang_detect(msg)
        if lang.startswith("en"): return "English"
        if lang.startswith("tr"): return "Turkish"
        if lang.startswith("ar"): return "Arabic"
        if lang.startswith("es"): return "Spanish"
        return "English"
    except:
        # fallback LLM detection
        prompt = f"""
        Detect the language of this message.
        Respond ONLY with: English, Turkish, Arabic, Spanish, Other.

        Message: "{msg}"
        """
        r = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role":"user","content":prompt}]
        )
        ans = r.choices[0].message.content.strip()
        if ans not in ["English","Turkish","Arabic","Spanish"]:
            return "English"
        return ans

# ============================================================
# TOPIC RECALL DETECTOR (AI-only)
# ============================================================
def ai_topic_recall(msg):
    prompt = f"""
    Is the user asking to recall the earlier conversation topic?

    Examples of YES:
    - what were we talking about
    - what did we discuss earlier
    - what was the topic at the beginning
    - ne konuşuyorduk
    - konuşmanın başında ne konuşuyorduk
    - عن ماذا كنا نتحدث سابقاً

    Respond ONLY YES or NO.

    User: "{msg}"
    """
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )
    return r.choices[0].message.content.strip().lower() == "yes"

# ============================================================
# ORDER ID MISSING DETECTOR (AI-based)
# ============================================================
def ai_order_id_missing(msg):
    prompt = f"""
    Does the user indicate they DO NOT KNOW their order ID?
    Respond ONLY YES or NO.

    Examples:
    - I don't know my order ID
    - I forgot my order number
    - sipariş numaramı hatırlamıyorum
    - لا أعرف رقم الطلب

    User: "{msg}"
    """
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )
    return r.choices[0].message.content.strip().lower() == "yes"

# ============================================================
# ORDER ID EXTRACTION (regex + AI fallback)
# ============================================================
def extract_order_id(msg):
    # Try regex
    ids = re.findall(r"\b(\d{5})\b", msg)
    if ids:
        return ids[0]

    # AI fallback
    prompt = f"""
    Extract the 5-digit order ID from the message.
    Respond ONLY with the number or NONE.

    Message: "{msg}"
    """
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )
    ans = r.choices[0].message.content.strip()
    return ans if ans.isdigit() and len(ans)==5 else None

# ============================================================
# PRODUCT NAME EXTRACTION FOR ORDER CONTEXT (Hybrid)
# ============================================================
def extract_product_from_order_context(msg):
    text = msg.lower()

    # 1) Direct string match across product names
    for p in products.values():
        pname = p["name"].lower()
        if pname in text:
            return p["name"]

    # 2) Match across category-like keywords
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

    for k,v in keyword_map.items():
        if k in text:
            return v

    # 3) AI Fallback – direct extraction from choices
    names = [p["name"] for p in products.values()]

    prompt = f"""
    The user is describing a product they bought, but did not provide an order ID.
    Extract which product they bought.

    USER MESSAGE:
    "{msg}"

    Choose ONLY from:
    {names}

    Respond ONLY with the product name, or NONE.
    """

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )

    ans = r.choices[0].message.content.strip()

    if ans in names:
        return ans

    return None
# ============================================================
# LEVEL 7+ — FULL AI PRODUCT EXPLORER (STRICT & FACTUAL)
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
    - If user asks "what products do you have", "show all products", "ürünleriniz neler",
      "ما هي المنتجات المتوفرة", etc → return ALL products.
    - If the query implies something like sound/audio/ear/camera/fitness/charger,
      filter intelligently.
    - Create a CATEGORY NAME (1–3 words).
    - Return STRICT JSON ONLY:

    {{
       "category": "Category Name",
       "products": [
          {{
             "name": "...",
             "price": "...",
             "stock": "..."
          }}
       ]
    }}

    RULES:
    - Absolutely DO NOT invent new products.
    - DO NOT modify price or stock.
    - DO NOT add imaginary availability ("low stock", "out of stock", etc).
    - Use ONLY products listed in the catalog.
    """

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )

    raw = r.choices[0].message.content.strip()

    try:
        data = json.loads(raw)
        memory["last_intent"] = "product"

        # Update conversation history list
        for p in data.get("products", []):
            pname = p["name"]
            if pname not in memory["conversation_products"]:
                memory["conversation_products"].append(pname)

        return {
            "type":"product_list",
            "category": data.get("category","Products"),
            "products": data.get("products",[])
        }

    except:
        # fallback → return everything
        for p in product_list:
            pname = p["name"]
            if pname not in memory["conversation_products"]:
                memory["conversation_products"].append(pname)

        return {
            "type":"product_list",
            "category":"All Products",
            "products":product_list
        }

# ============================================================
# HYBRID PRODUCT LOOKUP (AI + fallback)
# ============================================================
def tool_product_lookup(query):
    """Return ONE best-fit product using both AI reasoning and fallback."""
    result = tool_ai_product_explorer(query)

    # If only 1 → direct return
    if len(result["products"]) == 1:
        p = result["products"][0]

        if p["name"] not in memory["conversation_products"]:
            memory["conversation_products"].append(p["name"])

        return {
            "type":"product_info",
            "name": p["name"],
            "price": p["price"],
            "stock": p["stock"]
        }

    # Multiple products → ask AI to pick the single closest match
    names = [p["name"] for p in result["products"]]

    prompt = f"""
    The user asked about: "{query}"
    Candidate products: {names}

    Choose ONLY ONE product name from the list above.
    Respond ONLY with that name.
    """

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )

    chosen = r.choices[0].message.content.strip()

    # Validate chosen
    for p in result["products"]:
        if p["name"].lower() == chosen.lower():

            if p["name"] not in memory["conversation_products"]:
                memory["conversation_products"].append(p["name"])

            return {
                "type":"product_info",
                "name": p["name"],
                "price": p["price"],
                "stock": p["stock"]
            }

    # fallback → first
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
            "type": "order_info",
            "order_id": order_id,
            "status": info["status"],
            "delivery": info["delivery_date"]
        }

    return {"type":"order_info","error":"Order not found"}

# ============================================================
# REFUND POLICY (STRICT — NO UPSELL)
# ============================================================
def tool_refund_policy():
    """Strict factual refund explanation. No upsell allowed."""
    memory["last_intent"] = "refund"

    return {
        "type": "refund_policy",
        "policy": return_policy["policy"]
    }

# ============================================================
# NATURAL FORMATTER (DRIFT-PROOF + FACTUAL-STRICT)
# ============================================================
def natural_format(user_msg, tool_data):
    user_lang = detect_language(user_msg)

    prompt = f"""
    You are a multilingual customer support assistant.

    IMPORTANT LANGUAGE RULES:
    - Respond ONLY in {user_lang}.
    - IGNORE: tool data language, previous assistant replies, internal reasoning.
    - NEVER drift to a different language.

    FACTUAL RULES:
    - NEVER change product stock value.
    - NEVER modify price.
    - NEVER add 'low stock', 'out of stock', 'popular', etc unless TOOL_DATA says so.
    - NEVER invent product details.

    USER SAID:
    "{user_msg}"

    TOOL_DATA:
    {json.dumps(tool_data, indent=2)}

    INSTRUCTIONS:
    - If product_list: list items cleanly in {user_lang}.
    - If product_info: give factual details + ONE suggestion.
    - If order_info: explain delivery status + next step.
    - If refund_policy: explain return window (NO upsell).
    - If summary needed: summarize memory["conversation_products"].

    Respond now in {user_lang}:
    """

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"assistant","content":prompt}]
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
# MAIN AGENT — LEVEL 8.3 FINAL
# ============================================================
@app.post("/chat")
def chat(req: ChatInput):
    user = req.message
    lower = user.lower()

    # =======================================================
    # (A) SUMMARY INTENT — “şu ana kadar konuştuğumuz ürünleri özetle”
    # =======================================================
    summary_keywords = [
        "özetle", "konuştuklarımız", "talked so far", 
        "summarize", "summary", "konuştugumuz", "products so far",
        "bana özetle"
    ]

    if any(k in lower for k in summary_keywords):
        items = memory["conversation_products"]
        if not items:
            return {"reply": natural_format(user, {
                "type":"summary",
                "products":[]
            })}

        # Build summary tool_data structure
        summary_data = {
            "type":"summary",
            "products":[
                {"name": p["name"], "price": p["price"], "stock": p["stock"]}
                for p in products.values()
                if p["name"] in items
            ]
        }

        return {"reply": natural_format(user, summary_data)}

    # =======================================================
    # (B) TOPIC RECALL — AI + keyword hybrid
    # =======================================================
    product_keywords = ["camera","earbud","speaker","charger","kulak","spor","fitness","hoparlör","şarj","cams","video"]
    order_keywords = ["order","track","sipariş","تتبع","طلب"]

    is_recall_question = ai_topic_recall(user)

    if is_recall_question and not any(k in lower for k in product_keywords + order_keywords):
        # valid topic recall
        if memory["conversation_products"]:
            last_product = memory["conversation_products"][-1]
            info = tool_product_lookup(last_product)
            return {"reply": natural_format(user, info)}

        return {"reply": natural_format(user, {
            "type":"summary",
            "products":[]
        })}

    # =======================================================
    # (C) REFERENTIAL MEMORY
    # =======================================================
    referential_words = ["it", "this", "that", "bu", "şu"]

    if any(w in lower.split() for w in referential_words):
        # NEVER route referential queries to the router
        if memory["order_product"]:
            info = tool_product_lookup(memory["order_product"])
            return {"reply": natural_format(user, info)}

        if memory["conversation_products"]:
            last_product = memory["conversation_products"][-1]
            info = tool_product_lookup(last_product)
            return {"reply": natural_format(user, info)}

    # =======================================================
    # (D) ORDER-ID EXTRACTION ALWAYS BEFORE ROUTER
    # =======================================================
    extracted_id = extract_order_id(user)
    if extracted_id:
        data = tool_order_lookup(extracted_id)
        return {"reply": natural_format(user, data)}

    # =======================================================
    # (E) ORDER-ID-MISSING (AI Detector)
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

        return {"reply":
            natural_format(user, {
                "type":"info",
                "message":"Please check your email for your order confirmation ID."
            })
        }

    # =======================================================
    # (F) REFUND INTENT (NO ORDER-ID-MISSING OVERRIDE)
    # =======================================================
    refund_words = ["refund","return","iade","استرجاع","geri","تبديل"]

    if any(w in lower for w in refund_words):
        data = tool_refund_policy()
        return {"reply": natural_format(user, data)}

    # =======================================================
    # (G) ROUTER — AI SELECTS TOOL
    # =======================================================
    router = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role":"system",
                "content":"You are an AI support agent. Choose the correct function tool."
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
                    "description":"Detailed single product lookup",
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
            data = tool_ai_product_explorer(args["query"])
            return {"reply": natural_format(user, data)}

        if fname == "tool_product_lookup":
            data = tool_product_lookup(args["query"])
            return {"reply": natural_format(user, data)}

        if fname == "tool_order_lookup":
            data = tool_order_lookup(args["order_id"])
            return {"reply": natural_format(user, data)}

        if fname == "tool_refund_policy":
            data = tool_refund_policy()
            return {"reply": natural_format(user, data)}

    # =======================================================
    # (I) FALLBACK
    # =======================================================
    return {"reply": choice.message.content}
