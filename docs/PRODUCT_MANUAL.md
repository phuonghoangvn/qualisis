# QualiSIS: Product Documentation & User Manual

## 1. Executive Summary
**QualiSIS** (Qualitative System for Intelligent Synthesis) is a next-generation, AI-augmented workspace designed for qualitative researchers. It streamlines the labor-intensive process of Reflexive Thematic Analysis (RTA). Rather than replacing the researcher, QualiSIS acts as an intelligent "Co-Pilot"—handling rote coding, suggesting thematic structures, and retrieving data context via RAG, while keeping the researcher fully in control of the intellectual synthesis.

## 2. Core Value Proposition
- **Hybrid Coding (Human + AI):** Researchers can manually highlight and code text, while the AI can auto-suggest codes based on either a "Blank Slate" (Explore Freely) or by mimicking the researcher's established style ("Copy My Style").
- **Visual Theme Builder:** A drag-and-drop canvas for grouping individual codes into sub-themes and macro "Mega-Themes", bridging the gap between raw data and theoretical concepts.
- **RAG-Powered "Chat with Data":** An intelligent chatbot that doesn't just guess, but retrieves exact, coded quotes from the researcher's dataset to answer analytical questions, synthesize findings, and find contradictions.
- **Automated Academic Reporting:** 1-click generation of narrative findings sections based on the final theme structures and coded quotes.

---

## 3. Key Workflows & Features

### 3.1. Project & Dataset Management
- **Hierarchy:** Projects contain Datasets. Datasets contain Transcripts (interviews, focus groups).
- **Import:** Supports `.txt` and `.docx` parsing via Mammoth.
- **Preprocessing:** Cleans transcript text, removes PII/filler words, and formats it for optimal readability and AI processing.

### 3.2. The Transcript Workspace (Coding)
This is the core interface where researchers interact with raw data.
- **Manual Coding:** Users can highlight any text segment and assign it a code (either an existing code from the Codebook or creating a new "In Vivo" code).
- **AI Analysis Modes:**
  - **Explore Freely:** AI scans the transcript with a fresh perspective, suggesting novel codes and concepts.
  - **Copy My Style:** AI first retrieves up to 30 existing human/accepted codes from the project, injecting them into its prompt to learn the researcher's exact coding style (level of abstraction, terminology).
- **Mass Review:** A quick-triage interface to accept, modify, or reject AI-suggested codes in bulk.
- **Custom AI Lens:** Researchers can input a custom prompt (e.g., "Analyze through a Cognitive Behavioral Therapy lens") to guide the AI's focus.

### 3.3. The Theme Builder (Synthesis)
Moves analysis from Phase 2 (Initial Codes) to Phase 3/4/5 (Searching, Reviewing, Naming Themes).
- **Code Inbox:** Displays all codes generated across all transcripts that haven't been themed yet.
- **Interactive Canvas:** Users drag codes into "Themes", and can nest Themes inside "Mega-Themes".
- **AI Theme Suggestions:** The system can analyze un-themed codes and suggest logical groupings based on semantic similarity.
- **Metrics:** Displays occurrences (how many times a code appears) and participant spread (how many unique transcripts feature this code).

### 3.4. The Dynamic Codebook
A centralized dictionary of all codes used in the project.
- **Definitions:** Researchers can refine definitions for consistency.
- **Merger:** If two codes mean the same thing (e.g., "Anxious" and "Nervous"), they can be merged. The system automatically updates all corresponding transcript segments.

### 3.5. Chat with Data (AI Copilot via Prompt Caching)
An advanced chat interface designed to query the dataset natively.
- **Architecture:** Full Context AI with Prompt Caching.
- **Layer 1 (Context):** The AI is fed the project's entire Codebook and Theme structures.
- **Layer 2 (Full Data Load):** The system passes the *complete, raw text* of all project transcripts directly into the AI's context window. This ensures the AI has exhaustive knowledge of everything participants said, even uncoded sections.
- **Layer 3 (Reasoning & Caching):** GPT-4o scans the full text to synthesize answers, forced to provide exact verbatim citations (e.g., *"Quote"* - [Transcript Name]). Because the prompt is static and massive, OpenAI's Prompt Caching automatically caches the data across the session, reducing follow-up latency and token costs by up to 80%.
- **Use Cases:** Synthesizing findings across transcripts, comparing participant profiles, finding contradictions, or reviewing theme validity without missing uncoded data.

### 3.6. Export & Reporting
- **Narrative Generation:** The AI drafts a highly academic, peer-review-style findings section. It weaves verbatim quotes seamlessly into the narrative (thick description) based on the final Mega-Themes.
- **CSV Export:** Exports the entire codebook, frequencies, and quotes for use in Excel, NVivo, or SPSS.

---

## 4. Technical Architecture

### 4.1. Tech Stack
- **Frontend:** Next.js 14 (App Router), React, Tailwind CSS, Framer Motion (animations), Lucide (icons).
- **Backend:** Next.js API Routes (Serverless).
- **Database:** PostgreSQL (Neon) managed via Prisma ORM.
- **AI Integration:** OpenAI API (`gpt-4o-mini` for heavy batch processing/coding; `gpt-4o` for deep RAG synthesis).
- **Authentication:** NextAuth.js (Credentials/Email).

### 4.2. Database Schema Highlights
- **Project:** Top-level container.
- **Transcript:** Holds raw text and AI-cleaned text.
- **Segment:** A specific string of text (identified by start/end index) within a transcript.
- **CodebookEntry:** A unique code label and definition.
- **CodeAssignment:** Links a Segment to a CodebookEntry (Human-confirmed).
- **Suggestion:** An AI-generated code attached to a segment, pending human review (Status: PENDING, APPROVED, REJECTED, MODIFIED).
- **Theme:** Hierarchical container (supports parent-child relationships for Mega-Themes). Contains `ThemeCodeLink`s.

---

## 5. AI Prompt Engineering Methodology
QualiSIS utilizes highly structured prompting based on **Braun & Clarke’s Reflexive Thematic Analysis (RTA)**. 
- **Analytical vs. Descriptive:** Prompts explicitly forbid the AI from merely summarizing text. It is instructed to look for "underlying assumptions," "theoretical constructs," and "emotional resonance."
- **In Vivo Priority:** The AI is instructed to use the participant's exact phrasing for code names wherever possible.
- **Few-Shot Learning:** In "Copy My Style" mode, the prompt dynamically injects prior database entries to constrain the AI's output format and abstraction level.

## 6. Future Roadmap / Extension Points
- **Multi-modal Input:** Extending support beyond text to Audio/Video parsing via Whisper API.
- **Collaboration:** Real-time multiplayer coding (similar to Figma) for research teams to calculate inter-rater reliability.
- **Vector Search:** Upgrading the RAG keyword retrieval to pure semantic Vector Embeddings (using `pgvector`) for even more accurate "Chat with Data" results.
