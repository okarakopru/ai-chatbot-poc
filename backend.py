import json
import os
import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from openai import OpenAI

# ============================================================
# OPENAI CLIENT (SAFE)
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
# MEMORY (Dual-layer)
# ============================================================
memory = {
    "order_product": None,          # product mentioned when trying to track an order
    "conversation_product": None,   # last product discussed in the conversation
    "last_intent": None,
    "last_order_id": None
}

# ============================================================
# SEMANTIC SEARCH (Embedding)
# ============================================================
def embed(text):
    r = client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return np.array(r.data[0].embedding)

def cosine(a, b):
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

# Precompute product vectors
product_names = [info["name"] for info in products.values()]
product_vectors = [embed(name) for name in product_names]

def semantic_product(query):
    q_vec = embed(query)
    scores = [cosine(q_vec, p_vec) for p_vec in product_vectors]
    return product_names[int(np.argmax(scores))]

# ============================================================
# LEVEL 6.2 — FULLY AI-GENERATED CATEGORIES
# ============================================================
def semantic_filter_products(query):
    """
    Find all products semantically related to the user query.
    A product is included if similarity score exceeds threshold.
    """
    q_vec = embed(query)
    filtered = []
    for info, p_vec in zip(products.values(), product_vectors):
        score = cosine(q_vec, p_vec)
        if score > 0.40:   # good threshold for fuzzy grouping
            filtered.append(info)

    return filtered if filtered else list(products.values())


def generate_category_name(product_list, user_query):
    """
    Ask AI to create a meaningful category name
    based on the given product list + user’s query.
    """
    product_names_joined = ", ".join([p["name"] for p in product_list])

    prompt = f"""
    You are an intelligent product classification system.

    The user asked: "{user_query}"

    Here is the list of products that semantically match their query:
    {product_names_joined}

    Your task:
    - Invent a human-friendly CATEGORY NAME that represents these products.
    - Keep it short (1–3 words).
    - Do NOT use made-up products.
    - Respond ONLY with the category name.

    Example outputs:
    - "Audio Devices"
    - "Camera Gear"
    - "Charging Accessories"
    - "Wearables"
    """

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
    )

    return r.choices[0].message.content.strip()


# ============================================================
# ORDER ID MISSING DETECTOR
# ============================================================
def ai_order_id_missing(msg):
    prompt = f"""
    Does the user indicate they do NOT know their order ID?
    Respond ONLY YES or NO.

    User: "{msg}"
    """
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}]
    )
    return r.choices[0].message.content.strip().lower() == "yes"



# ============================================================
# TOOL FUNCTIONS
# ============================================================
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


def tool_list_products(query):
    """
    Advanced semantic product explorer:
    - Find semantically related products
    - Ask AI to produce a category name dynamically
    """
    related = semantic_filter_products(query)
    category_name = generate_category_name(related, query)

    memory["last_intent"] = "product"

    return {
        "type": "product_list",
        "category": category_name,
        "products": related
    }


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


def tool_refund_policy():
    memory["last_intent"] = "refund"
    return {"type": "refund_policy", "policy": return_policy["policy"]}



# ============================================================
# NATURAL RESPONSE FORMATTER
# ============================================================
def natural_format(user_msg, data):
    prompt = f"""
    You are a friendly multilingual e-commerce assistant.

    Convert the following tool output into a clear, human-like answer.
    DO NOT invent facts.

    User said: "{user_msg}"

    Tool data:
    {json.dumps(data, indent=2)}

    Rules:
    - If product_list: list each product with price & stock.
    - If product_info: explain price, stock, suggestion.
    - If order_info: clearly describe delivery status & next step.
    - If refund_policy: explain the refund conditions.
    - Use same language as user.
    - Add ONE friendly suggestion.
    """
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "assistant", "content": prompt}]
    )
    return r.choices[0].message.content.strip()


# ============================================================
# SERVE FRONTEND
# ============================================================
@app.get("/", response_class=HTMLResponse)
def serve_frontend():
    with open("index.html", "r", encoding="utf-8") as f:
        return f.read()


# ============================================================
# CHAT INPUT MODEL
# ============================================================
class ChatInput(BaseModel):
    message: str


# ============================================================
# MAIN AI AGENT (LEVEL 6.2)
# ============================================================
@app.post("/chat")
def chat(req: ChatInput):
    user = req.message
    lower = user.lower()

    # -------------------------------------------------------
    # 0) TOPIC RECALL PATCH
    # -------------------------------------------------------
    topic_phrases = [
        "what were we talking",
        "what we were talking",
        "what was the topic",
        "what did we talk about",
        "konuşmanın başında",
        "نحن كنا نتحدث"
    ]

    if any(p in lower for p in topic_phrases):
        if memory["conversation_product"]:
            info = tool_product_lookup(memory["conversation_product"])
            return {"reply": natural_format(user, info)}
        return {"reply": "We were having a general conversation earlier. How may I assist you now?"}

    # -------------------------------------------------------
    # 1) REFERENTIAL ("it / this / that")
    # -------------------------------------------------------
    if any(w in lower for w in ["it", "this", "that"]):
        if memory["last_intent"] == "order" and memory["order_product"]:
            data = tool_product_lookup(memory["order_product"])
            return {"reply": natural_format(user, data)}

        if memory["conversation_product"]:
            data = tool_product_lookup(memory["conversation_product"])
            return {"reply": natural_format(user, data)}

    # -------------------------------------------------------
    # 2) ORDER ID MISSING LOGIC
    # -------------------------------------------------------
    if memory["last_intent"] == "order" and ai_order_id_missing(user):
        product = semantic_product(user)
        memory["order_product"] = product
        details = tool_product_lookup(product)

        return {
            "reply":
            f"It seems you don’t know your order ID.\n\n"
            f"You mentioned **{details['name']}**.\n"
            f"It costs {details['price']} and is {details['stock']}.\n\n"
            f"Please check your email for the confirmation number so I can track it."
        }

    # -------------------------------------------------------
    # 3) ORDER ASKED WITHOUT ID
    # -------------------------------------------------------
    if "where is my order" in lower or "track my order" in lower:
        memory["last_intent"] = "order"
        return {"reply": "Sure — can you share your order ID?"}

    # -------------------------------------------------------
    # 4) AI TOOL ROUTER (FUNCTION CALLING)
    # -------------------------------------------------------
    router = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are an AI support agent. Choose the correct tool."},
            {"role": "user", "content": user}
        ],
        tools=[
            {
                "type": "function",
                "function": {
                    "name": "tool_product_lookup",
                    "description": "Return product info.",
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
                    "description": "Dynamic semantic product explorer.",
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
                    "description": "Return order tracking info.",
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
                    "description": "Return refund policy.",
                    "parameters": {"type": "object", "properties": {}}
                }
            }
        ],
        tool_choice="auto"
    )

    choice = router.choices[0]

    # -------------------------------------------------------
    # 5) TOOL EXECUTION
    # -------------------------------------------------------
    if choice.finish_reason == "tool_calls":
        call = choice.message.tool_calls[0]
        fn = call.function.name
        args = json.loads(call.function.arguments)

        if fn == "tool_product_lookup":
            return {"reply": natural_format(user, tool_product_lookup(args["query"]))}

        if fn == "tool_list_products":
            return {"reply": natural_format(user, tool_list_products(args["query"]))}

        if fn == "tool_order_lookup":
            return {"reply": natural_format(user, tool_order_lookup(args["order_id"]))}

        if fn == "tool_refund_policy":
            return {"reply": natural_format(user, tool_refund_policy())}

    # -------------------------------------------------------
    # 6) FALLBACK (natural chat)
    # -------------------------------------------------------
    return {"reply": choice.message.content}
