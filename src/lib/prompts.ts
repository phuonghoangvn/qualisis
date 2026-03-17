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

Stay close to the data. Be open-minded. Use the participant's own language when creating code labels where possible (in-vivo coding). Each code should capture ONE distinct phenomenon.`;

    // 4. Constraints
    const constraints = `[CONSTRAINTS]
1. VERBATIM ONLY: The "text" field must be EXACTLY as it appears in the transcript. No spelling corrections, no added punctuation.
2. PARTICIPANTS ONLY: Only code statements by participants/interviewees. NEVER code interviewer questions or prompts.
3. NO SPEAKER TAGS: Never include labels like "Interviewer:", "P1:", "Anna:" in the extracted text.
4. EXISTENCE CHECK: Every quote must exist verbatim in the transcript. Do not invent or paraphrase.
5. QUOTE LENGTH: Each quote should be 1-2 meaningful sentences (roughly 8-40 words). Extract the core statement, not entire paragraphs.
6. ONE PHENOMENON PER CODE: Each code captures one distinct idea.
7. DESCRIPTIVE BUT GENERALIZED LABELS: Code labels should capture the core concept (e.g., "Financial Stress", "Burnout", "Coping Mechanism") rather than highly specific variations ("Stressed about money today", "Feeling totally burnt out").
8. REUSE CODES: If you encounter the same concept multiple times across the text, use the EXACT SAME code label avoiding slight variations. DO NOT invent 5 different codes for the exact same underlying sentiment.
9. STANDARDIZED NAMING: Start code labels with a Capital Letter and use consistent phrasing (e.g., use Noun Phrases like "Emotional Exhaustion" over verbs "Exhausted emotionally").

CRITICAL: DO NOT CODE EVERYTHING! YOU MUST BE EXTREMELY HIGHLY SELECTIVE.
SKIP THESE (not analytically relevant, DO NOT CODE):
- Pure social niceties ("Thank you for having me", "I hope this helps others as much as its helped me", "Yes, that sounds fine")
- Simple yes/no confirmations or agreements with no substance
- Interviewer questions (code only participant responses)
- Filler phrases or conversational glue with no meaning ("So, um, yeah...")
- General chit-chat, scheduling, or wrap-up conversation.`;

    // 5. Output Format
    const outputFormat = `[OUTPUT FORMAT]
Return a raw valid JSON array. Each object must have these fields:
[
  {
    "text": "Exact verbatim quote from the transcript",
    "label": "Descriptive Code Label (3-7 words, close to data)",
    "explanation": "Why this is relevant: what phenomenon does it capture? What makes it analytically interesting?",
    "confidence": "HIGH" | "MEDIUM" | "LOW",
    "alternatives": ["Alternative Label 1", "Alternative Label 2"],
    "uncertainty": "Any ambiguity or reason for review, or null"
  }
]
Return ONLY the JSON array. Code EXTREMELY SPARINGLY. If a statement is not an undeniable, powerful insight, DO NOT code it. Quality over quantity.`;

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
You are a senior qualitative researcher performing Step 3-4 of thematic analysis: grouping initial codes into meaningful categories (themes).

[TASK — CREATING CATEGORIES/THEMES (Steps 3-4)]
You have completed initial coding (Step 2). Now you must:

1. Review ALL the codes below carefully.
2. Group related codes together into CATEGORIES (themes).
3. Create a hierarchy: each Category has sub-categories (the original codes that belong to it).
4. Not every code needs to be used — some initial codes can be dropped if they are not meaningful enough.
5. You CAN create new combined codes by merging two or more similar codes.
6. Categories do not have to be the same type — they can be about objects, processes, differences, emotions, strategies, etc.
7. Look for CONNECTIONS between categories — how do they relate to each other?

GUIDELINES:
- Be creative and open-minded
- Work at a more ABSTRACT, GENERAL level than the individual codes
- Categories should capture broader patterns or phenomena
- A good theme tells a "story" — it has a clear central concept
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
    "name": "Theme Name (abstract, conceptual)",
    "description": "What this theme captures — the central concept or pattern",
    "subCategories": ["Code Label 1", "Code Label 2", "Code Label 3"],
    "reason": "Why these codes belong together and why this theme is significant",
    "confidenceScore": 75,
    "connections": "How this theme connects to other themes in the data"
  }
]
Return ONLY the JSON array. No markdown wrappers.`;
};
