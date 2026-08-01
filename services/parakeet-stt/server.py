"""Parakeet STT service for Myra — a local, GPU speech-recognition server.

Why this exists: Whisper on this box runs on CPU (CTranslate2 crashes on the
Blackwell RTX 5060, sm_120) and the ~2.5s batch transcribe dominates Myra's
latency. NVIDIA Parakeet (NeMo TDT) runs on the GPU here — PyTorch cu128 has
sm_120 kernels — and transcribes a turn in ~85ms, ~150ms with phrase boosting.
Measured 2026-08-01: boosted Parakeet is both faster and MORE accurate on the
campaign's invented names than Whisper+vocabulary (it got "Basctdelm" and
"Ys'nonterien" exactly, which biased Whisper missed).

NeMo needs Python 3.12 and a large dependency tree, so it cannot live in the
agent's 3.12+ venv cleanly and certainly not its 3.13 one. This runs as its own
process — like Speaches and Ollama — and speaks an OpenAI-compatible
transcription API so the agent's existing `openai.STT` plugin talks to it with
no new client code: same `POST /v1/audio/transcriptions`, same `prompt` field.

The `prompt` field carries Myra's per-visitor vocabulary ("Names: A, B, C.",
built by stt_vocabulary_prompt in the agent). Whisper used it as an
initial_prompt; here the names are parsed out and applied as NeMo phrase
boosting on the *greedy* decoder (so the ~85ms speed is kept). The boosting tree
is rebuilt only when the phrase set changes — i.e. roughly once per session, not
per turn.

GPU: the box masks the GPU globally with CUDA_VISIBLE_DEVICES=-1 to keep
CTranslate2 (Speaches) off it. This service must be launched with an explicit
per-process CUDA_VISIBLE_DEVICES=0, exactly like the Ollama launcher. See
scripts/start-local-voice-stack.ps1.
"""

from __future__ import annotations

import io
import logging
import os
import threading
import time
from contextlib import asynccontextmanager
from typing import Optional

import librosa
import numpy as np
import soundfile as sf
import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s parakeet: %(message)s"
)
logger = logging.getLogger("parakeet")

MODEL_ID = os.getenv("PARAKEET_MODEL", "nvidia/parakeet-tdt-0.6b-v2")
# 2.0 was the measured sweet spot: every invented name correct with no
# regressions. 4.0 over-boosted into hallucination ("Emberstranes of
# Emberstran"). Keep it tunable but default to the proven value.
BOOST_ALPHA = float(os.getenv("PARAKEET_BOOST_ALPHA", "2.0"))
TARGET_SR = 16000

# NeMo's phrase-boosting graph uses Triton kernels by default; Triton is not
# available on Windows, so it must be disabled (falls back to a non-CUDA-graph
# path — slower, but still an order of magnitude under CPU Whisper).
USE_TRITON = False


class Transcriber:
    """Owns the model and serializes GPU access. Single-user home server: one
    model, one GPU, requests handled one at a time under a lock."""

    def __init__(self) -> None:
        self._model = None
        self._lock = threading.Lock()
        # The phrase set currently compiled into the decoder. None means "never
        # set"; () means "explicitly no boosting". Avoids rebuilding the boosting
        # tree when consecutive turns in a session send the same names.
        self._applied_phrases: Optional[tuple[str, ...]] = None
        self._boost_cfg_cls = None
        self._base_decoding_cfg = None

    def load(self) -> float:
        import nemo.collections.asr as nemo_asr
        from nemo.collections.asr.parts.context_biasing import BoostingTreeModelConfig
        from omegaconf import OmegaConf

        self._boost_cfg_cls = BoostingTreeModelConfig
        t0 = time.perf_counter()
        model = nemo_asr.models.ASRModel.from_pretrained(MODEL_ID).to("cuda").eval()
        self._model = model
        # Snapshot the pristine greedy decoding config so boosting can be turned
        # off again by restoring it.
        self._base_decoding_cfg = OmegaConf.to_container(model.cfg.decoding, resolve=True)
        # Warm up the CUDA kernels so the first real request is not slow. The
        # boosting/fusion path (triton off, no CUDA graphs) compiles lazily, and
        # that compile is bucketed by tree size: a 1-phrase warmup left a ~2s
        # recompile on the first realistically-sized tree. So warm up with a
        # tree at least as large as any real session's — the agent caps its
        # vocabulary near 21 phrases, so ~30 covers it — then clear it. Pays the
        # full ~12s compile once, here, instead of on a visitor's first turn.
        # The boosting/fusion decode path (triton off, no CUDA graphs) compiles
        # lazily on the first call that actually EMITS tokens — silence emits
        # nothing, so it stayed uncompiled and the first real turn paid ~1.4s.
        # Warm up on noise, which forces the decoder to emit tokens with boosting
        # active, so the compile happens here at startup instead. ~2s of noise.
        rng = np.random.default_rng(0)
        noise = (rng.standard_normal(TARGET_SR * 2) * 0.1).astype(np.float32)
        model.transcribe([noise], batch_size=1, verbose=False)
        with self._lock:
            self._apply_phrases(("Myrdae", "Aurelius Valeheart", "Heroes of Emberstran"))
            model.transcribe([noise], batch_size=1, verbose=False)
            self._apply_phrases(())
        torch.cuda.synchronize()
        return time.perf_counter() - t0

    def _apply_phrases(self, phrases: tuple[str, ...]) -> None:
        """Compile (or clear) the boosting tree. Caller holds the lock."""
        if phrases == self._applied_phrases:
            return
        from omegaconf import OmegaConf, open_dict

        dcfg = OmegaConf.create(dict(self._base_decoding_cfg))
        if phrases:
            with open_dict(dcfg):
                dcfg.greedy.boosting_tree = OmegaConf.create(
                    {
                        "key_phrases_list": list(phrases),
                        "use_triton": USE_TRITON,
                        "depth_scaling": 2.0,
                        "context_score": 1.0,
                    }
                )
                dcfg.greedy.boosting_tree_alpha = BOOST_ALPHA
        t0 = time.perf_counter()
        self._model.change_decoding_strategy(dcfg)
        self._applied_phrases = phrases
        logger.info(
            "boosting set to %d phrase(s) in %.0fms", len(phrases), (time.perf_counter() - t0) * 1000
        )

    def transcribe(self, audio_bytes: bytes, phrases: tuple[str, ...]) -> str:
        # Decode whatever the client sent (openai.STT sends a WAV at the capture
        # rate) and resample to the 16 kHz mono Parakeet expects.
        data, sr = sf.read(io.BytesIO(audio_bytes), dtype="float32", always_2d=False)
        if data.ndim > 1:
            data = data.mean(axis=1)
        if sr != TARGET_SR:
            data = librosa.resample(data, orig_sr=sr, target_sr=TARGET_SR)
        data = np.ascontiguousarray(data, dtype=np.float32)

        with self._lock:
            self._apply_phrases(phrases)
            out = self._model.transcribe([data], batch_size=1, verbose=False)
        item = out[0]
        return item.text if hasattr(item, "text") else str(item)


transcriber = Transcriber()


def parse_phrases(prompt: str | None) -> tuple[str, ...]:
    """Pull the name list out of Myra's vocabulary prompt.

    The agent sends exactly "Names: A, B, C." (stt_vocabulary_prompt). Be
    lenient: tolerate a missing prefix, stray whitespace, and the trailing dot.
    """
    if not prompt:
        return ()
    text = prompt.strip()
    lowered = text.lower()
    for prefix in ("names:", "a dungeons and dragons conversation about myrdae. names:"):
        if lowered.startswith(prefix):
            text = text[len(prefix):]
            break
    text = text.strip().rstrip(".")
    seen: set[str] = set()
    phrases: list[str] = []
    for chunk in text.split(","):
        name = chunk.strip()
        key = name.casefold()
        if name and key not in seen:
            seen.add(key)
            phrases.append(name)
    return tuple(phrases)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not torch.cuda.is_available():
        # Fail loudly: the whole point is the GPU. Running Parakeet on CPU would
        # be slower than the Whisper it is replacing.
        raise RuntimeError(
            "CUDA is not available. Launch with CUDA_VISIBLE_DEVICES=0 "
            "(the box masks the GPU with -1 by default)."
        )
    logger.info("device: %s", torch.cuda.get_device_name(0))
    logger.info("loading %s ...", MODEL_ID)
    load_s = transcriber.load()
    logger.info("model ready on GPU in %.1fs (boost alpha=%.1f)", load_s, BOOST_ALPHA)
    yield


app = FastAPI(title="Parakeet STT for Myra", lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model": MODEL_ID, "ready": transcriber._model is not None}


@app.get("/v1/models")
def models() -> dict:
    # Enough of the OpenAI shape that a client listing models sees this one.
    return {"object": "list", "data": [{"id": MODEL_ID, "object": "model", "owned_by": "nvidia"}]}


@app.post("/v1/audio/transcriptions")
def transcriptions(
    file: UploadFile = File(...),
    model: str = Form(default=MODEL_ID),
    language: str = Form(default="en"),
    prompt: Optional[str] = Form(default=None),
    response_format: str = Form(default="json"),
    temperature: Optional[float] = Form(default=None),
) -> JSONResponse:
    started = time.perf_counter()
    try:
        audio_bytes = file.file.read()
        phrases = parse_phrases(prompt)
        text = transcriber.transcribe(audio_bytes, phrases)
    except Exception as exc:  # surface as 500 so the client's FallbackAdapter fails over
        logger.exception("transcription failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    elapsed_ms = (time.perf_counter() - started) * 1000
    logger.info("transcribed in %.0fms (%d phrases): %s", elapsed_ms, len(phrases), text)
    # OpenAI transcription "json" response is simply {"text": ...}.
    return JSONResponse({"text": text})


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PARAKEET_PORT", "8767"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
