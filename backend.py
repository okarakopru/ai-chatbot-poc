import json
import os
import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from openai import OpenAI

# ================================================
# OPENAI CLIENT (SAFE — uses environment variable)
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
# LOAD DATA (products, orders, refund policy)
# ================================================
products = json.load(open("products.json"))
orders = json.load(open("orders.json"))
return_policy = json.load(open("return_policy.json"))

# ================================================
# LEVEL 5.5 MEMORY MODEL
# ================================================
memory = {
    "order_product": None,          # user mentioned product in context of an order
    "conversation_product": None,   # general conversation product
    "last_order_id": None,
    "last_intent": None
}

# ================================================
# SEMANTIC SEARCH (Level 3)
# ================================================
def embed(text):
    r = client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return r.data[0].embedding

def cosine_similarity(a, b):
    a, b = np.array(a), np.array(b)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

product_names = [info["name"] for info in products.values()]
product_vectors = [embed(name) for name in product_names]

def vector_search_product(query):
    q_vec = embed(query)
    scores = [cosine_similarity(q_vec, p_vec) for p_vec in product_vectors]
    return product_names[int(np.argmax(scores))]

# ================================================
# AI DETECTOR — user doesn't know order ID
# ================================================
def ai_order_id_missing(user_msg):
    prompt = f"""
    Determine if the user indicates they do NOT know their order ID.
    Respond ONLY YES or NO.

    User message: "{user_msg}"
    """

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}]
    )

    return r.choices[0].message.content.strip().lower() == "yes"

# ================================================
# RAW TOOL FUNCTIONS
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
    best = vector_search_product(query)

    # general conversation memory (not order-related)
    memory["conversation_product"] = best
    memory["last_intent"] = "product"

    for pid, info in products.items():
        if info["name"].lower() == best.lower():
            return {
                "type": "product_info",
                "name": best,
                "price": info["price"],
                "stock": info["stock"]
            }

    return {"type": "product_info", "error": "Product not found"}

def tool_refund_policy():
    memory["last_intent"] = "refund"
    return {"type": "refund_policy", "policy": return_policy["policy"]}

# ================================================
# NATURAL RESPONSE FORMATTER (LLM)
# ================================================
def natural_format(user_message, data):
    prompt = f"""
    You are a friendly senior customer support agent.

    Convert the following tool output into a helpful, human-like answer.
    DO NOT invent facts.

    User said: "{user_message}"

    Tool data:
    {json.dumps(data)}

    Make the tone:
    - friendly
    - concise
    - slightly warm
    - with ONE small suggestion

    Respond naturally:
    """

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "assistant", "content": prompt}]
    )

    return r.choices[0].message.content.strip()

# ================================================
# SERVE FRONTEND (index.html)
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
# MAIN AI AGENT (LEVEL 5.5)
# ================================================
@app.post("/chat")
def chat(req: ChatInput):
    user_msg = req.message
    lower = user_msg.lower()

    # ------------------------------------------
    # 1) REFERENTIAL ("it", "this", "that")
    # ------------------------------------------
    if any(w in lower for w in ["it", "this", "that"]):
        # Prefer ORDER product if we're in an order context
        if memory["last_intent"] == "order" and memory["order_product"]:
            data = tool_product_lookup(memory["order_product"])
            return {"reply": natural_format(user_msg, data)}

        # Otherwise use general conversation product
        if memory["conversation_product"]:
            data = tool_product_lookup(memory["conversation_product"])
            return {"reply": natural_format(user_msg, data)}

    # ------------------------------------------
    # 2) ORDER ID missing (AI-based)
    # ------------------------------------------
    if memory["last_intent"] == "order" and ai_order_id_missing(user_msg):
        # Detect product from the sentence
        product = vector_search_product(user_msg)
        memory["order_product"] = product  # persistent order-related product

        # Lookup product details
        details = tool_product_lookup(product)

        return {
            "reply": (
                f"It seems you don’t know your order ID.\n\n"
                f"The product you mentioned is **{details['name']}**.\n"
                f"It costs {details['price']} and is {details['stock']}.\n\n"
                f"To continue tracking your order, "
                f"please check your email for the confirmation number."
            )
        }

    # ------------------------------------------
    # 3) Order request *without* ID
    # ------------------------------------------
    if "where is my order" in lower or "track my order" in lower:
        memory["last_intent"] = "order"
        return {"reply": "Sure — can you share your order ID so I can check it?"}

    # ------------------------------------------
    # 4) AI ROUTER — picks best tool
    # ------------------------------------------
    router = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are an AI support agent. Pick the correct tool."},
            {"role": "user", "content": user_msg}
        ],
        tools=[
            {
                "type": "function",
                "function": {
                    "name": "tool_product_lookup",
                    "description": "Return product info via semantic vector search.",
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
                    "description": "Return order info by ID.",
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

    # ------------------------------------------
    # 5) TOOL EXECUTION
    # ------------------------------------------
    if choice.finish_reason == "tool_calls":
        call = choice.message.tool_calls[0]
        fn = call.function.name
        args = json.loads(call.function.arguments)

        if fn == "tool_product_lookup":
            data = tool_product_lookup(args["query"])
            return {"reply": natural_format(user_msg, data)}

        if fn == "tool_order_lookup":
            data = tool_order_lookup(args["order_id"])
            return {"reply": natural_format(user_msg, data)}

        if fn == "tool_refund_policy":
            data = tool_refund_policy()
            return {"reply": natural_format(user_msg, data)}

    # ------------------------------------------
    # 6) FALLBACK (normal LLM)
    # ------------------------------------------
    return {"reply": choice.message.content}
