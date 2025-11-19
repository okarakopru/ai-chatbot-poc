import json
from openai import OpenAI

client = OpenAI(api_key="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")

def load_json(path):
    with open(path, "r") as f:
        return json.load(f)

# Load mock datasets
products = load_json("products.json")
orders = load_json("orders.json")
return_policy = load_json("return_policy.json")

def detect_intent(user_input):
    text = user_input.lower()
    if "order" in text or "#" in text:
        return "order"
    elif "return" in text or "refund" in text:
        return "refund"
    elif "product" in text or "price" in text:
        return "product"
    return "unknown"

def handle_order(user_input):
    for order_id, info in orders.items():
        if order_id in user_input:
            return f"Order #{order_id} is {info['status']} (Delivery: {info['delivery_date']})."
    return "I couldn't find that order. Please provide your order ID."

def handle_product(user_input):
    for pid, info in products.items():
        # Simplified matching (first word of product name)
        if info["name"].lower().split()[0] in user_input:
            return f"{info['name']} costs {info['price']} and is {info['stock']}."
    return "Can you specify which product you mean?"

def handle_refund():
    return return_policy["policy"]

def fallback_llm(user_input):
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a helpful bilingual support assistant."},
            {"role": "user", "content": user_input}
        ]
    )
    return response.choices[0].message.content

def chatbot():
    print("AI Support Chatbot (type 'exit' to quit)")
    while True:
        user_input = input("You: ")
        if user_input.lower() == "exit":
            break

        intent = detect_intent(user_input)

        if intent == "order":
            response = handle_order(user_input)
        elif intent == "product":
            response = handle_product(user_input)
        elif intent == "refund":
            response = handle_refund()
        else:
            response = fallback_llm(user_input)

        print("Bot:", response)

if __name__ == "__main__":
    chatbot()
