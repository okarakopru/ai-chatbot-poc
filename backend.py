import json
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from openai import OpenAI

# ============================================================
# OPENAI CLIENT (SAFE — uses environment variable)
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
# LEVEL 8 MEMORY (Dual-channel)
# ============================================================
memory = {
    "conversation_product": None,   # free conversation context
    "order_product": None,          # product mentioned in order-related dialogue
    "last_intent": None,
    "last_order_id": None
}

# ============================================================
# AI DETECTORS
# ============================================================

def ai_topic_recall(msg):
    """AI detects whether the user is asking about past conversation topic."""
    prompt = f"""
    Determine if the user is asking about the earlier topic of conversation.

    Examples of YES:
    - what were we talking about?
    - what did we discuss earlier?
    - what was the topic at the beginning?
    - konuşmanın başında ne konuşuyorduk?
    - ما الذي تحدثنا عنه سابقاً؟

    Respond ONLY YES or NO.

    User: "{msg}"
    """
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )
    return r.choices[0].message.content.strip().lower() == "yes"


def ai_order_id_missing(msg):
    """AI detects the user is saying they do NOT know the order ID."""
    prompt = f"""
    Does the user indicate they do NOT know their order ID?

    Examples of YES:
    - I don't know my order ID
    - I can't remember the order number
    - I lost my order id
    - sipariş numaramı hatırlamıyorum
    - لا أعرف رقم الطلب

    Respond ONLY YES or NO.

    User: "{msg}"
    """
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )
    return r.choices[0].message.content.strip().lower() == "yes"


# ============================================================
# LEVEL 7 — Fully AI-driven Product Explorer
# No embeddings, no categories, no rules → Pure AI reasoning
# ============================================================
def tool_ai_product_explorer(query):
    """AI chooses relevant products AND generates a category name."""

    product_list = list(products.values())

    prompt = f"""
    You are an advanced AI product discovery engine.

    USER QUERY:
    "{query}"

    AVAILABLE PRODUCTS (JSON):
    {json.dumps(product_list, indent=2)}

    TASK:
    - Understand the user's intent.
    - Identify which products match the query semantically.
    - If the user asks "what products do you have", "show all products", etc → return ALL.
    - If the query hints at a category (camera, sound, earphones, charging, fitness…)
      → filter products intelligently.
    - Create a CATEGORY NAME (1–3 words).
    - Return STRICT JSON:

    {{
      "category": "Category Name",
      "products": [
        {{"name":"...", "price":"...", "stock":"..."}}
      ]
    }}

    RULES:
    - DO NOT invent new products not listed in catalog.
    - DO NOT change price or stock.
    - ONLY use product names FROM the catalog.
    """

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )

    raw = r.choices[0].message.content.strip()

    try:
        data = json.loads(raw)
        memory["last_intent"] = "product"

        # If a single product returned → set conversation_product memory
        if len(data.get("products", [])) == 1:
            memory["conversation_product"] = data["products"][0]["name"]

        return {
            "type":"product_list",
            "category": data.get("category","Products"),
            "products": data.get("products",[])
        }

    except:
        # fallback: return all
        return {
            "type":"product_list",
            "category":"All Products",
            "products":product_list
        }


def tool_product_lookup(query):
    """Use AI explorer itself to get the best product."""
    explorer = tool_ai_product_explorer(query)

    if len(explorer["products"]) == 1:
        p = explorer["products"][0]
        memory["conversation_product"] = p["name"]
        memory["last_intent"] = "product"
        return {
            "type":"product_info",
            "name":p["name"],
            "price":p["price"],
            "stock":p["stock"]
        }

    # AI decides which SINGLE product fits
    names = [p["name"] for p in explorer["products"]]

    prompt = f"""
    USER ASKED: "{query}"

    OPTIONS: {names}

    Which ONE of these products is the closest match?
    Respond ONLY with the product name.
    """

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )

    best = r.choices[0].message.content.strip()

    # find the chosen product
    for p in explorer["products"]:
        if p["name"].lower() == best.lower():
            memory["conversation_product"] = p["name"]
            return {
                "type":"product_info",
                "name":p["name"],
                "price":p["price"],
                "stock":p["stock"]
            }

    # fallback
    p = explorer["products"][0]
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
# NATURAL FORMATTER
# ============================================================
def natural_format(user_msg, data):
    prompt = f"""
    You are a friendly multilingual e-commerce assistant.

    Convert this into a natural, helpful, human-like message:
    DO NOT change facts.

    USER: "{user_msg}"
    TOOL DATA:
    {json.dumps(data, indent=2)}

    RULES:
    - If product_list: list products nicely.
    - If product_info: describe price, stock, availability.
    - If order_info: explain order status & next steps.
    - If refund_policy: explain return policy simply.
    - Respond in the SAME language as the user.
    - Add ONE friendly suggestion at the end.
    """

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"assistant","content":prompt}]
    )
    return r.choices[0].message.content.strip()


# ============================================================
# SERVE FRONTEND
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
# MAIN AGENT — LEVEL 8
# ============================================================
@app.post("/chat")
def chat(req: ChatInput):
    user = req.message
    lower = user.lower()

    # -------------------------------------------------------
    # 0) AI TOPIC RECALL (NEW — FULLY AI BASED)
    # -------------------------------------------------------
    if ai_topic_recall(user):
        if memory["conversation_product"]:
            info = tool_product_lookup(memory["conversation_product"])
            return {"reply": natural_format(user, info)}
        return {"reply":"We were having a general conversation earlier. How can I assist you now?"}

    # -------------------------------------------------------
    # 1) REFERENTIAL ("it", "this", "that")
    # -------------------------------------------------------
    if any(w in lower for w in ["it","this","that"]):
        if memory["last_intent"] == "order" and memory["order_product"]:
            info = tool_product_lookup(memory["order_product"])
            return {"reply": natural_format(user, info)}

        if memory["conversation_product"]:
            info = tool_product_lookup(memory["conversation_product"])
            return {"reply": natural_format(user, info)}

    # -------------------------------------------------------
    # 2) ORDER ID MISSING (AI based)
    # -------------------------------------------------------
    if memory["last_intent"] == "order" and ai_order_id_missing(user):
        data = tool_ai_product_explorer(user)
        if data["products"]:
            p = data["products"][0]
            memory["order_product"] = p["name"]
            return {
                "reply":
                f"It seems you don’t know your order ID.\n\n"
                f"You mentioned **{p['name']}**.\n"
                f"It costs {p['price']} and is {p['stock']}.\n\n"
                "Please check your email for your confirmation number so I can track it."
            }

    # -------------------------------------------------------
    # 3) Ask order without ID
    # -------------------------------------------------------
    if "where is my order" in lower or "track my order" in lower:
        memory["last_intent"] = "order"
        return {"reply":"Sure — could you share your order ID?"}

    # -------------------------------------------------------
    # 4) TOOL ROUTER (AI chooses correct function)
    # -------------------------------------------------------
    router = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role":"system","content":"You are an AI support agent. Pick the correct tool."},
            {"role":"user","content":user}
        ],
        tools=[
            {
                "type":"function",
                "function":{
                    "name":"tool_ai_product_explorer",
                    "description":"Fully AI-driven product explorer.",
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
                    "description":"Single product detail lookup.",
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
                    "description":"Order tracking.",
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
                    "description":"Returns refund policy.",
                    "parameters":{"type":"object","properties":{}}
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

        if fn == "tool_ai_product_explorer":
            return {"reply": natural_format(user, tool_ai_product_explorer(args["query"]))}

        if fn == "tool_product_lookup":
            return {"reply": natural_format(user, tool_product_lookup(args["query"]))}

        if fn == "tool_order_lookup":
            return {"reply": natural_format(user, tool_order_lookup(args["order_id"]))}

        if fn == "tool_refund_policy":
            return {"reply": natural_format(user, tool_refund_policy())}

    # -------------------------------------------------------
    # 6) FALLBACK
    # -------------------------------------------------------
    return {"reply": choice.message.content}
