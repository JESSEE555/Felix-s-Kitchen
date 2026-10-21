/* =====================================================================
   Thin wrappers around the OpenAI API, called directly from the browser.
   Every page that uses these must load config.js first.
   ===================================================================== */

function hasApiKey(){
  return typeof OPENAI_API_KEY === 'string' && OPENAI_API_KEY.trim().length > 0;
}

function apiKeyMissingError(){
  const err = new Error('missing_api_key');
  err.code = 'missing_api_key';
  return err;
}

/**
 * Send a chat completion request.
 * @param {Array<{role:string, content:string}>} messages
 * @param {{ json?: boolean, temperature?: number }} opts
 * @returns {Promise<string>} the assistant's reply text
 */
async function openaiChat(messages, opts = {}){
  if(!hasApiKey()) throw apiKeyMissingError();

  const body = {
    model: OPENAI_CHAT_MODEL,
    messages,
    temperature: opts.temperature ?? 0.7
  };
  if(opts.json){
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if(!res.ok){
    const detail = await res.text().catch(() => '');
    throw new Error(`OpenAI chat request failed (${res.status}): ${detail.slice(0,200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

/**
 * Transcribe an audio blob (from MediaRecorder) using Whisper.
 * @param {Blob} audioBlob
 * @returns {Promise<string>} transcript text
 */
async function openaiTranscribe(audioBlob){
  if(!hasApiKey()) throw apiKeyMissingError();

  const form = new FormData();
  const filename = 'recording.' + (audioBlob.type.includes('mp4') ? 'mp4' : 'webm');
  form.append('file', audioBlob, filename);
  form.append('model', OPENAI_TRANSCRIBE_MODEL);

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: form
  });

  if(!res.ok){
    const detail = await res.text().catch(() => '');
    throw new Error(`OpenAI transcription failed (${res.status}): ${detail.slice(0,200)}`);
  }

  const data = await res.json();
  return (data.text || '').trim();
}

/**
 * Convert text to speech and return a playable object URL.
 * @param {string} text
 * @returns {Promise<string>} blob: URL for an <audio> element
 */
async function openaiSpeak(text){
  if(!hasApiKey()) throw apiKeyMissingError();

  const body = {
    model: OPENAI_TTS_MODEL,
    voice: OPENAI_TTS_VOICE,
    input: text,
    speed: typeof OPENAI_TTS_SPEED === 'number' ? OPENAI_TTS_SPEED : 1.0
  };
  // Only gpt-4o-mini-tts (not the older tts-1/tts-1-hd) understands "instructions".
  if(typeof OPENAI_TTS_INSTRUCTIONS === 'string' && OPENAI_TTS_MODEL === 'gpt-4o-mini-tts'){
    body.instructions = OPENAI_TTS_INSTRUCTIONS;
  }

  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if(!res.ok){
    const detail = await res.text().catch(() => '');
    throw new Error(`OpenAI text-to-speech failed (${res.status}): ${detail.slice(0,200)}`);
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/**
 * Small reusable banner shown when no API key is configured yet, or a
 * request fails. Call with a container element to render into.
 */
function renderApiNotice(container, message){
  container.innerHTML = `
    <div class="api-notice">
      <span>⚠️</span>
      <div>
        <strong>${message}</strong>
        <p>Open <code>config.js</code> in the site folder and paste your OpenAI API key in, then reload the page.</p>
      </div>
    </div>`;
}

/**
 * Plays a TTS blob URL with a slight loudness boost via Web Audio — the
 * OpenAI TTS API itself has no volume/loudness parameter, so this is done
 * client-side by boosting gain beyond the normal 1.0 ceiling of
 * <audio>.volume. Falls back to plain <audio> playback if Web Audio isn't
 * available. Returns the underlying <audio> element (has .onended, etc).
 */
function playLoud(url, gainAmount = 1.6){
  let audio;
  try{
    audio = new Audio(url);
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const source = ctx.createMediaElementSource(audio);
    const gainNode = ctx.createGain();
    gainNode.gain.value = gainAmount;
    source.connect(gainNode).connect(ctx.destination);
  }catch(err){
    console.error('playLoud: falling back to plain audio (no gain boost):', err);
    audio = new Audio(url);
    audio.volume = 1.0;
  }
  const playPromise = audio.play();
  audio._playPromise = playPromise; // callers can await this for e.g. autoplay-block detection
  return audio;
}
