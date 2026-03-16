# """
# =============================================================
# Person 2 — AI + Prompt Engineering
# File: routes.py (FIXED)
# - Fixed: google.generativeai → google.genai
# - Fixed: schema field renamed to dataset_schema (BaseModel conflict)
# - Fixed: proper FastAPI app so uvicorn works correctly
# =============================================================
# """

# from fastapi import FastAPI, APIRouter, HTTPException
# from pydantic import BaseModel, Field
# from typing import Optional, List, Any
# from google import genai

# from ai_engine import process_question
# from prompt_templates import build_followup_prompt, build_chart_prompt
# from chart_selector import select_chart_type, get_chart_config_hints
# from schema_utils import validate_schema, format_schema_for_prompt

# import os
# import logging
# from dotenv import load_dotenv

# load_dotenv()
# logger = logging.getLogger(__name__)

# # GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
# # client = genai.Client(api_key=GEMINI_API_KEY)
# # GEMINI_MODEL = "gemini-2.0-flash"


# import requests as http_requests
# OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# def call_ai(prompt: str) -> str:
#     response = http_requests.post(
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
# # app = FastAPI(title="Person 2 — AI Engine", version="1.0")
# from fastapi.middleware.cors import CORSMiddleware

# app = FastAPI(title="Person 2 — AI Engine", version="1.0")

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )
# ai_router = APIRouter(tags=["AI Engine"])


# class SchemaColumn(BaseModel):
#     name: str
#     type: str = "TEXT"
#     sample_values: List[Any] = []

# class DatasetSchema(BaseModel):
#     table_name: str = "data"
#     columns: List[SchemaColumn]
#     row_count: int = 0

# class QueryRequest(BaseModel):
#     question: str = Field(..., description="Plain-English question from the user")
#     dataset_schema: DatasetSchema = Field(..., description="Dataset schema from Person 1")
#     conversation_history: Optional[List[dict]] = Field(default=[])

# class FollowUpRequest(BaseModel):
#     followup_question: str
#     original_sql: str
#     dataset_schema: DatasetSchema
#     conversation_history: Optional[List[dict]] = []

# class AIQueryResponse(BaseModel):
#     sql: Optional[str]
#     chart_type: str
#     explanation: str
#     columns: List[str]
#     chart_config: dict
#     error: Optional[str]
#     is_answerable: bool


# @ai_router.get("/health")
# async def health_check():
#     api_key_set = bool(os.getenv("GEMINI_API_KEY"))
#     return {
#         "status": "ok",
#         "gemini_configured": api_key_set,
#         "person": 2,
#         "module": "AI + Prompt Engineering"
#     }


# @ai_router.post("/query", response_model=AIQueryResponse)
# async def generate_query(request: QueryRequest):
#     schema_dict = request.dataset_schema.model_dump()

#     is_valid, err = validate_schema(schema_dict)
#     if not is_valid:
#         raise HTTPException(status_code=400, detail=f"Invalid schema: {err}")

#     result = process_question(
#         question=request.question,
#         schema=schema_dict,
#         conversation_history=request.conversation_history
#     )

#     is_answerable = True
#     if result.get("sql") and result["sql"].strip().startswith("-- UNANSWERABLE"):
#         is_answerable = False
#         result["sql"] = None
#         result["error"] = "This question cannot be answered with the available data."

#     chart_config = get_chart_config_hints(
#         chart_type=result["chart_type"],
#         columns=result["columns"]
#     )

#     return AIQueryResponse(
#         sql=result["sql"],
#         chart_type=result["chart_type"],
#         explanation=result["explanation"],
#         columns=result["columns"],
#         chart_config=chart_config,
#         error=result["error"],
#         is_answerable=is_answerable
#     )


# @ai_router.post("/followup", response_model=AIQueryResponse)
# async def followup_query(request: FollowUpRequest):
#     schema_dict = request.dataset_schema.model_dump()
#     formatted_schema = format_schema_for_prompt(schema_dict)

#     prompt = build_followup_prompt(
#         original_sql=request.original_sql,
#         followup_question=request.followup_question,
#         schema=formatted_schema
#     )

#     # response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)

#     from ai_engine import extract_sql, extract_explanation, extract_select_columns
#     # sql = extract_sql(response.text)
#     ####new one for response and sql ####
#     response_text = call_ai(prompt)
#     sql = extract_sql(response_text)
#     #######Till here ####
#     explanation = extract_explanation(response.text)
#     columns = extract_select_columns(sql) if sql else []

#     # chart_resp = client.models.generate_content(
#     #     model=GEMINI_MODEL,
#     #     contents=build_chart_prompt(request.followup_question, sql or "")
#     # )
#     # chart_type = select_chart_type(chart_resp.text, request.followup_question, sql or "")
#     #######new for up ######
#     chart_resp_text = call_ai(build_chart_prompt(request.followup_question, sql or ""))
#     chart_type = select_chart_type(chart_resp_text, request.followup_question, sql or "")
#     ##############
#     chart_config = get_chart_config_hints(chart_type, columns)

#     return AIQueryResponse(
#         sql=sql,
#         chart_type=chart_type,
#         explanation=explanation,
#         columns=columns,
#         chart_config=chart_config,
#         error=None if sql else "Could not modify query.",
#         is_answerable=bool(sql)
#     )


# @ai_router.post("/validate-schema")
# async def validate_schema_endpoint(dataset_schema: DatasetSchema):
#     schema_dict = dataset_schema.model_dump()
#     is_valid, error = validate_schema(schema_dict)
#     return {"valid": is_valid, "error": error or None}


# app.include_router(ai_router)

# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run("routes:app", host="0.0.0.0", port=8001, reload=True)



######################################## NEW ONE #######################################################


from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Any
import os
import logging
from dotenv import load_dotenv

from ai_engine import process_question, call_ai, extract_sql, extract_explanation, extract_select_columns
from prompt_templates import build_followup_prompt, build_chart_prompt
from chart_selector import select_chart_type, get_chart_config_hints
from schema_utils import validate_schema, format_schema_for_prompt

from chart_selector import smart_chart_override

load_dotenv()
logger = logging.getLogger(__name__)

app = FastAPI(title="Person 2 — AI Engine", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ai_router = APIRouter(tags=["AI Engine"])


class SchemaColumn(BaseModel):
    name: str
    type: str = "TEXT"
    sample_values: List[Any] = []

class DatasetSchema(BaseModel):
    table_name: str = "data"
    columns: List[SchemaColumn]
    row_count: int = 0

class QueryRequest(BaseModel):
    question: str = Field(..., description="Plain-English question from the user")
    dataset_schema: DatasetSchema = Field(..., description="Dataset schema from Person 1")
    conversation_history: Optional[List[dict]] = Field(default=[])

class FollowUpRequest(BaseModel):
    followup_question: str
    original_sql: str
    dataset_schema: DatasetSchema
    conversation_history: Optional[List[dict]] = []

class AIQueryResponse(BaseModel):
    sql: Optional[str]
    chart_type: str
    explanation: str
    columns: List[str]
    chart_config: dict
    error: Optional[str]
    is_answerable: bool


@ai_router.get("/health")
async def health_check():
    api_key_set = bool(os.getenv("OPENROUTER_API_KEY"))
    return {
        "status": "ok",
        "openrouter_configured": api_key_set,
        "person": 2,
        "module": "AI + Prompt Engineering"
    }


########### AAAADDEDDD ###########

def is_safe_sql(sql):
    blocked = ["DELETE", "DROP", "UPDATE", "INSERT", "ALTER"]

    for word in blocked:
        if word in sql.upper():
            return False

    return True

######Upto this ##########

@ai_router.post("/query", response_model=AIQueryResponse)
async def generate_query(request: QueryRequest):
    schema_dict = request.dataset_schema.model_dump()
    is_valid, err = validate_schema(schema_dict)
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"Invalid schema: {err}")

    result = process_question(
        question=request.question,
        schema=schema_dict,
        conversation_history=request.conversation_history
    )

    is_answerable = True
    if result.get("sql") and result["sql"].strip().startswith("-- UNANSWERABLE"):
        is_answerable = False
        result["sql"] = None
        result["error"] = "This question cannot be answered with the available data."

    chart_config = get_chart_config_hints(
        chart_type=result["chart_type"],
        columns=result["columns"]
    )

    return AIQueryResponse(
        sql=result["sql"],
        chart_type=result["chart_type"],
        explanation=result["explanation"],
        columns=result["columns"],
        chart_config=chart_config,
        error=result["error"],
        is_answerable=is_answerable
    )


@ai_router.post("/followup", response_model=AIQueryResponse)
async def followup_query(request: FollowUpRequest):
    schema_dict = request.dataset_schema.model_dump()
    formatted_schema = format_schema_for_prompt(schema_dict)

    prompt = build_followup_prompt(
        original_sql=request.original_sql,
        followup_question=request.followup_question,
        schema=formatted_schema
    )

    response_text = call_ai(prompt)
    sql = extract_sql(response_text)
    ##################  ✅ Now your system blocks dangerous SQL.  ####################
    if not is_safe_sql(sql):
        return {
            "sql": None,
            "chart_type": "table",
            "explanation": "Unsafe SQL detected.",
            "columns": [],
            "chart_config": {},
            "error": "Unsafe SQL query generated",
            "is_answerable": False
        }

    ######################33 upto this #############
    explanation = extract_explanation(response_text)
    columns = extract_select_columns(sql) if sql else []

    chart_resp_text = call_ai(build_chart_prompt(request.followup_question, sql or ""))
    chart_type = select_chart_type(chart_resp_text, request.followup_question, sql or "")

    #########33added tis 
    chart_type = select_chart_type(chart_text, question, sql)
    chart_type = smart_chart_override(chart_type, columns)
    ###########3
    chart_config = get_chart_config_hints(chart_type, columns)

    return AIQueryResponse(
        sql=sql,
        chart_type=chart_type,
        explanation=explanation,
        columns=columns,
        chart_config=chart_config,
        error=None if sql else "Could not modify query.",
        is_answerable=bool(sql)
    )


@ai_router.post("/validate-schema")
async def validate_schema_endpoint(dataset_schema: DatasetSchema):
    schema_dict = dataset_schema.model_dump()
    is_valid, error = validate_schema(schema_dict)
    return {"valid": is_valid, "error": error or None}


app.include_router(ai_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("routes:app", host="0.0.0.0", port=8001, reload=True)