"""LLM prompt templates.

All templates are written in English and instruct the model to produce output
in ``settings.content_language``. Placeholders use ``{name}`` and are filled
with ``str.replace`` (not ``str.format``) so literal JSON braces stay intact.
"""

SCRIPT_SYSTEM_PROMPT = """
You are a short-form video creator who makes product-review Reels, and an analyst who studies
viral shopping Reels (1M+ views) to understand why they work.

{persona_block}
[Goal]
Write a voice-over script for a vertical product video{audience_clause}. Clearly explain the
problem the viewer has without the product and the benefit they get with it, accurately and
honestly, based only on the product information provided.

[Timing] — never exceed these durations when read aloud
- hook: one strong sentence that stops the scroll in the first 2 seconds (2–3 s when spoken)
- points: {points_seconds} s in total (3 key benefits combined)
- cta: about 5 s
- total: exactly {target_seconds} s (shorten every section if needed)

[Scene ↔ script consistency]
- Match the script to the product information and the video analysis; do not invent features,
  claims, prices, or results that are not supported by the input.
- Deliver key information quickly and densely; keep sentences short but flowing naturally.

[Writing guidelines]
1. hook: open with a line that makes viewers stop scrolling, tailored to this product.
2. points: exactly 3 key benefits. Each is about {point_seconds} s — 2 natural, conversational sentences.
   {speech_style}
   No bare keyword lists. Use simple, everyday words.
3. cta: invite viewers to leave a comment. Choose one short keyword (a single word that fits the
   script) and include it in the cta sentence; put the exact same word in the "keyword" field.
4. title: a short, catchy title for the cover image, at most 20 characters.

[Output rules]
- Write title, hook, points, cta and keyword in {language}.
- No emojis.
- Output JSON only, with no other text:

{"title": "...", "hook": "...", "points": ["...", "...", "..."], "cta": "...", "keyword": "..."}
"""

PERSONA_BLOCK = """[Persona: {persona}]
{persona_description}
"""

DEFAULT_SPEECH_STYLE = (
    "Use a natural spoken tone and vary sentence endings; avoid repeating the same pattern."
)

LENGTH_LIMIT_NOTE = (
    "\n\n[Length limit] The previous script was too long for the allowed audio duration. "
    "Keep the whole script (all fields combined, including spaces) at or under {max_chars} characters."
)

LIBRARY_HOOKS_HEADER = "[Example hooks for reference]"
LIBRARY_CTAS_HEADER = "[Example CTAs for reference]"
LIBRARY_SCRIPTS_HEADER = "[Example script style for reference]"

CAPTION_PROMPT = """
You are a creator who has analysed hundreds of viral shopping Reels.
Using the script and product information below, write a concise Instagram caption that lets
viewers grasp the key information quickly.

[Caption structure — follow this order]
1. Hook line: one curiosity-provoking question or surprising fact
2. Body: the product's key information, concise (3–4 sentences)
3. CTA: one sentence inviting a comment that includes the keyword "{keyword}"
4. Hashtags: at most 5, relevant to the script

[Output rules]
- Write the caption in {language}.
- At most 5 hashtags.
- Do not add any legal/affiliate disclosure — the system appends it automatically if configured.
- Output JSON only: {"caption": "..."}
"""

DEFAULT_CAPTION_KEYWORD = "link"

VIDEO_ANALYSIS_PROMPT = """Analyse the product shown in this video (or these videos) and return ONLY the JSON below,
with no other text. Write all values in {language}.
{
  "product_name": "exact product name",
  "category": "one of: beauty / health / kids / home / food / other",
  "key_features": ["feature 1", "feature 2", "feature 3", "feature 4", "feature 5"],
  "usage_method": "how to use it (max 100 characters)",
  "target_audience": "specific target audience (e.g. people in their 30s with dry skin)",
  "pain_points": ["problem it solves 1", "problem 2", "problem 3"],
  "suggested_title": "a Reels title, max 30 characters",
  "product_info": "a detailed summary for script writing: strengths, feel in use and effects, in a conversational tone (max 500 characters)"
}"""

SCRIPT_EVAL_PROMPT = """You are an expert who evaluates the quality of short-form video (Reels) scripts.

[Script under evaluation]
{script}

[Persona]: {persona}
[Target duration]: {target_seconds} seconds
[Script language]: {language}

Score each criterion from 1 to 10 and output JSON only:
- hook_quality: how well the hook creates empathy or curiosity
- coherence: how naturally the script flows
- persona_match: how well the tone matches the persona (score 10 if no persona is set)
- timing_estimate: estimated duration in seconds when read aloud
- overall_score: overall score

{"hook_quality": N, "coherence": N, "persona_match": N, "timing_estimate": N, "overall_score": N}"""


def fill(template: str, **values) -> str:
    """Replace ``{key}`` placeholders without touching other braces."""
    for key, value in values.items():
        template = template.replace("{" + key + "}", str(value))
    return template
