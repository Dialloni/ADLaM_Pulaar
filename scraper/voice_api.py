# Gando voice service — Pulaar TTS + ASR via Meta MMS (CC-BY-NC: research/beta only).
# The Gando server calls this; users never hit it directly.
#   POST /tts {text: <latin pulaar>, rate: 0.5-1.5}  -> audio/wav
#   POST /asr {audio: <base64>, mime: "audio/webm"}  -> {"text": <latin pulaar>, "lang": ...}
# Run: uvicorn voice_api:app --host 0.0.0.0 --port 8077
# Models lazy-load on first use (TTS ~150MB, ASR ~3.9GB download).
import base64
import io
import os
import subprocess

import torch
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

app = FastAPI()

# Shared-secret gate: set VOICE_SHARED_SECRET here AND on the Gando server to
# lock /tts + /asr to Gando-only traffic. Unset = open (safe rollout order).
VOICE_SHARED_SECRET = os.environ.get("VOICE_SHARED_SECRET", "")


def require_secret(x_voice_secret: str = Header(default="")):
    if VOICE_SHARED_SECRET and x_voice_secret != VOICE_SHARED_SECRET:
        raise HTTPException(401, "unauthorized")
_tts: dict = {}
_asr: dict = {}

TTS_MODEL = "facebook/mms-tts-ful"
ASR_MODEL = "facebook/mms-1b-all"
# Fula adapter candidates, first that loads wins (macro-language first).
ASR_LANGS = ["ful", "fuf", "fuv", "ffm", "fuc", "fub"]


def get_tts():
    if not _tts:
        from transformers import AutoTokenizer, VitsModel
        _tts["model"] = VitsModel.from_pretrained(TTS_MODEL)
        _tts["tok"] = AutoTokenizer.from_pretrained(TTS_MODEL)
    return _tts["model"], _tts["tok"]


def get_asr():
    if not _asr:
        from transformers import AutoProcessor, Wav2Vec2ForCTC
        last_err: Exception | None = None
        for lang in ASR_LANGS:
            try:
                proc = AutoProcessor.from_pretrained(ASR_MODEL, target_lang=lang)
                model = Wav2Vec2ForCTC.from_pretrained(ASR_MODEL, target_lang=lang, ignore_mismatched_sizes=True)
                _asr.update(model=model, proc=proc, lang=lang)
                break
            except Exception as e:  # adapter not available — try next dialect code
                last_err = e
        if not _asr:
            raise last_err or RuntimeError("no Fula ASR adapter found")
    return _asr["model"], _asr["proc"], _asr["lang"]


class TtsReq(BaseModel):
    text: str
    rate: float = 0.8


@app.post("/tts", dependencies=[Depends(require_secret)])
def tts(req: TtsReq):
    text = req.text.strip()
    if not text:
        raise HTTPException(400, "text required")
    import scipy.io.wavfile as wavfile
    model, tok = get_tts()
    model.speaking_rate = max(0.5, min(1.5, req.rate))
    inputs = tok(text[:600], return_tensors="pt")
    with torch.no_grad():
        wave = model(**inputs).waveform
    buf = io.BytesIO()
    wavfile.write(buf, rate=model.config.sampling_rate, data=wave.squeeze().numpy())
    return Response(content=buf.getvalue(), media_type="audio/wav")


class AsrReq(BaseModel):
    audio: str  # base64, any ffmpeg-readable container (webm/ogg/wav/m4a)
    mime: str = "audio/webm"


@app.post("/asr", dependencies=[Depends(require_secret)])
def asr(req: AsrReq):
    try:
        raw = base64.b64decode(req.audio)
    except Exception:
        raise HTTPException(400, "invalid base64 audio")
    if not raw:
        raise HTTPException(400, "audio required")
    # Normalize anything the browser sends to 16 kHz mono wav.
    ff = subprocess.run(
        ["ffmpeg", "-i", "pipe:0", "-ar", "16000", "-ac", "1", "-f", "wav", "pipe:1"],
        input=raw, capture_output=True,
    )
    if ff.returncode != 0:
        raise HTTPException(400, f"audio decode failed: {ff.stderr[-200:].decode(errors='replace')}")
    import soundfile as sf
    data, sr = sf.read(io.BytesIO(ff.stdout))
    model, proc, lang = get_asr()
    inputs = proc(data, sampling_rate=sr, return_tensors="pt")
    with torch.no_grad():
        logits = model(**inputs).logits
    text = proc.decode(logits.argmax(-1)[0])
    return {"text": text, "lang": lang}


@app.get("/health")
def health():
    return {"ok": True, "tts_loaded": bool(_tts), "asr_loaded": bool(_asr)}
