# Parakeet STT service

GPU speech recognition for Myra, replacing CPU Whisper as the **primary** engine.
NVIDIA Parakeet (NeMo TDT) on the RTX 5060 transcribes a turn in ~85ms (~150ms
with phrase boosting) versus ~2.5s for CPU Whisper, and — with boosting — is
**more accurate** on the campaign's invented names.

The agent keeps Whisper (Speaches) as an automatic fallback, so if this service
is down Myra still hears. See `services/livekit-schedule-agent` (`build_stt`).

## Why a separate process

NeMo needs Python 3.12 and a large dependency tree that doesn't belong in the
agent's venv. Like Speaches and Ollama, this runs standalone and speaks the
OpenAI transcription API, so the agent's existing `openai.STT` plugin talks to
it unchanged — same `POST /v1/audio/transcriptions`, same `prompt` field.

## Setup

```powershell
services\parakeet-stt\setup.ps1
```

Creates the venv at `%LOCALAPPDATA%\SuwaneeGamers\Parakeet\.venv` (not committed)
and installs torch (cu128, for the Blackwell sm_120 GPU) plus `nemo_toolkit[asr]`
and the server deps. First run also downloads the ~2.4 GB model to the HF cache.

## Run

Launched automatically by `scripts/start-local-voice-stack.ps1`. Manually:

```powershell
$env:CUDA_VISIBLE_DEVICES = "0"   # REQUIRED — the box masks the GPU with -1
& "$env:LOCALAPPDATA\SuwaneeGamers\Parakeet\.venv\Scripts\python.exe" `
    services\parakeet-stt\server.py
```

Listens on `http://127.0.0.1:8767`. Warm start ~10s (first-ever start downloads
the model, ~5 min).

## GPU note

The machine sets `CUDA_VISIBLE_DEVICES=-1` at User+Machine scope to keep
CTranslate2 (Speaches) off the Blackwell card, which it crashes on. This service
**must** be launched with a per-process `CUDA_VISIBLE_DEVICES=0` — exactly how
Ollama gets the GPU. The global mask stays; never change it.

## Phrase boosting

The `prompt` field carries Myra's per-visitor vocabulary (`"Names: A, B, C."`,
built by `stt_vocabulary_prompt` in the agent). The service parses the names and
applies them as NeMo GPU phrase boosting on the greedy decoder. The boosting
tree is rebuilt only when the phrase set changes — about once per session.

## Config (env)

| var | default | meaning |
|---|---|---|
| `PARAKEET_PORT` | `8767` | listen port |
| `PARAKEET_MODEL` | `nvidia/parakeet-tdt-0.6b-v2` | NeMo model id |
| `PARAKEET_BOOST_ALPHA` | `2.0` | boosting strength (2.0 is the measured sweet spot; 4.0 over-boosts) |

## Endpoints

- `POST /v1/audio/transcriptions` — OpenAI-compatible (`file`, `model`,
  `language`, `prompt`); returns `{"text": ...}`.
- `GET /health`, `GET /v1/models`.
