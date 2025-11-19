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
# MEMORY (Level 4 / Level 5 behaviors)
# ================================================
memory = {
    "last_product": None,
    "last_order_id": None,
    "last_intent": None
}

# ================================================
# SEMANTIC SEARCH (Level 3)
# ================================================
def embed(text):
    """Create embedding vector for semantic similarity."""
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
    """Semantic search to find the closest matching product."""
    q_vec = embed(query)
    scores = [cosine_similarity(q_vec, p_vec) for p_vec in product_vectors]
    best_index = int(np.argmax(scores))
    return product_names[best_index]

# ================================================
# AI DETECTOR — “User doesn’t know order ID”
# ================================================
def ai_order_id_missing(user_msg):
    prompt = f"""
    Determine if the user is saying they DO NOT KNOW their order ID.
    Respond ONLY with YES or NO.

    User: "{user_msg}"
    """
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}]
    )
    return r.choices[0].message.content.strip().lower() == "yes"

# ================================================
# TOOL IMPLEMENTATIONS (Raw Data Functions)
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
            "delivery": info["delivery_date"],
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

# ================================================
# NATURAL RESPONSE FORMATTER (LLM)
# ================================================
def natural_format(user_message, data):
    """LLM styles the tool result into a friendly agent response."""
    prompt = f"""
    You are a friendly customer support agent.

    Convert the following tool output into a helpful, human-like answer.
    DO NOT invent facts.

    User: "{user_message}"

    Tool result:
    {json.dumps(data)}

    Requirements:
    - Be natural
    - Be concise
    - Add ONE friendly suggestion
    - Keep factual data unchanged
    """

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "assistant", "content": prompt}]
    )

    return r.choices[0].message.content.strip()

# ================================================
# FRONTEND ROUTE — SERVE index.html FROM ROOT
# ================================================
@app.get("/", response_class=HTMLResponse)
def serve_frontend():
    """Serves the frontend chatbot UI."""
    with open("index.html", "r", encoding="utf-8") as f:
        html = f.read()
    return HTMLResponse(content=html)

# ================================================
# API SCHEMA
# ================================================
class ChatInput(BaseModel):
    message: str

# ================================================
# MAIN AI AGENT ENDPOINT (Level 5)
# ================================================
@app.post("/chat")
def chat(req: ChatInput):
    user_msg = req.message
    lower = user_msg.lower()

    # -------------------------
    # 1. REFERENTIAL: “is it / this / that”
    # -------------------------
    if any(w in lower for w in ["it", "this", "that"]) and memory["last_product"]:
        data = tool_product_lookup(memory["last_product"])
        return {"reply": natural_format(user_msg, data)}

    # -------------------------
    # 2. ORDER ID Missing (AI detected)
    # -------------------------
    if memory["last_intent"] == "order" and ai_order_id_missing(user_msg):
        product_name = vector_search_product(user_msg)
        data = tool_product_lookup(product_name)

        return {
            "reply":
            f"It seems you don’t know your order ID.\n\n"
            f"You mentioned **{data['name']}**.\n"
            f"It costs {data['price']} and is {data['stock']}.\n\n"
            f"To continue tracking, please check your email for your order confirmation number."
        }

    # -------------------------
    # 3. Natural Order Request without ID
    # -------------------------
    if "where is my order" in lower or "track my order" in lower:
        memory["last_intent"] = "order"
        return {"reply": "Sure! Can you please share your order ID so I can check the status?"}

    # -------------------------
    # 4. AI TOOL ROUTER (Function Calling)
    # -------------------------
    router = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are an AI customer support agent. Think step-by-step and choose the right tool."},
            {"role": "user", "content": user_msg}
        ],
        tools=[
            {
                "type": "function",
                "function": {
                    "name": "tool_product_lookup",
                    "description": "Return product info from semantic vector search.",
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
                    "description": "Return the refund policy.",
                    "parameters": {"type": "object", "properties": {}}
                }
            }
        ],
        tool_choice="auto"
    )

    choice = router.choices[0]

    # If a tool is selected
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

    # fallback: natural LLM response
    return {"reply": choice.message.content}
