"""
=============================================================
Person 2 — AI + Prompt Engineering
File: prompt_templates.py
Role: All Gemini prompt construction lives here.
      Keep prompts versioned and easy to iterate on.
=============================================================
"""

# ── SQL Generation Prompt ─────────────────────────────────────────────────────

def build_sql_prompt(question: str, schema: str, history: list = []) -> str:
    """
    Build the system + user prompt that instructs Gemini to produce
    a single, executable SQL query.

    Parameters
    ----------
    question : str   — plain-English user question
    schema   : str   — formatted schema string (from schema_utils.py)
    history  : list  — list of {"question": ..., "sql": ...} for follow-up support

    The prompt is carefully engineered to:
      1. Force SQL-only output (no hallucinated column names)
      2. Use only the columns present in the schema
      3. Support aggregation, filtering, grouping, and time-series patterns
      4. Handle ambiguous questions gracefully with a comment instead of crashing
    """

    history_block = ""
    if history:
        history_block = "\n\n--- CONVERSATION HISTORY (for follow-up context) ---\n"
        for turn in history[-5:]:   # keep last 5 turns to stay within context window
            history_block += f"User asked: {turn['question']}\n"
            history_block += f"SQL used:   {turn['sql']}\n\n"
        history_block += "--- END OF HISTORY ---"

    prompt = f"""You are an expert SQL data analyst assistant embedded in a Business Intelligence tool.
Your ONLY job is to convert the user's natural language question into a valid SQL query.

STRICT RULES:
1. Use ONLY the columns listed in the schema below. Do NOT invent column names.
2. The table name is always: data
3. Return ONLY the SQL query inside a ```sql ... ``` code block.
4. After the code block, add ONE sentence explaining what the query does (for the dashboard subtitle).
5. If the question is too vague or impossible to answer from the given columns, return:
   ```sql
   -- UNANSWERABLE: <brief reason>
   ```
6. For date/time columns, use SQLite-compatible syntax (strftime, date()).
7. Always use column aliases (AS) so the output columns have clean, readable names.
8. Limit results to 500 rows maximum unless the user asks for all data.
9. For aggregations, always include a GROUP BY clause.
10. For rankings or "top N" queries, use ORDER BY + LIMIT.

DATASET SCHEMA:
{schema}
{history_block}

USER QUESTION:
{question}

SQL Query:"""

    return prompt


# ── Chart Type Suggestion Prompt ──────────────────────────────────────────────

def build_chart_prompt(question: str, sql: str) -> str:
    """
    Ask Gemini to recommend the best chart type given the question and SQL.

    Returns one of: bar, line, pie, scatter, area, table
    """
    prompt = f"""You are a data visualization expert.
Given the user's question and the SQL query that was generated, recommend the SINGLE best chart type.

AVAILABLE CHART TYPES:
- bar      → comparing categories, rankings, counts
- line     → trends over time, continuous data
- pie      → parts of a whole (use only if ≤ 8 categories)
- scatter  → correlation between two numeric variables
- area     → cumulative trends over time
- table    → raw data, many columns, non-visual data

Rules:
- If the SQL has a date/time column in GROUP BY → prefer line or area
- If the SQL has SUM/COUNT with a category column → prefer bar
- If the SQL selects exactly 2 numeric columns → consider scatter
- If the SQL has only 1 numeric + 1 label column with few rows → consider pie
- When in doubt → bar

Respond with ONLY one word from the list above. No punctuation, no explanation.

Question: {question}
SQL: {sql}

Chart type:"""

    return prompt


# ── Follow-up / Refinement Prompt ─────────────────────────────────────────────

def build_followup_prompt(original_sql: str, followup_question: str, schema: str) -> str:
    """
    When the user asks a follow-up like "Now filter to only Q3" or
    "Break this down by region", modify the existing SQL rather than
    starting from scratch.
    """
    prompt = f"""You are an expert SQL data analyst.
The user already has a dashboard with the following SQL query:

```sql
{original_sql}
```

The user now wants to MODIFY or FILTER the existing query based on their new request.
Do NOT generate a completely new query. Instead, adjust the existing SQL.

SCHEMA:
{schema}

FOLLOW-UP REQUEST:
{followup_question}

Return ONLY the modified SQL inside a ```sql ... ``` block, then one sentence explanation."""

    return prompt


# ── Hallucination Guard Prompt ─────────────────────────────────────────────────

def build_validation_prompt(sql: str, schema: str) -> str:
    """
    Secondary Gemini call to verify the generated SQL only references
    valid columns. Used as a guard against hallucinations.
    """
    prompt = f"""You are a strict SQL validator.

Check if ALL column names in the SQL query below exist in the provided schema.

SCHEMA:
{schema}

SQL:
{sql}

Respond with ONLY:
- "VALID" if all columns exist
- "INVALID: <comma-separated list of bad columns>" if any column is wrong"""

    return prompt