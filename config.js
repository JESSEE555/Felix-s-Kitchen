/* =====================================================================
   OpenAI configuration — EDIT THIS FILE YOURSELF, LOCALLY.

   Paste your own OpenAI API key below between the quotes.
   NEVER share this file, paste your key into a chat, or commit it to a
   public GitHub repo — anyone who sees it can spend money on your account.

   Because this is a static site with no backend, this key is visible to
   anyone who opens their browser's dev tools while using the site. That's
   fine for personal/local use, but do not deploy this publicly as-is.
   ===================================================================== */

const OPENAI_API_KEY = "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";  // <-- paste your key between these quotes, e.g. "sk-proj-...."

// Models used across the site. gpt-4o-mini is inexpensive and fast — good default.
const OPENAI_CHAT_MODEL = "gpt-4o-mini";
const OPENAI_TRANSCRIBE_MODEL = "whisper-1";
const OPENAI_TTS_MODEL = "gpt-4o-mini-tts"; // newer model — supports style "instructions" below for a more expressive, human voice
const OPENAI_TTS_VOICE = "shimmer";  // try "ballad", "verse", "nova", or "fable" too — voice character is very much a matter of taste, worth A/B testing
const OPENAI_TTS_SPEED = 1.0;        // 1.0 = natural pace (brisk speeds like 1.08+ tend to read as clipped/robotic)
const OPENAI_TTS_INSTRUCTIONS = "Speak like a real person having a warm, casual conversation with a friend — natural conversational pacing with small pauses, slightly varied rhythm and pitch, genuine emotional warmth. Avoid the flat, evenly-paced, over-enunciated cadence of a typical AI assistant or announcer. Let energy rise and fall naturally rather than staying uniformly upbeat."
