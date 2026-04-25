export const buildSystematicPrompt = (
    researchContext: string,
    transcriptMetadata: any,
    globalSummary: string
) => {
    // 1. Role
    const role = `[ROLE]
You are a senior qualitative researcher with over ten years of experience in thematic analysis of interview transcripts. You follow a systematic, inductive approach: reading carefully line by line, staying close to the data, and labeling phenomena that are relevant. You are unbiased, open-minded, and creative in discovering patterns.`;

    // 2. Context
    const type = transcriptMetadata?.type || 'in-depth interview';
    const topic = transcriptMetadata?.topic || 'general research domain';
    const participants = transcriptMetadata?.participants ? JSON.stringify(transcriptMetadata.participants) : 'Interviewer and Participant';
    
    const context = `[CONTEXT]
You are analyzing a segment of an ${type} transcript.
Research Topic/Focus: ${topic}
Participants: ${participants}
Global Interview Summary (For Context):
${globalSummary || 'No overall summary provided.'}`;

    // 3. Task — Following thematic analysis methodology
    const task = `[TASK — THEMATIC CODING (Step 2 of Thematic Analysis)]
Read the transcript segment carefully, line by line. Your task is to LABEL relevant words, phrases, sentences, or sections spoken by the PARTICIPANT(S).

A piece of text is RELEVANT and should be coded if:
• It is REPEATED or echoed in several places (indicating importance to the participant)
• The participant EXPLICITLY states that something is important to them
• It relates to known concepts or theories in the research domain
• It reveals an ACTION, ACTIVITY, PROCESS, or STRATEGY the participant uses
• It expresses an OPINION, BELIEF, ATTITUDE, or VALUE
• It shows a DIFFERENCE, CONTRAST, CONTRADICTION, or TENSION
• It contains emotional language or describes a significant EXPERIENCE
• It is conceptually interesting for any other reason you can justify

WHAT TO CODE:
- Actions and activities ("I started doing breathing exercises")
- Concepts and ideas ("balance between work and life")
- Opinions and beliefs ("I think medication is a last resort")
- Processes and strategies ("I would just push through my days")
- Differences and comparisons ("before the study vs. after")
- Emotional expressions ("it was overwhelming", "I felt relief")
- Turning points and changes ("that's when things shifted for me")

HOW TO LABEL CODES — ANALYTICAL THINKING:
Think beyond paraphrasing. Ask yourself: "What recurring pattern or underlying phenomenon does this quote reveal about how people experience this topic?"
A good code label is a THEORETICAL CONSTRUCT — it names a pattern or mechanism, not just restates the words.
- Instead of describing WHAT was said → capture WHAT IT REVEALS or WHAT IT MEANS analytically.
- Example: Quote: "I lock myself in the bathroom to do breathing" → BAD label: "Breathing in private space" → GOOD label: "Somatic regulation through physical withdrawal"
- Example: Quote: "I feel less tense after the exercise" → BAD label: "Feeling less tense" → GOOD label: "Embodied relief as outcome of practice"

HANDLING MULTI-DIMENSIONAL QUOTES:
Some quotes contain multiple distinct dimensions (e.g., both physical AND mental effects, both emotional AND behavioral changes). You MUST handle these carefully:
- If a quote covers 2+ clearly different dimensions, SPLIT it into multiple shorter quotes and code each one separately.
  - Example: "I don't feel as tense physically, and mentally, it feels like I can think more clearly."
    → Split into TWO codes:
      1. text: "I don't feel as tense physically" → label: "Somatic tension relief through practice"
      2. text: "mentally, it feels like I can think more clearly" → label: "Cognitive clarity as outcome of regulation"
- If the dimensions are inseparable and the quote only makes sense as a whole, use a label that explicitly captures BOTH dimensions.
  - Example: "It calms me both physically and mentally" → label: "Integrated somatic-cognitive relief"
NEVER reduce a multi-dimensional quote to just one of its dimensions. This loses data.

Keep labels concise (3-7 words) and analytically meaningful. Each code should capture ONE distinct phenomenon.`;

    // 4. Constraints
    const constraints = `[CONSTRAINTS]
1. VERBATIM ONLY: The "text" field must be EXACTLY as it appears in the transcript. No spelling corrections, no added punctuation.
2. PARTICIPANTS ONLY: Only code statements by participants/interviewees. NEVER code interviewer questions or prompts.
3. NO SPEAKER TAGS: Never include labels like "Interviewer:", "P1:", "Anna:" in the extracted text.
4. EXISTENCE CHECK: Every quote must exist verbatim in the transcript. Do not invent or paraphrase.
5. QUOTE LENGTH: Each quote should be 1-2 meaningful sentences (roughly 8-40 words). Extract the core statement, not entire paragraphs.
6. ONE PHENOMENON PER CODE: Each code captures one distinct idea. If a quote contains 2+ clearly different phenomena (e.g., physical AND mental effects), SPLIT it into multiple separate quote entries with separate codes.
7. ANALYTICAL LABELS: Code labels must be THEORETICAL CONSTRUCTS that name an underlying pattern or phenomenon — not paraphrases. Ask: "What does this tell us about how people experience this topic in general?" Labels should be concise (3-7 words) and interpretive.
8. AVOID PURELY DESCRIPTIVE LABELS: Do not create labels that merely restate or summarise the quote. Bad: "Feeling calmer after breathing." Good: "Somatic regulation through breath-work."
9. CAPTURE THE MECHANISM OR PATTERN: Prioritize labels that reveal WHY or HOW something happens — the underlying mechanism, tension, or strategy.
10. NEVER REDUCE MULTI-DIMENSIONAL QUOTES: If a participant mentions both physical and mental effects, or both emotional and behavioral changes, do NOT reduce the code to just one dimension. Either split the quote or use a label that covers both.
11. HARD QUOTA: DO NOT generate more than 8 to 12 highlighted codes for this segment. Prioritize ONLY the top 8-12 most profound segments.

CRITICAL: DO NOT CODE EVERYTHING! YOU MUST BE EXTREMELY HIGHLY SELECTIVE.
SKIP THESE (not analytically relevant, DO NOT CODE):
- Pure social niceties ("Thank you for having me", "I hope this helps others as much as its helped me", "Yes, that sounds fine")
- Simple yes/no confirmations or agreements with no substance
- Interviewer questions (code only participant responses)
- Filler phrases or conversational glue with no meaning ("So, um, yeah...")
- General chit-chat, scheduling, or wrap-up conversation.`;

    // 5. Output Format — Matches manual Codebook structure: Theme | Code | Sample Excerpt | Sentiment
    const outputFormat = `[OUTPUT FORMAT]
Return a raw valid JSON array. Each object must follow this exact structure:
[
  {
    "theme": "Broad theoretical theme name (e.g., 'Agency and self-regulation', 'Embodied experience of practice', 'Tension between control and overwhelm')",
    "label": "Analytical code label (3-7 words, naming a pattern or phenomenon, e.g., 'Somatic regulation through breath-work', 'Agency reclaimed through routine', 'Anxiety as embodied physical state')",
    "text": "Exact verbatim quote from the transcript (the Sample Excerpt)",
    "sentiment": "Positive" | "Negative" | "Neutral",
    "confidence": "HIGH" | "MEDIUM" | "LOW",
    "explanation": "Brief justification for why this quote is analytically relevant and what pattern/phenomenon it reveals"
  }
]

IMPORTANT RULES FOR THEMES:
- Themes are THEORETICAL CONSTRUCTS that describe recurring patterns across the data — they should tell something general and abstract about the data.
- Group your codes under broad, conceptual themes (e.g., "Agency and self-regulation", "Embodied anxiety management", "Perceived efficacy of practice").
- Reuse the SAME theme name for all codes that belong to the same category. Do NOT create a unique theme for every single code.
- Aim for 3-7 distinct themes per transcript.

IMPORTANT RULES FOR CODE LABELS:
- Each code label should be 3-7 words, analytical, and name an underlying phenomenon or pattern.
- Examples of GOOD code labels: "Agency reclaimed through structured routine", "Somatic relief as validation of practice", "Physical withdrawal as regulatory strategy".
- Examples of BAD code labels: "Feeling better", "Using breathing", "Anxiety reduced" (too descriptive, not analytical).

Return ONLY the JSON array. No markdown wrappers. Code SELECTIVELY — quality over quantity.`;

    return `${role}\n\n${context}\n\n${task}\n\n[USER INSTRUCTIONS & RESEARCH FOCUS]\n${researchContext}\n\n${constraints}\n\n${outputFormat}`;
};

/**
 * Build prompt for Step 3-4 of thematic analysis:
 * Grouping codes into categories/themes with sub-categories
 */
export const buildThemeGroupingPrompt = (
    codes: Array<{ label: string; text: string; explanation: string }>,
    researchContext: string,
) => {
    return `[ROLE]
You are a senior qualitative researcher performing Step 3-4 of thematic analysis: grouping initial codes into meaningful themes.

[THEORETICAL FRAMING]
Themes are NOT summaries of content — they are THEORETICAL CONSTRUCTS that describe recurring patterns in the data and tell us something general and meaningful about participants' experiences. A good theme:
- Names an underlying phenomenon or mechanism (not just a topic area)
- Captures what the data is TELLING US about human experience in this context
- Works at a level of abstraction above the individual codes
- Could be understood as answering: "What does this pattern reveal about how people experience X?"

[TASK — CREATING THEMES (Steps 3-4)]
You have completed initial coding (Step 2). Now you must:

1. Review ALL the codes below carefully.
2. Group related codes together into THEMES (theoretical constructs).
3. Create a hierarchy: each Theme has sub-categories (the original codes that belong to it).
4. Not every code needs to be used — some initial codes can be dropped if they are not meaningful enough.
5. You CAN create new combined codes by merging two or more similar codes.
6. Look for CONNECTIONS between themes — how do they relate to each other?

GUIDELINES:
- Be creative and analytical — think about what the patterns MEAN, not just what they describe
- Work at an ABSTRACT, THEORETICAL level above the individual codes
- A good theme name reads like a theoretical concept: e.g., "Embodied agency through regulation", "Tension between vulnerability and control", "Practice as meaning-making"
- Avoid descriptive theme names like "Coping strategies" or "Benefits of breathing" — these describe topics, not patterns
- Aim for 3-7 main themes for a typical interview
- Each theme should have 2-5 sub-categories

[INITIAL CODES TO GROUP]
${codes.map((c, i) => `${i + 1}. "${c.label}" — "${c.text.substring(0, 60)}..." — ${c.explanation}`).join('\n')}

[RESEARCH CONTEXT]
${researchContext}

[OUTPUT FORMAT]
Return a JSON array of theme suggestions:
[
  {
    "name": "Theme Name (theoretical construct — e.g., 'Embodied agency through regulation', 'Tension between overwhelm and control')",
    "description": "What recurring pattern or phenomenon this theme captures, and what it tells us about participants' experiences in general",
    "subCategories": ["Code Label 1", "Code Label 2", "Code Label 3"],
    "reason": "Why these codes belong together and what theoretical insight this theme provides",
    "confidenceScore": 75,
    "connections": "How this theme connects to or tensions with other themes in the data"
  }
]
Return ONLY the JSON array. No markdown wrappers.`;
};
