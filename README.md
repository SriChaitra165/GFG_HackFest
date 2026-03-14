Conversational AI for Instant Business Intelligence Dashboards

Background & Context
In today’s fast-paced environment, data is a company's most valuable asset. However, accessing insights often requires technical skills like SQL or navigating complex Business Intelligence (BI) tools. This creates a bottleneck where data teams are overwhelmed with basic reporting requests, and business users are left waiting days for simple dashboards.

Business Problem Statement
Build an intelligent system that allows non-technical users to generate fully functional, interactive data dashboards using only natural language prompts.

The solution must take a plain-English request (e.g., "Show me the monthly sales revenue for Q3 broken down by region and highlight the top-performing product category"), query the underlying data, select the most appropriate chart types, and render a cohesive, interactive dashboard in real-time.

Target Persona
The Non-Technical Executive (CXO): They know what business questions they want to ask but do not know how to write database queries or configure BI visualization settings.

Expected Deliverables
A working prototype (Web App) that turns a natural query to an assortment of charts and insights presented in a dashboard.
A link to the public GitHub repository.
A 10-minute presentation showcasing the tool answering at least three distinct, progressively complex text queries.
Recommended Tech Stack
Frontend: React, Next.js, Vue, or rapid-prototyping frameworks like Streamlit or Gradio.
Charting and Visualization Libraries: Recharts, Chart.js, D3.js, or Plotly.
Backend and API: Python (FastAPI, Flask) or Node.js (Express).
LLM Integration: Google Gemini API (via Google AI Studio).
Database or  Storage: CSV files, SQLite, or PostgreSQL.

Evaluation Framework
Accuracy (40)
Data Retrieval: Did the LLM generate the correct SQL/query to fetch the right data based on the prompt?
Contextual Chart Selection: Did the system choose the correct visual representation? (e.g., a line chart for time-series data, a pie chart for parts-of-a-whole).
Error Handling: How gracefully does the application handle vague, ambiguous, or highly complex user prompts?
Aesthetics & UX (30)
Design: Is the dashboard visually appealing, clean, and modern?
Interactivity: Can the user interact with the generated charts (e.g., hover for tooltips, zoom, filter)?
User Flow: Is the text-input interface intuitive? Is there a loading state or progress indicator while the dashboard is generating?
Approach & Innovation (30)
Architecture: How robust is the pipeline from text -> LLM -> Database -> Frontend?
Prompt Engineering: Did the team use clever system prompts, RAG (Retrieval-Augmented Generation), or agentic workflows to ensure high-quality outputs?
Hallucination Handling: Does the system accurately report when it cannot answer a query based on the available data, rather than making up numbers?

Bonus Points
Follow-up Questions (10): Allow the user to "chat with the dashboard" to filter or alter the generated charts (e.g., "Now filter this to only show the East Coast").
Data Format Agnostic (20): The ability for users to upload their own CSV file and immediately start prompting it, rather than relying on a hardcoded database.
