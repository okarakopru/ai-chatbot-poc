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
# LEVEL 8.2 MEMORY (Dual-channel)
# ============================================================
memory = {
    "conversation_product": None,
    "order_product": None,
    "last_intent": None,
    "last_order_id": None
}

# ============================================================
# LANGUAGE DETECTION (drift-proof)
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
        # Fallback: LLM-based detection
        prompt = f"""
        Detect the language of this message.
        Respond with ONLY: English, Turkish, Arabic, Spanish, Other.

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
# AI DETECTORS
# ============================================================
def ai_topic_recall(msg):
    prompt = f"""
    Is the user asking to recall the earlier topic of conversation?

    Examples of YES:
    - what were we talking about
    - what was the topic earlier
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


def ai_order_id_missing(msg):
    prompt = f"""
    Determine if the user is saying they DO NOT KNOW their order ID.

    Respond ONLY YES or NO.

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
    # Regex first
    ids = re.findall(r"\b(\d{5})\b", msg)
    if ids:
        return ids[0]

    # AI fallback
    prompt = f"""
    Extract the 5-digit order ID from the message below.
    Respond ONLY with the 5-digit number. If none found, respond NONE.

    Message: "{msg}"
    """
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )
    ans = r.choices[0].message.content.strip()
    return ans if ans.isdigit() and len(ans)==5 else None


# ============================================================
# LEVEL 7 — FULL AI PRODUCT EXPLORER
# ============================================================
def tool_ai_product_explorer(query):
    product_list = list(products.values())

    prompt = f"""
    You are an advanced AI product discovery engine.

    USER QUERY:
    "{query}"

    PRODUCT CATALOG:
    {json.dumps(product_list, indent=2)}

    TASK:
    - Identify relevant products (semantic reasoning).
    - If user asks "what products do you have?" return ALL.
    - If implicit category (camera, audio, fitness, charging, etc.) → return those.
    - Create a short category name (1–3 words).
    - Return STRICT JSON ONLY:

    {{
       "category": "Category Name",
       "products": [
          {{"name":"...", "price":"...", "stock":"..."}}
       ]
    }}

    RULES:
    - DO NOT invent new products.
    - DO NOT modify price or stock.
    - ONLY use products from catalog.
    """

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )

    raw = r.choices[0].message.content.strip()

    try:
        data = json.loads(raw)
        memory["last_intent"] = "product"

        if len(data.get("products",[]))==1:
            memory["conversation_product"] = data["products"][0]["name"]

        return {
            "type":"product_list",
            "category":data.get("category","Products"),
            "products":data.get("products",[])
        }
    except:
        return {
            "type":"product_list",
            "category":"All Products",
            "products":product_list
        }


def tool_product_lookup(query):
    # Use AI explorer itself
    result = tool_ai_product_explorer(query)

    if len(result["products"]) == 1:
        p = result["products"][0]
        memory["conversation_product"] = p["name"]
        return {
            "type":"product_info",
            "name":p["name"],
            "price":p["price"],
            "stock":p["stock"]
        }

    # Multiple products → ask AI
    names = [p["name"] for p in result["products"]]

    prompt = f"""
    User asked: "{query}"
    Options: {names}

    Which single product is the closest match?
    Respond ONLY with the product name.
    """

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )

    best = r.choices[0].message.content.strip()

    for p in result["products"]:
        if p["name"].lower()==best.lower():
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
    memory["last_intent"]="order"
    memory["last_order_id"]=order_id

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
    memory["last_intent"]="refund"
    return {"type":"refund_policy","policy":return_policy["policy"]}


# ============================================================
# NATURAL FORMATTER (drift-proof)
# ============================================================
def natural_format(user_msg, tool_data):
    user_lang = detect_language(user_msg)

    prompt = f"""
    You are a multilingual customer support assistant.

    USER LANGUAGE = {user_lang}

    Respond STRICTLY in {user_lang}.
    IGNORE:
    - the language of TOOL_DATA
    - the language of previous assistant messages
    - internal reasoning

    DO NOT:
    - invent facts
    - modify price
    - modify stock
    - add misinformation

    TOOL_DATA:
    {json.dumps(tool_data, indent=2)}

    USER SAID:
    "{user_msg}"

    RULES:
    - If product_list: list items clearly.
    - If product_info: provide availability + suggestion.
    - If order_info: describe delivery + next steps.
    - If refund_policy: describe return window simply.
    - Add ONE friendly suggestion.
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
    with open("index.html","r",encoding="utf-8") as f:
        return f.read()


# ============================================================
# REQUEST MODEL
# ============================================================
class ChatInput(BaseModel):
    message: str


# ============================================================
# MAIN AGENT — LEVEL 8.2 FINAL
# ============================================================
@app.post("/chat")
def chat(req:ChatInput):
    user = req.message
    lower = user.lower()

    # -----------------------------------------
    # 0) AI TOPIC RECALL (fully AI-based)
    # -----------------------------------------
    if ai_topic_recall(user):
        if memory["conversation_product"]:
            info = tool_product_lookup(memory["conversation_product"])
            return {"reply": natural_format(user, info)}
        return {"reply":"We were having a general conversation earlier. How can I assist you now?"}

    # -----------------------------------------
    # 1) REFERENTIAL ("it", "this", "that")
    # -----------------------------------------
    if any(w in lower for w in ["it","this","that"]):
        if memory["last_intent"]=="order" and memory["order_product"]:
            info = tool_product_lookup(memory["order_product"])
            return {"reply": natural_format(user, info)}

        if memory["conversation_product"]:
            info = tool_product_lookup(memory["conversation_product"])
            return {"reply": natural_format(user, info)}

    # -----------------------------------------
    # 2) ORDER ID MISSING
    # -----------------------------------------
    if memory["last_intent"]=="order" and ai_order_id_missing(user):
        explorer = tool_ai_product_explorer(user)
        if explorer["products"]:
            p = explorer["products"][0]
            memory["order_product"]=p["name"]
            return {"reply":
                f"It looks like you don’t know your order ID.\n\n"
                f"You mentioned **{p['name']}**.\n"
                f"It costs {p['price']} and is {p['stock']}.\n\n"
                "Please check your email for your confirmation number so I can track it."
            }

    # -----------------------------------------
    # 3) ORDER ASKED WITHOUT ID
    # -----------------------------------------
    if "where is my order" in lower or "track my order" in lower:
        # Try regex + AI extraction automatically
        extracted_id = extract_order_id(user)
        if extracted_id:
            data = tool_order_lookup(extracted_id)
            return {"reply": natural_format(user, data)}

        memory["last_intent"]="order"
        return {"reply": "Sure — could you share your order ID?"}

    # -----------------------------------------
    # 4) ROUTER (AI chooses tool)
    # -----------------------------------------
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
                    "description":"Single product detail",
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

    # -----------------------------------------
    # 5) TOOL EXECUTION
    # -----------------------------------------
    if choice.finish_reason=="tool_calls":
        call = choice.message.tool_calls[0]
        fn = call.function.name
        args = json.loads(call.function.arguments)

        if fn=="tool_ai_product_explorer":
            return {"reply": natural_format(user, tool_ai_product_explorer(args["query"]))}

        if fn=="tool_product_lookup":
            return {"reply": natural_format(user, tool_product_lookup(args["query"]))}

        if fn=="tool_order_lookup":
            return {"reply": natural_format(user, tool_order_lookup(args["order_id"]))}

        if fn=="tool_refund_policy":
            return {"reply": natural_format(user, tool_refund_policy())}

    # -----------------------------------------
    # 6) FALLBACK
    # -----------------------------------------
    return {"reply": choice.message.content}
