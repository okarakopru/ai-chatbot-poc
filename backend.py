import json
import os
import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

# OpenAI key from environment variable
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app = FastAPI()

# allow frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------
# LOAD DATA
# ------------------------------------------------------------
products = json.load(open("products.json"))
orders = json.load(open("orders.json"))
return_policy = json.load(open("return_policy.json"))

memory = {
    "last_product": None,
    "last_order_id": None,
    "last_intent": None
}

# ------------------------------------------------------------
# SEMANTIC SEARCH
# ------------------------------------------------------------
def embed(text):
    res = client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return res.data[0].embedding

def cosine_similarity(a, b):
    a, b = np.array(a), np.array(b)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

product_names = [info["name"] for info in products.values()]
product_vectors = [embed(name) for name in product_names]

def vector_search_product(query):
    q_vec = embed(query)
    scores = [cosine_similarity(q_vec, p_vec) for p_vec in product_vectors]
    return product_names[int(np.argmax(scores))]

# ------------------------------------------------------------
# AI DETECT: ORDER ID MISSING
# ------------------------------------------------------------
def ai_order_id_missing(user_message):
    prompt = f"""
    Does the user indicate they do NOT know their order ID?
    Respond ONLY YES or NO.

    User message: "{user_message}"
    """

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}]
    )

    return r.choices[0].message.content.strip().lower() == "yes"

# ------------------------------------------------------------
# DATA TOOLS (raw functions)
# ------------------------------------------------------------
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
    memory["last_product"] = best
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

# ------------------------------------------------------------
# NATURAL RESPONSE FORMATTER
# ------------------------------------------------------------
def natural_format(user_message, data):
    prompt = f"""
    Turn this tool result into a friendly, human-like customer support answer.
    Do NOT invent facts.

    User: "{user_message}"

    Data:
    {json.dumps(data)}

    Make the tone friendly, concise, and helpful.
    Offer one optional suggestion.
    """

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "assistant", "content": prompt}]
    )

    return r.choices[0].message.content.strip()

# ------------------------------------------------------------
# MAIN AGENT LOGIC
# ------------------------------------------------------------
class ChatInput(BaseModel):
    message: str

@app.post("/chat")
def chat(req: ChatInput):
    user_msg = req.message
    lower = user_msg.lower()

    # Memory-based referential understanding
    if any(w in lower for w in ["it", "this", "that"]) and memory["last_product"]:
        data = tool_product_lookup(memory["last_product"])
        return {"reply": natural_format(user_msg, data)}

    # Order ID missing detection
    if memory["last_intent"] == "order" and ai_order_id_missing(user_msg):
        product = vector_search_product(user_msg)
        data = tool_product_lookup(product)
        return {
            "reply": (
                f"It seems you don’t know your order ID.\n\n"
                f"But I found you’re referring to **{data['name']}**.\n"
                f"It costs {data['price']} and is {data['stock']}.\n\n"
                f"To track the order, please check your email for your confirmation number."
            )
        }

    # If user asks for order without ID
    if "where is my order" in lower or "track my order" in lower:
        memory["last_intent"] = "order"
        return {"reply": "I can help with that! Could you please tell me your order ID?"}

    # Let the agent reason & choose tool plan
    plan = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are an AI support agent. Think step by step and pick the correct tool."},
            {"role": "user", "content": user_msg}
        ],
        tools=[
            {
                "type": "function",
                "function": {
                    "name": "tool_product_lookup",
                    "description": "Return product info (semantic vector search).",
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
                    "description": "Return the refund policy.",
                    "parameters": {"type": "object", "properties": {}}
                }
            }
        ],
        tool_choice="auto"
    )

    choice = plan.choices[0]

    # If AI triggers a tool
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

    # fallback
    return {"reply": choice.message.content}
