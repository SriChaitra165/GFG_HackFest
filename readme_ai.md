# 🧠 Person 2 — AI + Prompt Engineering Module

## Folder Structure

```
ai_engine/
├── ai_engine.py          ← Core pipeline: question → Gemini → SQL + chart
├── prompt_templates.py   ← All Gemini prompt strings (versioned, tunable)
├── chart_selector.py     ← Rule-based + Gemini chart type recommender
├── schema_utils.py       ← Schema formatting, type detection, validation
├── routes.py             ← FastAPI router (Person 1 mounts this)
├── requirements.txt
├── .env.example          ← Copy to .env and add GEMINI_API_KEY
└── README.md
```

---

## Setup

```bash
cd ai_engine
pip install -r requirements.txt
cp .env.example .env
# Add your GEMINI_API_KEY to .env
```

---

## Integration Guide

### 👩‍💻 For Person 1 (Backend)

Mount the AI router on your FastAPI app:

```python
# In Person 1's main.py
from ai_engine.routes import ai_router
app.include_router(ai_router, prefix="/ai")
```

The endpoint you'll call after CSV upload:

```
POST /ai/query
Content-Type: application/json

{
  "question": "Show me monthly sales by region",
  "schema": {
    "table_name": "data",
    "columns": [
      {"name": "date",   "type": "DATE", "sample_values": ["2024-01-01"]},
      {"name": "region", "type": "TEXT", "sample_values": ["North"]},
      {"name": "sales",  "type": "REAL", "sample_values": [1200.5]}
    ],
    "row_count": 5000
  }
}
```

You'll get back:
```json
{
  "sql": "SELECT strftime('%Y-%m', date) AS month, region, SUM(sales) AS total_sales FROM data GROUP BY month, region ORDER BY month",
  "chart_type": "line",
  "explanation": "Monthly sales aggregated by region over time.",
  "columns": ["month", "region", "total_sales"],
  "chart_config": {
    "x_axis": "month",
    "y_axis": "total_sales",
    "label_column": "month",
    "value_column": "total_sales"
  },
  "error": null,
  "is_answerable": true
}
```

Then execute `result.sql` against your SQLite DB and return the rows to Person 3.

---

### 🎨 For Person 3 (Frontend)

The full response shape you'll receive from Person 1's API:

```json
{
  "sql": "SELECT ...",
  "chart_type": "bar",       // Use this to pick Chart.js chart type
  "explanation": "...",      // Use as dashboard subtitle
  "columns": ["region", "total_sales"],
  "chart_config": {
    "x_axis": "region",      // Label axis
    "y_axis": "total_sales"  // Value axis
  },
  "data": [                  // Added by Person 1 after SQL execution
    {"region": "North", "total_sales": 45000},
    {"region": "South", "total_sales": 32000}
  ],
  "error": null,
  "is_answerable": true
}
```

Chart type mapping for Chart.js:
- `"bar"`     → `new Chart(ctx, { type: 'bar', ... })`
- `"line"`    → `new Chart(ctx, { type: 'line', ... })`
- `"pie"`     → `new Chart(ctx, { type: 'pie', ... })`
- `"scatter"` → `new Chart(ctx, { type: 'scatter', ... })`
- `"area"`    → `new Chart(ctx, { type: 'line', fill: true, ... })`
- `"table"`   → Render as HTML table

Follow-up question endpoint:
```
POST /ai/followup
{
  "followup_question": "Now filter to only East Coast",
  "original_sql": "SELECT ...",
  "schema": { ... }
}
```

---

## Architecture

```
User question (from Person 3)
        ↓
Person 1 API → POST /ai/query
        ↓
[ai_engine.py]
  ├── format_schema_for_prompt()   (schema_utils.py)
  ├── build_sql_prompt()           (prompt_templates.py)
  ├── Gemini API call → raw SQL
  ├── extract_sql()
  ├── build_chart_prompt()         (prompt_templates.py)
  ├── Gemini API call → chart type
  └── select_chart_type()          (chart_selector.py)
        ↓
  Returns: {sql, chart_type, explanation, columns, chart_config}
        ↓
Person 1 executes SQL → adds "data" field
        ↓
Person 3 renders Chart.js dashboard
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Vague question | `is_answerable: false`, `error` message, no SQL |
| Column hallucination | UNANSWERABLE flag in SQL → caught, returns error |
| Gemini API failure | Returns `error` with exception message |
| Invalid schema | 400 HTTP error with validation details |
| Empty dataset | Graceful error, no crash |

---

## Health Check

```
GET /ai/health
→ {"status": "ok", "gemini_configured": true, "person": 2}
```



















# AI-Powered Conversational Business Intelligence Dashboard

This project allows users to upload a dataset, ask questions in natural language, and automatically generate SQL queries and charts.

---

# Architecture

User → Upload CSV → Ask Question
↓
Frontend Dashboard
↓
Backend API
↓
AI Engine (Gemini / LLM) → Generates SQL
↓
Query Engine (SQLite / Pandas)
↓
Results returned to Frontend
↓
Chart.js renders visualization

---

# Project Structure

```
hackathon_project/
│
├── backend/
│   ├── main.py
│   ├── ai_engine.py
│   ├── data_engine.py
│
├── frontend/
│   ├── index.html
│   ├── app.js
│
├── dataset/
│
├── requirements.txt
└── README.md
```

---

# Team Responsibilities

## Person 1 – Data & Query Engine

* CSV upload handling
* Store dataset in SQLite / Pandas
* Execute SQL queries
* Return result JSON

## Person 2 – AI Engine

* Integrate Gemini API
* Convert natural language → SQL
* Suggest chart type

## Person 3 – Frontend

* Dashboard UI
* CSV upload interface
* Question input
* Chart visualization (Chart.js)

---

# Installation

Clone the project:

```
git clone <repository-url>
cd hackathon_project
```

Install dependencies:

```
pip install -r requirements.txt
```

Example `requirements.txt`:

```
fastapi
uvicorn
pandas
sqlite3
requests
python-multipart
```

---

# Running the Backend

Go to backend folder:

```
cd backend
```

Start the FastAPI server:

```
uvicorn main:app --reload
```

Server will start at:

```
http://127.0.0.1:8000
```

API documentation:

```
http://127.0.0.1:8000/docs
```

---

# Running the Frontend

Open the frontend folder:

```
cd frontend
```

If using simple HTML:

```
open index.html
```

Or use a local server:

```
python -m http.server 5500
```

Frontend will run at:

```
http://localhost:5500
```

---

# API Endpoints

## Upload CSV

POST `/upload_csv`

Uploads dataset and stores it in database.

---

## Generate SQL

POST `/generate_sql`

Input:

```
{
 "question": "Show total sales by region",
 "schema": ["region", "sales"]
}
```

Output:

```
{
 "sql": "SELECT region, SUM(sales) FROM data GROUP BY region",
 "chart": "bar"
}
```

---

## Run Query

POST `/run_query`

Input:

```
{
 "sql": "SELECT region, SUM(sales) FROM data GROUP BY region"
}
```

Output:

```
{
 "columns": ["region","total_sales"],
 "rows": [
   ["North",12000],
   ["South",8000]
 ]
}
```

---

# Example Workflow

1. Upload CSV dataset
2. Ask a question in natural language
3. AI converts question to SQL
4. SQL runs on dataset
5. Results returned to frontend
6. Chart.js renders visualization

---

# Technologies Used

Backend:

* Python
* FastAPI
* Pandas
* SQLite

AI:

* Gemini API

Frontend:

* HTML / React
* Chart.js

---

# Running the Full System

Step 1:

```
cd backend
uvicorn main:app --reload
```

Step 2:

Open frontend.

Step 3:

Upload dataset.

Step 4:

Ask questions and view charts.

---

# Example Questions

* Show total sales by region
* Which region has highest sales?
* Compare sales across regions
* Show average sales value
* Display sales distribution

---

# Hackathon Demo Flow

1. Upload dataset
2. Ask natural language question
3. AI generates SQL
4. Query runs
5. Chart appears instantly

---

# Future Improvements

* Multi-dataset support
* Better chart recommendation
* Natural language explanations
* Conversation memory
* Dashboard export
