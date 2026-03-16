"""
=============================================================
Person 2 — AI + Prompt Engineering
File: chart_selector.py
Role: Determine the best chart type for the query result.
      Combines Gemini's suggestion with rule-based heuristics
      to ensure reliable, context-appropriate chart selection.
=============================================================
"""

import re
import logging

logger = logging.getLogger(__name__)

# Supported chart types (must match what Person 3 / Chart.js expects)
VALID_CHARTS = {"bar", "line", "pie", "scatter", "area", "table"}

# Default fallback
DEFAULT_CHART = "bar"


def select_chart_type(gemini_suggestion: str, question: str, sql: str) -> str:
    """
    Combine Gemini's suggestion + rule-based heuristics to pick the
    best chart type. Rule-based logic takes precedence for high-confidence
    patterns; Gemini suggestion is used for ambiguous cases.

    Parameters
    ----------
    gemini_suggestion : str   — raw text from Gemini chart prompt
    question          : str   — original user question
    sql               : str   — generated SQL query

    Returns
    -------
    str — one of: bar, line, pie, scatter, area, table
    """

    # ── 1. Parse Gemini's suggestion ─────────────────────────────────────────
    gemini_chart = _parse_gemini_chart(gemini_suggestion)

    # ── 2. Apply rule-based overrides ────────────────────────────────────────
    rule_chart = _rule_based_chart(question, sql)

    if rule_chart:
        logger.info(f"[Chart Selector] Rule-based override: '{rule_chart}' (Gemini said: '{gemini_chart}')")
        return rule_chart

    if gemini_chart:
        logger.info(f"[Chart Selector] Using Gemini suggestion: '{gemini_chart}'")
        return gemini_chart

    logger.info(f"[Chart Selector] Falling back to default: '{DEFAULT_CHART}'")
    return DEFAULT_CHART

#################
def smart_chart_override(chart_type, columns):

    if len(columns) == 2:
        return "bar"

    if len(columns) == 1:
        return "table"

    return chart_type

def _parse_gemini_chart(text: str) -> str:
    """Extract and validate chart type from Gemini's response."""
    if not text:
        return ""
    word = text.strip().lower().split()[0] if text.strip() else ""
    word = re.sub(r"[^a-z]", "", word)
    return word if word in VALID_CHARTS else ""


def _rule_based_chart(question: str, sql: str) -> str:
    """
    High-confidence heuristics based on question keywords and SQL structure.
    Returns empty string if no confident rule matches.
    """
    q = question.lower()
    s = sql.lower()

    # ── Time-series patterns → line or area ──────────────────────────────────
    time_keywords = ["over time", "trend", "monthly", "weekly", "daily", "yearly",
                     "by month", "by year", "by week", "by day", "per month",
                     "quarter", "q1", "q2", "q3", "q4", "time series"]
    has_time_sql = bool(re.search(r"strftime|date\(|year\(|month\(|datetime", s))

    if any(kw in q for kw in time_keywords) or has_time_sql:
        if "cumulative" in q or "running total" in q or "growth" in q:
            return "area"
        return "line"

    # ── Part-of-whole / distribution → pie ───────────────────────────────────
    pie_keywords = ["percentage", "proportion", "share", "breakdown", "distribution",
                    "portion", "how much of", "percent of total"]
    if any(kw in q for kw in pie_keywords):
        # Only use pie if we're grouping by one categorical column
        group_count = s.count("group by")
        if group_count == 1 and "join" not in s:
            return "pie"

    # ── Correlation / relationship → scatter ─────────────────────────────────
    scatter_keywords = ["correlation", "relationship between", "vs ", "versus",
                        "compare two", "scatter"]
    if any(kw in q for kw in scatter_keywords):
        return "scatter"

    # ── Raw data / many columns → table ──────────────────────────────────────
    table_keywords = ["list all", "show all", "show me all", "details", "full data",
                      "raw data", "every row", "all records"]
    if any(kw in q for kw in table_keywords):
        return "table"

    # ── Ranking / comparison → bar ────────────────────────────────────────────
    bar_keywords = ["top", "bottom", "best", "worst", "highest", "lowest",
                    "most", "least", "rank", "compare", "by region", "by category",
                    "by product", "per", "count", "total"]
    if any(kw in q for kw in bar_keywords):
        return "bar"

    return ""


def get_chart_config_hints(chart_type: str, columns: list) -> dict:
    """
    Return axis configuration hints for Person 3 (frontend/Chart.js).
    Helps Person 3 know which column goes on X vs Y axis.

    Parameters
    ----------
    chart_type : str   — selected chart type
    columns    : list  — column names from the SQL SELECT clause

    Returns
    -------
    dict → sent as part of the JSON response to Person 3
    {
      "x_axis": "column_name",
      "y_axis": "column_name",
      "label_column": "column_name",
      "value_column": "column_name"
    }
    """
    if not columns or len(columns) < 2:
        return {"x_axis": columns[0] if columns else "", "y_axis": ""}

    # Heuristic: first column is usually the label/category, rest are values
    label_col = columns[0]
    value_col = columns[1] if len(columns) > 1 else columns[0]

    config = {
        "x_axis":       label_col,
        "y_axis":       value_col,
        "label_column": label_col,
        "value_column": value_col
    }

    if chart_type == "scatter" and len(columns) >= 2:
        config["x_axis"] = columns[0]
        config["y_axis"] = columns[1]

    if chart_type == "pie":
        config["label_column"] = label_col
        config["value_column"] = value_col

    return config