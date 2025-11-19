import json
import os
import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from openai import OpenAI

# ================================================
# OPENAI CLIENT (SAFE)
# ================================================
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ================================================
# FASTAPI APP + CORS
# ================================================
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================================================
# LOAD DATA
# ================================================
products = json.load(open("products.json"))
orders = json.load(open("orders.json"))
return_policy = json.load(open("return_policy.json"))

# ================================================
# LEVEL 5.5 MEMORY MODEL
# ================================================
memory = {
    "order_product": None,
    "conversation_product": None,
    "last_intent": None,
    "last_order_id": None
}

# ================================================
# EMBEDDING + SEMANTIC SEARCH
# ================================================
def embed(text):
    r = client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return np.array(r.data[0].embedding)

def cosine(a, b):
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

# embed all products
product_names = [info["name"] for info in products.values()]
product_vectors = [embed(name) for name in product_names]

def semantic_product(query):
    q_vec = embed(query)
    scores = [cosine(q_vec, p_vec) for p_vec in product_vectors]
    return product_names[int(np.argmax(scores))]

# ================================================
# LEVEL 6 – MULTILINGUAL SMART CATEGORY SYSTEM
# ================================================
CATEGORIES = {
    "camera": [
        "camera", "action camera", "sport camera", "video",
        "4k", "cam", "record", "kamera", "كاميرا"
    ],
    "audio": [
        "audio", "sound", "music", "ear", "headphone", "earbuds",
        "kulaklık", "ses", "سماعة"
    ],
    "fitness": [
        "fitness", "health", "exercise", "tracker", "sport",
        "spor", "fit", "band", "رياضي"
    ],
    "charging": [
        "charger", "usb", "power", "şarj", "battery", "charge",
        "powerbank", "باور"
    ],
    "lighting": [
        "led", "light", "strip", "rgb", "ışık", "照明"
    ]
}

# precompute category vectors
CAT_VECTORS = {}
for cat, words in CATEGORIES.items():
    vecs = [embed(w) for w in words]
    CAT_VECTORS[cat] = np.mean(vecs, axis=0)

def semantic_category(query):
    q_vec = embed(query)
    scores = {
        cat: cosine(q_vec, vec)
        for cat, vec in CAT_VECTORS.items()
    }
    best_cat, best_score = max(scores.items(), key=lambda x: x[1])
    return best_cat if best_score > 0.55 else None  # threshold

def filter_products_by_category(category):
    """Return product list by category using semantic similarity."""
    if category is None:
        return list(products.values())

    result = []
    for info in products.values():
        p_vec = embed(info["name"])
        score = cosine(p_vec, CAT_VECTORS[category])
        if score > 0.50:
            result.append(info)

    return result if result else list(products.values())  # fallback all

# ================================================
# AI DETECTOR: "order id missing"
# ================================================
def ai_order_id_missing(msg):
    prompt = f"""
    Does the user indicate they DO NOT KNOW their order ID?
    Respond only with YES or NO.

    User: "{msg}"
    """
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}]
    )
    return r.choices[0].message.content.strip().lower() == "yes"

# ================================================
# RAW TOOLS
# ================================================
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

def tool_product_lookup(query):
    best = semantic_product(query)
    memory["conversation_product"] = best
    memory["last_intent"] = "product"

    info = next(i for i in products.values() if i["name"].lower() == best.lower())
    return {
        "type": "product_info",
        "name": best,
        "price": info["price"],
        "stock": info["stock"]
    }

def tool_refund_policy():
    memory["last_intent"] = "refund"
    return {"type": "refund_policy", "policy": return_policy["policy"]}

def tool_list_products(query):
    """Smart explorer: category-based or full list."""
    category = semantic_category(query)
    filtered = filter_products_by_category(category)

    memory["last_intent"] = "product"

    return {
        "type": "product_list",
        "category": category,
        "products": filtered
    }

# ================================================
# NATURAL FORMATTER (LLM)
# ================================================
def natural_format(user_msg, data):
    prompt = f"""
    You are a friendly multilingual e-commerce support agent.

    Convert the following tool output into a clear human-friendly answer.
    DO NOT invent facts.

    User message: "{user_msg}"

    Tool output:
    {json.dumps(data, indent=2)}

    Guidelines:
    - If product_list: list each item with price & stock.
    - If single product: explain price, stock, suggestion.
    - If order tracking: explain status and next step.
    - If refund: mention the 14-day rule.
    - Add ONE friendly suggestion at the end.
    - Respond in the same language as the user when possible.
    """

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "assistant", "content": prompt}]
    )
    return r.choices[0].message.content.strip()

# ================================================
# FRONTEND (index.html)
# ================================================
@app.get("/", response_class=HTMLResponse)
def serve_frontend():
    with open("index.html", "r", encoding="utf-8") as f:
        return f.read()

# ================================================
# CHAT INPUT MODEL
# ================================================
class ChatInput(BaseModel):
    message: str

# ================================================
# MAIN AGENT (Level 6)
# ================================================
@app.post("/chat")
def chat(req: ChatInput):
    user = req.message
    lower = user.lower()

    # ----------------------------------------
    # 1) REFERENTIAL: "it / this / that"
    # ----------------------------------------
    if any(w in lower for w in ["it", "this", "that"]):
        if memory["last_intent"] == "order" and memory["order_product"]:
            info = tool_product_lookup(memory["order_product"])
            return {"reply": natural_format(user, info)}

        if memory["conversation_product"]:
            info = tool_product_lookup(memory["conversation_product"])
            return {"reply": natural_format(user, info)}

    # ----------------------------------------
    # 2) ORDER ID MISSING
    # ----------------------------------------
    if memory["last_intent"] == "order" and ai_order_id_missing(user):
        product = semantic_product(user)
        memory["order_product"] = product
        details = tool_product_lookup(product)

        return {
            "reply":
            f"It seems you don’t know your order ID.\n\n"
            f"The product you mentioned is **{details['name']}**.\n"
            f"It costs {details['price']} and is {details['stock']}.\n\n"
            f"Please check your email for the confirmation number so I can track it."
        }

    # ----------------------------------------
    # 3) ORDER REQUEST WITHOUT ID
    # ----------------------------------------
    if "where is my order" in lower or "track my order" in lower:
        memory["last_intent"] = "order"
        return {"reply": "Sure — can you share your order ID?"}

    # ----------------------------------------
    # 4) CALL LLM ROUTER WITH ALL TOOLS
    # ----------------------------------------
    router = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are an AI agent. Pick the correct tool."},
            {"role": "user",
             "content": user}
        ],
        tools=[
            {
                "type": "function",
                "function": {
                    "name": "tool_product_lookup",
                    "description": "Return product info",
                    "parameters": {
                        "type": "object",
                        "properties": {"query": {"type": "string"}},
                        "required": ["query"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "tool_list_products",
                    "description": "Return a category-based product list or full list",
                    "parameters": {
                        "type": "object",
                        "properties": {"query": {"type": "string"}},
                        "required": ["query"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "tool_order_lookup",
                    "description": "Track an order by ID",
                    "parameters": {
                        "type": "object",
                        "properties": {"order_id": {"type": "string"}},
                        "required": ["order_id"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "tool_refund_policy",
                    "description": "Return refund policy",
                    "parameters": {"type": "object", "properties": {}}
                }
            }
        ],
        tool_choice="auto"
    )

    choice = router.choices[0]

    # ----------------------------------------
    # 5) EXECUTE TOOL
    # ----------------------------------------
    if choice.finish_reason == "tool_calls":
        call = choice.message.tool_calls[0]
        fn = call.function.name
        args = json.loads(call.function.arguments)

        if fn == "tool_product_lookup":
            data = tool_product_lookup(args["query"])
            return {"reply": natural_format(user, data)}

        if fn == "tool_list_products":
            data = tool_list_products(args["query"])
            return {"reply": natural_format(user, data)}

        if fn == "tool_order_lookup":
            data = tool_order_lookup(args["order_id"])
            return {"reply": natural_format(user, data)}

        if fn == "tool_refund_policy":
            data = tool_refund_policy()
            return {"reply": natural_format(user, data)}

    # ----------------------------------------
    # 6) FALLBACK (normal chat)
    # ----------------------------------------
    return {"reply": choice.message.content}
