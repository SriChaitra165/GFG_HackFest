"""
=============================================================
Person 2 — AI + Prompt Engineering
File: schema_utils.py
Role: Format the dataset schema (received from Person 1 after CSV upload)
      into a clean string that can be injected into Gemini prompts.
      Also validates incoming schema and detects column types.
=============================================================
"""

import re
import logging
from typing import Any

logger = logging.getLogger(__name__)


def format_schema_for_prompt(schema: dict) -> str:
    """
    Convert the raw schema dict (sent by Person 1's backend after CSV load)
    into a compact, human-readable string for Gemini.

    Expected schema format from Person 1:
    {
      "table_name": "data",
      "columns": [
        {"name": "date",    "type": "TEXT",    "sample_values": ["2024-01-01", "2024-01-02"]},
        {"name": "region",  "type": "TEXT",    "sample_values": ["North", "South"]},
        {"name": "sales",   "type": "REAL",    "sample_values": [1200.5, 890.0]},
        {"name": "product", "type": "TEXT",    "sample_values": ["Widget A", "Widget B"]}
      ],
      "row_count": 5000
    }

    Returns a formatted string like:
    Table: data (5000 rows)
    Columns:
      - date    [TEXT]    e.g. "2024-01-01", "2024-01-02"
      - region  [TEXT]    e.g. "North", "South"
      - sales   [REAL]    e.g. 1200.5, 890.0
      - product [TEXT]    e.g. "Widget A", "Widget B"
    """
    if not schema:
        return "Schema not available."

    table_name = schema.get("table_name", "data")
    row_count  = schema.get("row_count", "unknown")
    columns    = schema.get("columns", [])

    lines = [f"Table: {table_name} ({row_count} rows)", "Columns:"]

    for col in columns:
        name    = col.get("name", "?")
        dtype   = col.get("type", "TEXT")
        samples = col.get("sample_values", [])

        # Format sample values cleanly
        if samples:
            sample_str = ", ".join([f'"{v}"' if isinstance(v, str) else str(v)
                                    for v in samples[:3]])
            lines.append(f"  - {name:<20} [{dtype:<8}]  e.g. {sample_str}")
        else:
            lines.append(f"  - {name:<20} [{dtype:<8}]")

    return "\n".join(lines)


def detect_column_types(raw_columns: dict) -> list:
    """
    Infer SQLite-compatible column types from a dict of {col_name: sample_value}.
    Used if Person 1 sends raw column samples without explicit types.

    Parameters
    ----------
    raw_columns : dict  e.g. {"date": "2024-01-01", "sales": 1200.5, "region": "North"}

    Returns
    -------
    list of dicts: [{"name": ..., "type": ..., "sample_values": [...]}]
    """
    result = []
    for col_name, sample in raw_columns.items():
        dtype = _infer_type(col_name, sample)
        result.append({
            "name":          col_name,
            "type":          dtype,
            "sample_values": [sample]
        })
    return result


def _infer_type(col_name: str, value: Any) -> str:
    """Heuristic type detection from column name and sample value."""

    # Numeric
    if isinstance(value, (int, float)):
        return "INTEGER" if isinstance(value, int) else "REAL"

    if isinstance(value, str):
        # Date patterns
        if re.match(r"\d{4}-\d{2}-\d{2}", value):
            return "DATE"
        # Try parsing as number
        try:
            float(value.replace(",", ""))
            return "REAL"
        except ValueError:
            pass

    # Name-based hints
    name_lower = col_name.lower()
    if any(kw in name_lower for kw in ["date", "time", "year", "month", "day"]):
        return "DATE"
    if any(kw in name_lower for kw in ["id", "count", "qty", "quantity", "num"]):
        return "INTEGER"
    if any(kw in name_lower for kw in ["price", "revenue", "sales", "cost", "amount", "rate"]):
        return "REAL"

    return "TEXT"


def validate_schema(schema: dict) -> tuple[bool, str]:
    """
    Validate that the schema received from Person 1 is in the expected format.

    Returns (is_valid: bool, error_message: str)
    """
    if not isinstance(schema, dict):
        return False, "Schema must be a dictionary."

    if "columns" not in schema or not schema["columns"]:
        return False, "Schema must include a 'columns' list."

    for col in schema["columns"]:
        if "name" not in col:
            return False, f"Each column must have a 'name' field. Got: {col}"

    return True, ""


def extract_numeric_columns(schema: dict) -> list:
    """Return column names that are numeric (REAL or INTEGER). Useful for chart axis hints."""
    numeric_types = {"real", "integer", "int", "float", "number", "numeric"}
    return [
        col["name"]
        for col in schema.get("columns", [])
        if col.get("type", "").lower() in numeric_types
    ]


def extract_categorical_columns(schema: dict) -> list:
    """Return column names that are categorical (TEXT). Useful for GROUP BY hints."""
    return [
        col["name"]
        for col in schema.get("columns", [])
        if col.get("type", "TEXT").lower() in {"text", "varchar", "string", "char"}
    ]


def extract_date_columns(schema: dict) -> list:
    """Return column names that appear to be date/time fields."""
    date_types = {"date", "datetime", "timestamp"}
    return [
        col["name"]
        for col in schema.get("columns", [])
        if col.get("type", "").lower() in date_types
        or any(kw in col["name"].lower() for kw in ["date", "time", "year", "month"])
    ]