import json
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from openai import OpenAI

# ============================================================
# OPENAI CLIENT (SAFE — env var ONLY)
# ============================================================
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ============================================================
# FASTAPI APP + CORS
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
# LEVEL 8 MEMORY (Dual-channel)
# ============================================================
memory = {
    "conversation_product": None,   # last discussed product
    "order_product": None,          # product involved in order context
    "last_intent": None,
    "last_order_id": None
}

# ============================================================
# AI DETECTORS (topic recall, language, order-id-missing)
# ============================================================

def ai_topic_recall(msg):
    prompt = f"""
    Determine if the user is asking about the earlier topic of conversation.

    Examples of YES:
    - what were we talking about?
    - what did we discuss earlier?
    - what was the topic at the beginning?
    - konuşmanın başında ne konuşuyorduk?
    - عن ماذا كنا نتحدث سابقاً؟

    Respond ONLY YES or NO.

    User: "{msg}"
    """
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
    )
    return r.choices[0].message.content.strip().lower() == "yes"


def ai_order_id_missing(msg):
    prompt = f"""
    Does the user indicate they do NOT know their order ID?

    Examples of YES:
    - I don't know my order ID
    - I forgot the order number
    - sipariş numaramı hatırlamıyorum
    - لا أعرف رقم الطلب

    Respond ONLY YES or NO.

    User: "{msg}"
    """
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
    )
    return r.choices[0].message.content.strip().lower() == "yes"


def detect_language(msg):
    prompt = f"""
    Detect the language of this message.
    Respond with ONLY ONE of these words:
    English, Turkish, Arabic, Spanish, Other.

    Message: "{msg}"
    """
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
    )
    return r.choices[0].message.content.strip()


# ============================================================
# LEVEL 7 — Fully AI-driven Product Explorer (no embeddings)
# ============================================================

def tool_ai_product_explorer(query):
    """AI determines relevant products & creates category."""
    product_list = list(products.values())

    prompt = f"""
    You are an advanced AI product discovery engine.

    USER QUERY:
    "{query}"

    PRODUCT CATALOG:
    {json.dumps(product_list, indent=2)}

    TASK:
    - Identify products semantically related to the query.
    - If user asks "what products do you have?" → return ALL.
    - If query implies category (earbuds, sound, audio, camera, fitness, charging), 
      pick relevant products.
    - Create a short (1–3 words) CATEGORY NAME.
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
    - DO NOT invent products.
    - DO NOT modify price or stock.
    - ONLY use product names from catalog.
    """

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}],
    )

    raw = r.choices[0].message.content.strip()

    try:
        data = json.loads(raw)
        memory["last_intent"] = "product"

        # If only 1 product: store conversation context
        if len(data.get("products", [])) == 1:
            memory["conversation_product"] = data["products"][0]["name"]

        return {
            "type": "product_list",
            "category": data.get("category", "Products"),
            "products": data.get("products", [])
        }

    except:
        # fallback
        return {
            "type": "product_list",
            "category": "All Products",
            "products": product_list
        }


def tool_product_lookup(query):
    """Single-product detail using AI logic."""
    result = tool_ai_product_explorer(query)

    if len(result["products"]) == 1:
        p = result["products"][0]
        memory["conversation_product"] = p["name"]
        memory["last_intent"] = "product"
        return {
            "type":"product_info",
            "name":p["name"],
            "price":p["price"],
            "stock":p["stock"]
        }

    # If multiple, ask AI to pick the best one
    names = [p["name"] for p in result["products"]]

    prompt = f"""
    User asked: "{query}"
    Candidate products: {names}
    Pick the best match. Respond ONLY with the product name.
    """
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}],
    )

    best = r.choices[0].message.content.strip()

    for p in result["products"]:
        if p["name"].lower() == best.lower():
            memory["conversation_product"] = p["name"]
            return {
                "type":"product_info",
                "name":p["name"],
                "price":p["price"],
                "stock":p["stock"]
            }

    # fallback
    p = result["products"][0]
    return {
        "type":"product_info",
        "name":p["name"],
        "price":p["price"],
        "stock":p["stock"]
    }


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
    return {"type":"refund_policy","policy":return_policy["policy"]}


# ============================================================
# NATURAL FORMATTER (AI language-safe)
# ============================================================

def natural_format(user_msg, tool_data):
    user_lang = detect_language(user_msg)

    prompt = f"""
    You are a multilingual customer support assistant.

    USER LANGUAGE: {user_lang}

    Respond ONLY in {user_lang}.
    Ignore the language of previous assistant messages.
    Ignore the language of the tool data.
    DO NOT change factual values.

    USER SAID:
    "{user_msg}"

    TOOL DATA:
    {json.dumps(tool_data, indent=2)}

    RULES:
    - If product_list: list items nicely.
    - If product_info: give price, stock, availability suggestion.
    - If order_info: explain status + delivery.
    - If refund_policy: explain return steps.
    - Add ONE friendly suggestion.
    """

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"assistant","content":prompt}],
    )

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
# MAIN AGENT — LEVEL 8.1 FINAL
# ============================================================
@app.post("/chat")
def chat(req: ChatInput):
    user = req.message
    lower = user.lower()

    # 0) AI TOPIC RECALL (NEW)
    if ai_topic_recall(user):
        if memory["conversation_product"]:
            info = tool_product_lookup(memory["conversation_product"])
            return {"reply": natural_format(user, info)}
        return {"reply": "We were having a general conversation earlier. How can I assist you now?"}

    # 1) REFERENTIAL
    if any(w in lower for w in ["it","this","that"]):
        if memory["last_intent"] == "order" and memory["order_product"]:
            data = tool_product_lookup(memory["order_product"])
            return {"reply": natural_format(user, data)}
        if memory["conversation_product"]:
            data = tool_product_lookup(memory["conversation_product"])
            return {"reply": natural_format(user, data)}

    # 2) ORDER ID MISSING
    if memory["last_intent"] == "order" and ai_order_id_missing(user):
        explorer = tool_ai_product_explorer(user)
        if explorer["products"]:
            p = explorer["products"][0]
            memory["order_product"] = p["name"]
            return {"reply":
                f"It looks like you don’t know your order ID.\n\n"
                f"You mentioned **{p['name']}**.\n"
                f"It costs {p['price']} and is {p['stock']}.\n\n"
                f"Please check your email for the confirmation number so I can track it."
            }

    # 3) ORDER ASKED WITHOUT ID
    if "where is my order" in lower or "track my order" in lower:
        memory["last_intent"] = "order"
        return {"reply": "Sure — could you share your order ID?"}

    # 4) AI ROUTER SELECTS TOOL
    router = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role":"system","content":"You are an AI support agent. Select the correct tool."},
            {"role":"user","content":user}
        ],
        tools=[
            {
                "type":"function",
                "function":{
                    "name":"tool_ai_product_explorer",
                    "description":"Fully AI-driven product explorer",
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
                    "description":"Single product detailed view",
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
                    "description":"Order tracking by ID",
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
                    "description":"Return refund policy",
                    "parameters":{"type":"object","properties":{}}
                }
            }
        ],
        tool_choice="auto"
    )

    choice = router.choices[0]

    # 5) TOOL EXECUTION
    if choice.finish_reason == "tool_calls":
        call = choice.message.tool_calls[0]
        fn = call.function.name
        args = json.loads(call.function.arguments)

        if fn == "tool_ai_product_explorer":
            return {"reply": natural_format(user, tool_ai_product_explorer(args["query"]))}

        if fn == "tool_product_lookup":
            return {"reply": natural_format(user, tool_product_lookup(args["query"]))}

        if fn == "tool_order_lookup":
            return {"reply": natural_format(user, tool_order_lookup(args["order_id"]))}

        if fn == "tool_refund_policy":
            return {"reply": natural_format(user, tool_refund_policy())}

    # 6) FALLBACK
    return {"reply": choice.message.content}
