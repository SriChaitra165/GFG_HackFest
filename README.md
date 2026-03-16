Perfect 👍 Since **you are Person 2 (AI + Prompt Engineering)**, your job is the **AI brain of the system**. I’ll give you the **clear workflow, folders, files, and how you connect with Person-1 and Person-3** so the integration works smoothly.

Your role mainly interacts with **Google Gemini** and the backend written using **FastAPI**.

---

# 1️⃣ Your Position in the System

The full architecture is:

```
User
 ↓
Frontend (Person 3)
 ↓
Backend API
 ↓
AI Engine (YOU)
 ↓
SQL Query
 ↓
Query Engine (Person 1)
 ↓
Database
 ↓
Results
 ↓
Charts (Frontend)
```

So **your output becomes the input for Person-1**.

---

# 2️⃣ Your Folder Responsibilities

Inside the backend folder create an **AI module**.

```
backend
│
├── main.py
│
├── ai_engine
│   ├── gemini_client.py
│   ├── prompt_builder.py
│   ├── sql_parser.py
│   └── chart_selector.py
│
└── services
    └── query_service.py
```

Your work is mainly inside:

```
ai_engine/
```

---

# 3️⃣ Files You Need to Build

## 1️⃣ `gemini_client.py`

This connects to **Gemini API**.

Example structure:

```
connect to Gemini
send prompt
receive response
return result
```

Flow:

```
question
 ↓
send to Gemini
 ↓
get SQL
```

---

## 2️⃣ `prompt_builder.py`

This file creates the **prompt template**.

Example prompt structure:

```
You are a data analyst.

Dataset columns:
{columns}

User question:
{question}

Return JSON:
{
 "sql": "...",
 "chart": "..."
}
```

This improves **Accuracy score** in evaluation.

---

## 3️⃣ `sql_parser.py`

Gemini sometimes returns extra text.

This file extracts only the SQL.

Example:

Gemini output:

```
Here is the SQL query:

SELECT region, SUM(sales)
FROM dataset
GROUP BY region;
```

Parser extracts:

```
SELECT region, SUM(sales)
FROM dataset
GROUP BY region
```

---

## 4️⃣ `chart_selector.py`

This decides chart type.

Example rules:

| Data type           | Chart |
| ------------------- | ----- |
| time series         | line  |
| category comparison | bar   |
| percentage          | pie   |

Example return:

```
{
 "sql": "...",
 "chart": "bar"
}
```

---

# 4️⃣ Your API Endpoint

Person-1 will call your function.

Example endpoint in `main.py`:

```
POST /generate-query
```

Input:

```
{
 "question": "Show revenue by region",
 "columns": ["date","region","product","revenue"]
}
```

Your response:

```
{
 "sql": "SELECT region, SUM(revenue) FROM dataset GROUP BY region",
 "chart": "bar"
}
```

---

# 5️⃣ Integration With Person-1

Person-1 will:

```
upload CSV
↓
extract columns
↓
call your AI function
↓
receive SQL
↓
run SQL on database
```

Example flow:

```
User question
↓
AI generates SQL
↓
Person-1 executes SQL
↓
returns results
```

---

# 6️⃣ Integration With Person-3

Person-3 receives:

```
data
chart type
```

Example response:

```
{
 "chart": "bar",
 "data": [
   {"region":"East","revenue":10000},
   {"region":"West","revenue":8000}
 ]
}
```

Frontend will render chart using **Chart.js**.

---

# 7️⃣ Your Daily Workflow With Git

Since you are **Person-2**, create branch:

```
ai-engine
```

Workflow:

```
git pull origin main
git checkout -b ai-engine
```

Work inside:

```
backend/ai_engine
```

Then push:

```
git add .
git commit -m "Added Gemini SQL generator"
git push origin ai-engine
```

Create Pull Request.

---

# 8️⃣ What You Should Build First (Order)

Follow this order:

### Step 1

Gemini connection

### Step 2

Prompt template

### Step 3

SQL extraction

### Step 4

Chart selection logic

### Step 5

API endpoint

---

# 9️⃣ Testing Your Module

Example test input:

```
question:
Show monthly revenue
```

Expected output:

```
{
 "sql": "SELECT month, SUM(revenue) FROM dataset GROUP BY month",
 "chart": "line"
}
```

---

# 🔟 What Judges Will Evaluate In Your Work

Your role affects:

### Accuracy (40%)

✔ correct SQL generation
✔ proper chart suggestion

### Innovation (30%)

✔ good prompt engineering
✔ correct error handling

---

# 1️⃣1️⃣ Advanced Feature (Bonus Points)

You can add:

### follow-up question support

Example:

```
User:
Show revenue by region

User:
Now show only East
```

Your AI modifies SQL.

---

# 1️⃣2️⃣ Your Final Output Structure

Your system must return:

```
{
 "sql": "...",
 "chart": "...",
 "explanation": "...",
}
```

Then backend returns data + chart.

---

✅ **Summary of Your Role**

You build:

```
text question
↓
Gemini
↓
SQL
↓
chart suggestion
```

You are basically the **AI translator between human language and SQL**.

---

💡 If you want, I can also give you **the exact Gemini prompt that gets ~95% correct SQL generation in these BI dashboard projects** (this is actually the trick used in many hackathons).
