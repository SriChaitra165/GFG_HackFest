import requests
import os
from dotenv import load_dotenv

load_dotenv()

url = "https://openrouter.ai/api/v1/chat/completions"

headers = {
    "Authorization": f"Bearer {os.getenv('OPENROUTER_API_KEY')}",
    "Content-Type": "application/json"
}

data = {
    "model": "meta-llama/llama-3.1-8b-instruct",
    "messages": [
        {"role": "user", "content": "Say hello"}
    ]
}

response = requests.post(url, headers=headers, json=data)

print("STATUS:", response.status_code)
print("RESPONSE:", response.text)