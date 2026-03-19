"""
Persona AI functions — extract and update user personas using OpenAI.
"""

import json
import os

from openai import OpenAI


def extract_persona(
    new_input: str,
    previous_input: str | None = None,
    viewing_signals: str | None = None,
    keywords: str | None = None,
) -> dict:
    """
    Port of extractPersonaWithAI() from web/src/app/api/persona/route.ts.
    Returns dict with: summary, interests, profession, expertise, contentPref.
    """
    context_parts = []

    if previous_input:
        context_parts.append(f'Previous self-description: "{previous_input}"')

    if viewing_signals:
        try:
            signals = json.loads(viewing_signals)
            topics = signals.get("topics", [])
            if topics:
                context_parts.append(f"Topics from viewing history: {', '.join(topics)}")
        except Exception:
            pass

    if keywords:
        context_parts.append(f"User's interest keywords: {keywords}")

    context = (
        "\n\nAdditional context:\n" + "\n".join(context_parts)
        if context_parts
        else ""
    )

    prompt = f"""Extract a user persona from this self-description. Be concise and specific.

User's input: "{new_input}"{context}

Extract and return a JSON object with these fields (keep each field short and specific):
- summary: A one-sentence description of who this person is (max 100 chars)
- interests: Comma-separated list of specific interests (max 10 items)
- profession: Their job/role if mentioned, or "Not specified" (max 50 chars)
- expertise: Their skill levels in mentioned areas (max 100 chars)
- contentPref: What kind of content they prefer/avoid (max 100 chars)

Return ONLY valid JSON, no markdown or explanation."""

    try:
        openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        completion = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a persona extraction assistant. Extract structured persona data from user descriptions. Return only valid JSON.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=500,
        )

        content = completion.choices[0].message.content or "{}"

        json_str = content.strip()
        if json_str.startswith("```"):
            json_str = json_str.replace("```json\n", "").replace("```\n", "").replace("```", "")

        parsed = json.loads(json_str)

        return {
            "summary": (parsed.get("summary") or "")[:500],
            "interests": (parsed.get("interests") or "")[:500],
            "profession": (parsed.get("profession") or "")[:100],
            "expertise": (parsed.get("expertise") or "")[:200],
            "contentPref": (parsed.get("contentPref") or "")[:300],
        }
    except Exception:
        return {
            "summary": new_input[:100],
            "interests": keywords or "",
            "profession": "Not specified",
            "expertise": "",
            "contentPref": "",
        }


def update_persona_from_signals(
    current_persona: str | None = None,
    viewing_signals: str | None = None,
) -> dict:
    """
    Port of generateUpdatedPersona() from web/src/app/api/recommendations/generate/route.ts.
    Returns dict with: summary, interests, profession, expertise, contentPref, compiledPersona.
    """
    signals_parts = []

    if viewing_signals:
        try:
            signals = json.loads(viewing_signals)
            if signals.get("bilibili", {}).get("analysis"):
                signals_parts.append(f"Bilibili viewing patterns: {signals['bilibili']['analysis']}")
            if signals.get("youtube", {}).get("analysis"):
                signals_parts.append(f"YouTube viewing patterns: {signals['youtube']['analysis']}")
        except Exception:
            pass

    current_persona_text = current_persona or "No existing persona"
    signals_text = "\n".join(signals_parts) if signals_parts else "No viewing signals available"

    prompt = f"""You are updating a user's persona based on their current profile and viewing history analysis.

Current Persona: "{current_persona_text}"

Viewing History Analysis:
{signals_text}

Based on this information, generate an updated persona. Extract and return a JSON object with these fields:
- summary: A one-sentence description of who this person is (max 100 chars)
- interests: Comma-separated list of specific interests based on viewing patterns (max 10 items)
- profession: Their job/role if mentioned, or "Not specified" (max 50 chars)
- expertise: Their skill levels in mentioned areas (max 100 chars)
- contentPref: What kind of content they prefer based on viewing history (max 100 chars)

Return ONLY valid JSON, no markdown or explanation."""

    try:
        openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        completion = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a persona analysis assistant. Generate structured persona data from viewing history. Return only valid JSON.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.5,
            max_tokens=500,
        )

        content = completion.choices[0].message.content or "{}"

        json_str = content.strip()
        if json_str.startswith("```"):
            json_str = json_str.replace("```json\n", "").replace("```\n", "").replace("```", "")

        parsed = json.loads(json_str)

        extracted = {
            "summary": (parsed.get("summary") or "")[:500],
            "interests": (parsed.get("interests") or "")[:500],
            "profession": (parsed.get("profession") or "Not specified")[:100],
            "expertise": (parsed.get("expertise") or "")[:200],
            "contentPref": (parsed.get("contentPref") or "")[:300],
        }

        parts = []
        if extracted["summary"]:
            parts.append(extracted["summary"])
        if extracted["profession"] and extracted["profession"] != "Not specified":
            parts.append(f"Works as: {extracted['profession']}.")
        if extracted["interests"]:
            parts.append(f"Interested in: {extracted['interests']}.")
        if extracted["contentPref"]:
            parts.append(f"Prefers: {extracted['contentPref']}.")

        compiled_persona = " ".join(parts)[:1000]

        return {**extracted, "compiledPersona": compiled_persona}
    except Exception:
        return {
            "summary": (current_persona or "")[:100],
            "interests": "",
            "profession": "Not specified",
            "expertise": "",
            "contentPref": "",
            "compiledPersona": current_persona or "",
        }
