# """
# =============================================================
# Person 2 — AI + Prompt Engineering
# File: ai_engine.py
# Role: Core AI orchestration — receives question + schema from
#       frontend, calls Gemini, returns {sql, chart_type, explanation}
#       to Person 1 (query executor) and Person 3 (frontend renderer).
# =============================================================
# """

# import os
# import re
# import json
# import logging
# from typing import Optional
# from dotenv import load_dotenv
# import google.generativeai as genai

# from prompt_templates import build_sql_prompt, build_chart_prompt
# from chart_selector import select_chart_type
# from schema_utils import format_schema_for_prompt
# # cp .env.example .env


# load_dotenv()

# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# # ── Gemini setup ─────────────────────────────────────────────────────────────
# GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
# if not GEMINI_API_KEY:
#     raise EnvironmentError("GEMINI_API_KEY not set in .env")

# genai.configure(api_key=GEMINI_API_KEY)
# model = genai.GenerativeModel("gemini-1.5-flash")


# # ── Public entry point (called by Person 1's FastAPI route) ──────────────────
# def process_question(
#     question: str,
#     schema: dict,                     # ← received from Person 1 after CSV load
#     conversation_history: list = None # ← optional: enables follow-up questions
# ) -> dict:
#     """
#     Main pipeline:
#       1. Build a prompt from the user question + dataset schema
#       2. Ask Gemini to generate SQL
#       3. Extract & validate the SQL string
#       4. Ask Gemini (or rule-based) to recommend a chart type
#       5. Return structured JSON → Person 1 executes SQL, Person 3 renders chart

#     Parameters
#     ----------
#     question : str
#         Plain-English question from the user (received via frontend → Person 1 API).
#     schema : dict
#         Column names + sample rows from the uploaded CSV.
#         Example: {"columns": ["date","region","sales"], "sample": [...], "table_name": "data"}
#     conversation_history : list, optional
#         Previous (question, sql) pairs for follow-up query support.

#     Returns
#     -------
#     dict  →  sent back to Person 1's API, then forwarded to Person 3
#         {
#           "sql":         "SELECT ...",
#           "chart_type":  "bar" | "line" | "pie" | "scatter" | "table",
#           "explanation": "Why this SQL answers the question",
#           "columns":     ["region", "total_sales"],   # hint for Person 3 axis labels
#           "error":       null | "<message>"
#         }
#     """
#     try:
#         formatted_schema = format_schema_for_prompt(schema)

#         # ── Step 1: Generate SQL ──────────────────────────────────────────────
#         sql_prompt = build_sql_prompt(
#             question=question,
#             schema=formatted_schema,
#             history=conversation_history or []
#         )
#         logger.info(f"[AI Engine] Sending SQL prompt to Gemini for: '{question}'")
#         sql_response = model.generate_content(sql_prompt)
#         raw_sql_text = sql_response.text

#         sql = extract_sql(raw_sql_text)
#         if not sql:
#             return _error_response("Could not generate a valid SQL query for this question.")

#         # ── Step 2: Choose chart type ─────────────────────────────────────────
#         chart_prompt = build_chart_prompt(question=question, sql=sql)
#         chart_response = model.generate_content(chart_prompt)
#         chart_type = select_chart_type(chart_response.text, question, sql)

#         # ── Step 3: Generate a human-readable explanation ────────────────────
#         explanation = extract_explanation(raw_sql_text)

#         # ── Step 4: Extract expected output columns for Person 3 axis hints ──
#         columns = extract_select_columns(sql)

#         result = {
#             "sql":         sql,
#             "chart_type":  chart_type,
#             "explanation": explanation,
#             "columns":     columns,
#             "error":       None
#         }
#         logger.info(f"[AI Engine] Result: chart={chart_type}, sql={sql[:80]}...")
#         return result

#     except Exception as exc:
#         logger.error(f"[AI Engine] Unexpected error: {exc}", exc_info=True)
#         return _error_response(f"AI engine error: {str(exc)}")


# # ── Helpers ───────────────────────────────────────────────────────────────────

# def extract_sql(text: str) -> Optional[str]:
#     """
#     Pull the SQL query out of Gemini's response.
#     Handles:
#       - Fenced blocks: ```sql ... ``` or ``` ... ```
#       - Raw SQL starting with SELECT / WITH / INSERT etc.
#     """
#     # Try fenced code block first
#     fenced = re.search(r"```(?:sql)?\s*([\s\S]+?)```", text, re.IGNORECASE)
#     if fenced:
#         return fenced.group(1).strip()

#     # Fallback: find first SQL keyword
#     sql_start = re.search(r"\b(SELECT|WITH|INSERT|UPDATE|DELETE)\b", text, re.IGNORECASE)
#     if sql_start:
#         return text[sql_start.start():].strip().rstrip(";") + ";"

#     return None


# def extract_explanation(text: str) -> str:
#     """
#     If Gemini included a natural-language explanation alongside the SQL,
#     extract it. Otherwise return a generic message.
#     """
#     lines = [l.strip() for l in text.split("\n") if l.strip()]
#     non_sql = [l for l in lines if not re.match(r"(SELECT|WITH|--|```)", l, re.IGNORECASE)]
#     explanation = " ".join(non_sql[:3])
#     return explanation or "Query generated successfully."


# def extract_select_columns(sql: str) -> list:
#     """
#     Lightweight parse of the SELECT clause to return column aliases.
#     Used by Person 3 to auto-label chart axes.
#     """
#     try:
#         match = re.search(r"SELECT\s+(.*?)\s+FROM", sql, re.IGNORECASE | re.DOTALL)
#         if not match:
#             return []
#         cols_raw = match.group(1)
#         cols = [c.strip().split()[-1].strip('"').strip("'") for c in cols_raw.split(",")]
#         return [c for c in cols if c and c.upper() != "AS"]
#     except Exception:
#         return []


# def _error_response(message: str) -> dict:
#     """Standard error shape returned to Person 1 / Person 3."""
#     return {
#         "sql":         None,
#         "chart_type":  "table",
#         "explanation": message,
#         "columns":     [],
#         "error":       message
#     }


"""
=============================================================
Person 2 — AI + Prompt Engineering
File: ai_engine.py
Role: Core AI orchestration — receives question + schema from
      frontend, calls Gemini, returns {sql, chart_type, explanation}
      to Person 1 (query executor) and Person 3 (frontend renderer).
=============================================================
"""
###################################################################CAlude gemini #############################################################################################################################################################################################################################################################################################################################################################################################################################################333#################################################################################################################
# import os
# import re
# import json
# import logging
# from typing import Optional
# from dotenv import load_dotenv
# from google import genai

# from prompt_templates import build_sql_prompt, build_chart_prompt
# from chart_selector import select_chart_type
# from schema_utils import format_schema_for_prompt

# load_dotenv()

# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# # ── Gemini setup ─────────────────────────────────────────────────────────────
# GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
# if not GEMINI_API_KEY:
#     raise EnvironmentError("GEMINI_API_KEY not set in .env")

# client = genai.Client(api_key=GEMINI_API_KEY)
# GEMINI_MODEL = "gemini-2.0-flash"


# # ── Public entry point (called by Person 1's FastAPI route) ──────────────────
# def process_question(
#     question: str,
#     schema: dict,                     # ← received from Person 1 after CSV load
#     conversation_history: list = None # ← optional: enables follow-up questions
# ) -> dict:
#     """
#     Main pipeline:
#       1. Build a prompt from the user question + dataset schema
#       2. Ask Gemini to generate SQL
#       3. Extract & validate the SQL string
#       4. Ask Gemini (or rule-based) to recommend a chart type
#       5. Return structured JSON → Person 1 executes SQL, Person 3 renders chart

#     Parameters
#     ----------
#     question : str
#         Plain-English question from the user (received via frontend → Person 1 API).
#     schema : dict
#         Column names + sample rows from the uploaded CSV.
#         Example: {"columns": ["date","region","sales"], "sample": [...], "table_name": "data"}
#     conversation_history : list, optional
#         Previous (question, sql) pairs for follow-up query support.

#     Returns
#     -------
#     dict  →  sent back to Person 1's API, then forwarded to Person 3
#         {
#           "sql":         "SELECT ...",
#           "chart_type":  "bar" | "line" | "pie" | "scatter" | "table",
#           "explanation": "Why this SQL answers the question",
#           "columns":     ["region", "total_sales"],   # hint for Person 3 axis labels
#           "error":       null | "<message>"
#         }
#     """
#     try:
#         formatted_schema = format_schema_for_prompt(schema)

#         # ── Step 1: Generate SQL ──────────────────────────────────────────────
#         sql_prompt = build_sql_prompt(
#             question=question,
#             schema=formatted_schema,
#             history=conversation_history or []
#         )
#         logger.info(f"[AI Engine] Sending SQL prompt to Gemini for: '{question}'")
#         sql_response = client.models.generate_content(model=GEMINI_MODEL, contents=sql_prompt)
#         raw_sql_text = sql_response.text

#         sql = extract_sql(raw_sql_text)
#         if not sql:
#             return _error_response("Could not generate a valid SQL query for this question.")

#         # ── Step 2: Choose chart type ─────────────────────────────────────────
#         chart_prompt = build_chart_prompt(question=question, sql=sql)
#         chart_response = client.models.generate_content(model=GEMINI_MODEL, contents=chart_prompt)
#         chart_type = select_chart_type(chart_response.text, question, sql)

#         # ── Step 3: Generate a human-readable explanation ────────────────────
#         explanation = extract_explanation(raw_sql_text)

#         # ── Step 4: Extract expected output columns for Person 3 axis hints ──
#         columns = extract_select_columns(sql)

#         result = {
#             "sql":         sql,
#             "chart_type":  chart_type,
#             "explanation": explanation,
#             "columns":     columns,
#             "error":       None
#         }
#         logger.info(f"[AI Engine] Result: chart={chart_type}, sql={sql[:80]}...")
#         return result

#     except Exception as exc:
#         logger.error(f"[AI Engine] Unexpected error: {exc}", exc_info=True)
#         return _error_response(f"AI engine error: {str(exc)}")


# # ── Helpers ───────────────────────────────────────────────────────────────────

# def extract_sql(text: str) -> Optional[str]:
#     """
#     Pull the SQL query out of Gemini's response.
#     Handles:
#       - Fenced blocks: ```sql ... ``` or ``` ... ```
#       - Raw SQL starting with SELECT / WITH / INSERT etc.
#     """
#     # Try fenced code block first
#     fenced = re.search(r"```(?:sql)?\s*([\s\S]+?)```", text, re.IGNORECASE)
#     if fenced:
#         return fenced.group(1).strip()

#     # Fallback: find first SQL keyword
#     sql_start = re.search(r"\b(SELECT|WITH|INSERT|UPDATE|DELETE)\b", text, re.IGNORECASE)
#     if sql_start:
#         return text[sql_start.start():].strip().rstrip(";") + ";"

#     return None


# def extract_explanation(text: str) -> str:
#     """
#     If Gemini included a natural-language explanation alongside the SQL,
#     extract it. Otherwise return a generic message.
#     """
#     lines = [l.strip() for l in text.split("\n") if l.strip()]
#     non_sql = [l for l in lines if not re.match(r"(SELECT|WITH|--|```)", l, re.IGNORECASE)]
#     explanation = " ".join(non_sql[:3])
#     return explanation or "Query generated successfully."


# def extract_select_columns(sql: str) -> list:
#     """
#     Lightweight parse of the SELECT clause to return column aliases.
#     Used by Person 3 to auto-label chart axes.
#     """
#     try:
#         match = re.search(r"SELECT\s+(.*?)\s+FROM", sql, re.IGNORECASE | re.DOTALL)
#         if not match:
#             return []
#         cols_raw = match.group(1)
#         cols = [c.strip().split()[-1].strip('"').strip("'") for c in cols_raw.split(",")]
#         return [c for c in cols if c and c.upper() != "AS"]
#     except Exception:
#         return []


# def _error_response(message: str) -> dict:
#     """Standard error shape returned to Person 1 / Person 3."""
#     return {
#         "sql":         None,
#         "chart_type":  "table",
#         "explanation": message,
#         "columns":     [],
#         "error":       message
#     }






###################################################Claude gemini router one #############################################33
# import os
# import re
# import logging
# import requests
# from typing import Optional
# from dotenv import load_dotenv

# from prompt_templates import build_sql_prompt, build_chart_prompt
# from chart_selector import select_chart_type
# from schema_utils import format_schema_for_prompt

# load_dotenv()

# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# # ── OpenRouter setup ──────────────────────────────────────────────────────────
# OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
# if not OPENROUTER_API_KEY:
#     raise EnvironmentError("OPENROUTER_API_KEY not set in .env")


# def call_ai(prompt: str) -> str:
#     response = requests.post(
#         "https://openrouter.ai/api/v1/chat/completions",
#         headers={
#             "Authorization": f"Bearer {OPENROUTER_API_KEY}",
#             "Content-Type": "application/json"
#         },
#         json={
#             "model": "google/gemini-2.0-flash-exp:free",
#             "messages": [{"role": "user", "content": prompt}]
#         }
#     )
#     return response.json()["choices"][0]["message"]["content"]


# def process_question(
#     question: str,
#     schema: dict,
#     conversation_history: list = None
# ) -> dict:
#     try:
#         formatted_schema = format_schema_for_prompt(schema)

#         sql_prompt = build_sql_prompt(
#             question=question,
#             schema=formatted_schema,
#             history=conversation_history or []
#         )
#         logger.info(f"[AI Engine] Sending prompt for: '{question}'")
#         raw_sql_text = call_ai(sql_prompt)

#         sql = extract_sql(raw_sql_text)
#         if not sql:
#             return _error_response("Could not generate a valid SQL query for this question.")

#         chart_prompt = build_chart_prompt(question=question, sql=sql)
#         chart_text = call_ai(chart_prompt)
#         chart_type = select_chart_type(chart_text, question, sql)

#         explanation = extract_explanation(raw_sql_text)
#         columns = extract_select_columns(sql)

#         return {
#             "sql":         sql,
#             "chart_type":  chart_type,
#             "explanation": explanation,
#             "columns":     columns,
#             "error":       None
#         }

#     except Exception as exc:
#         logger.error(f"[AI Engine] Error: {exc}", exc_info=True)
#         return _error_response(f"AI engine error: {str(exc)}")


# def extract_sql(text: str) -> Optional[str]:
#     fenced = re.search(r"```(?:sql)?\s*([\s\S]+?)```", text, re.IGNORECASE)
#     if fenced:
#         return fenced.group(1).strip()
#     sql_start = re.search(r"\b(SELECT|WITH|INSERT|UPDATE|DELETE)\b", text, re.IGNORECASE)
#     if sql_start:
#         return text[sql_start.start():].strip().rstrip(";") + ";"
#     return None


# def extract_explanation(text: str) -> str:
#     lines = [l.strip() for l in text.split("\n") if l.strip()]
#     non_sql = [l for l in lines if not re.match(r"(SELECT|WITH|--|```)", l, re.IGNORECASE)]
#     explanation = " ".join(non_sql[:3])
#     return explanation or "Query generated successfully."


# def extract_select_columns(sql: str) -> list:
#     try:
#         match = re.search(r"SELECT\s+(.*?)\s+FROM", sql, re.IGNORECASE | re.DOTALL)
#         if not match:
#             return []
#         cols_raw = match.group(1)
#         cols = [c.strip().split()[-1].strip('"').strip("'") for c in cols_raw.split(",")]
#         return [c for c in cols if c and c.upper() != "AS"]
#     except Exception:
#         return []


# def _error_response(message: str) -> dict:
#     return {
#         "sql":         None,
#         "chart_type":  "table",
#         "explanation": message,
#         "columns":     [],
#         "error":       message
#     }


####################################################################3333333

# import os
# import re
# import logging
# import requests
# from typing import Optional
# from dotenv import load_dotenv

# from prompt_templates import build_sql_prompt, build_chart_prompt
# from chart_selector import select_chart_type
# from schema_utils import format_schema_for_prompt

# load_dotenv()

# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# # ── OpenRouter setup ──────────────────────────────────────────────────────────
# OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
# if not OPENROUTER_API_KEY:
#     raise EnvironmentError("OPENROUTER_API_KEY not set in .env")


# # def call_ai(prompt: str) -> str:
# #     response = requests.post(
# #         "https://openrouter.ai/api/v1/chat/completions",
# #         headers={
# #             "Authorization": f"Bearer {OPENROUTER_API_KEY}",
# #             "Content-Type": "application/json"
# #         },
# #         json={
# #             "model": "google/gemini-2.0-flash-exp:free",
# #             "messages": [{"role": "user", "content": prompt}]
# #         }
# #     )
# #     return response.json()["choices"][0]["message"]["content"]


# def call_ai(prompt: str) -> str:
#     response = requests.post(
#         "https://openrouter.ai/api/v1/chat/completions",
#         headers={
#             "Authorization": f"Bearer {OPENROUTER_API_KEY}",
#             "Content-Type": "application/json"
#         },
#         json={
#             "model": "google/gemini-2.0-flash-exp:free",
#             "messages": [{"role": "user", "content": prompt}]
#         }
#     )
#     data = response.json()
#     logger.info(f"[OpenRouter Response]: {data}")
#     if "choices" in data:
#         return data["choices"][0]["message"]["content"]
#     elif "error" in data:
#         raise Exception(f"OpenRouter error: {data['error']}")
#     else:
#         raise Exception(f"Unexpected response: {data}")

# def process_question(
#     question: str,
#     schema: dict,
#     conversation_history: list = None
# ) -> dict:
#     try:
#         formatted_schema = format_schema_for_prompt(schema)

#         sql_prompt = build_sql_prompt(
#             question=question,
#             schema=formatted_schema,
#             history=conversation_history or []
#         )
#         logger.info(f"[AI Engine] Sending prompt for: '{question}'")
#         raw_sql_text = call_ai(sql_prompt)

#         sql = extract_sql(raw_sql_text)
#         if not sql:
#             return _error_response("Could not generate a valid SQL query for this question.")

#         chart_prompt = build_chart_prompt(question=question, sql=sql)
#         chart_text = call_ai(chart_prompt)
#         chart_type = select_chart_type(chart_text, question, sql)

#         explanation = extract_explanation(raw_sql_text)
#         columns = extract_select_columns(sql)

#         return {
#             "sql":         sql,
#             "chart_type":  chart_type,
#             "explanation": explanation,
#             "columns":     columns,
#             "error":       None
#         }

#     except Exception as exc:
#         logger.error(f"[AI Engine] Error: {exc}", exc_info=True)
#         return _error_response(f"AI engine error: {str(exc)}")


# def extract_sql(text: str) -> Optional[str]:
#     fenced = re.search(r"```(?:sql)?\s*([\s\S]+?)```", text, re.IGNORECASE)
#     if fenced:
#         return fenced.group(1).strip()
#     sql_start = re.search(r"\b(SELECT|WITH|INSERT|UPDATE|DELETE)\b", text, re.IGNORECASE)
#     if sql_start:
#         return text[sql_start.start():].strip().rstrip(";") + ";"
#     return None


# def extract_explanation(text: str) -> str:
#     lines = [l.strip() for l in text.split("\n") if l.strip()]
#     non_sql = [l for l in lines if not re.match(r"(SELECT|WITH|--|```)", l, re.IGNORECASE)]
#     explanation = " ".join(non_sql[:3])
#     return explanation or "Query generated successfully."


# def extract_select_columns(sql: str) -> list:
#     try:
#         match = re.search(r"SELECT\s+(.*?)\s+FROM", sql, re.IGNORECASE | re.DOTALL)
#         if not match:
#             return []
#         cols_raw = match.group(1)
#         cols = [c.strip().split()[-1].strip('"').strip("'") for c in cols_raw.split(",")]
#         return [c for c in cols if c and c.upper() != "AS"]
#     except Exception:
#         return []


# def _error_response(message: str) -> dict:
#     return {
#         "sql":         None,
#         "chart_type":  "table",
#         "explanation": message,
#         "columns":     [],
#         "error":       message
#     }


import os
import re
import logging
import requests
from typing import Optional
from dotenv import load_dotenv

from prompt_templates import build_sql_prompt, build_chart_prompt
from chart_selector import select_chart_type
from schema_utils import format_schema_for_prompt

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
if not OPENROUTER_API_KEY:
    raise EnvironmentError("OPENROUTER_API_KEY not set in .env")


def call_ai(prompt: str) -> str:
    response = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            # "model": "google/gemini-2.0-flash-exp:free",
            # "model": "meta-llama/llama-3.1-8b-instruct:free",
            # "model": "mistralai/mistral-7b-instruct:free",
            # "model": "deepseek/deepseek-r1:free",
            # "model": "qwen/qwen-2-7b-instruct:free",
            # "model": "meta-llama/llama-3.3-70b-instruct:free",
            # "model": "nvidia/nemotron-3-8b-chat-sft:free",
            # "model": "qwen/qwen3-235b-a22b:free",
            # "model": "microsoft/mai-ds-r1:free",
            # "model": "arcee-ai/arcee-blitz",
            "model": "meta-llama/llama-3.1-8b-instruct",
            "messages": [{"role": "user", "content": prompt}]
        }
    )
    data = response.json()
    logger.info(f"[OpenRouter Response]: {data}")
    if "choices" in data:
        return data["choices"][0]["message"]["content"]
    elif "error" in data:
        raise Exception(f"OpenRouter error: {data['error']}")
    else:
        raise Exception(f"Unexpected response: {data}")


def process_question(
    question: str,
    schema: dict,
    conversation_history: list = None
) -> dict:
    try:
        formatted_schema = format_schema_for_prompt(schema)

        sql_prompt = build_sql_prompt(
            question=question,
            schema=formatted_schema,
            history=conversation_history or []
        )
        logger.info(f"[AI Engine] Sending prompt for: '{question}'")
        raw_sql_text = call_ai(sql_prompt)

        sql = extract_sql(raw_sql_text)
        if not sql:
            return _error_response("Could not generate a valid SQL query.")

        chart_prompt = build_chart_prompt(question=question, sql=sql)
        chart_text = call_ai(chart_prompt)
        chart_type = select_chart_type(chart_text, question, sql)

        explanation = extract_explanation(raw_sql_text)
        ############33or this ##########33
        # explanation = generate_explanation(question, sql)
        #################
        columns = extract_select_columns(sql)

        return {
            "sql":         sql,
            "chart_type":  chart_type,
            "explanation": explanation,
            "columns":     columns,
            "error":       None
        }

    except Exception as exc:
        logger.error(f"[AI Engine] Error: {exc}", exc_info=True)
        return _error_response(f"AI engine error: {str(exc)}")


def extract_sql(text: str) -> Optional[str]:
    fenced = re.search(r"```(?:sql)?\s*([\s\S]+?)```", text, re.IGNORECASE)
    if fenced:
        return fenced.group(1).strip()
    sql_start = re.search(r"\b(SELECT|WITH|INSERT|UPDATE|DELETE)\b", text, re.IGNORECASE)
    if sql_start:
        return text[sql_start.start():].strip().rstrip(";") + ";"
    return None


def extract_explanation(text: str) -> str:
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    non_sql = [l for l in lines if not re.match(r"(SELECT|WITH|--|```)", l, re.IGNORECASE)]
    explanation = " ".join(non_sql[:3])
    return explanation or "Query generated successfully."


def extract_select_columns(sql: str) -> list:
    try:
        match = re.search(r"SELECT\s+(.*?)\s+FROM", sql, re.IGNORECASE | re.DOTALL)
        if not match:
            return []
        cols_raw = match.group(1)
        cols = [c.strip().split()[-1].strip('"').strip("'") for c in cols_raw.split(",")]
        return [c for c in cols if c and c.upper() != "AS"]
    except Exception:
        return []


def _error_response(message: str) -> dict:
    return {
        "sql":         None,
        "chart_type":  "table",
        "explanation": message,
        "columns":     [],
        "error":       message
    }