from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
import json

client = OpenAI(api_key="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")

app = FastAPI()

# CORS (Frontend'in backend'e bağlanması için)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load datasets
products = json.load(open("products.json"))
orders = json.load(open("orders.json"))
return_policy = json.load(open("return_policy.json"))

class ChatRequest(BaseModel):
    message: str

def detect_intent(text):
    text = text.lower()
    if "order" in text or "#" in text:
        return "order"
    elif "return" in text or "refund" in text:
        return "refund"
    elif "product" in text or "price" in text:
        return "product"
    return "unknown"

def fallback_llm(user_input):
    res = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a helpful bilingual assistant."},
            {"role": "user", "content": user_input}
        ]
    )
    return res.choices[0].message.content

@app.post("/chat")
def chat(req: ChatRequest):

    intent = detect_intent(req.message)

    if intent == "order":
        for order_id, info in orders.items():
            if order_id in req.message:
                return {
                    "reply": f"Order #{order_id} is {info['status']} (Delivery: {info['delivery_date']})."
                }
        return {"reply": "I couldn't find that order. Please provide your order ID."}

    elif intent == "product":
        for pid, info in products.items():
            if info["name"].lower().split()[0] in req.message.lower():
                return {
                    "reply": f"{info['name']} costs {info['price']} and is {info['stock']}."
                }
        return {"reply": "Can you specify which product?"}

    elif intent == "refund":
        return {"reply": return_policy["policy"]}

    else:
        return {"reply": fallback_llm(req.message)}
