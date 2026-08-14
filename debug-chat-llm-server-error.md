# Debug Session: chat-llm-server-error
**Status:** [OPEN]  
**Date:** 2026-06-01  
**Description:** When trying to send a message to the LLM, it shows "Erro: Erro ao comunicar com servidor de IA"

---

## Hypotheses
1. **Hypothesis 1:** The agent's provider is not correctly normalized, so it's trying to use OpenAI even when it should use Gemini → **Partially addressed** (added normalization)
2. **Hypothesis 2:** The API keys are missing from the environment variables → **CONFIRMED!** Root cause! Environment variable name mismatch!
3. **Hypothesis 3:** The model name being sent to Gemini is invalid → **Addressed** (added model mapping)
4. **Hypothesis 4:** The API route /api/llm is not reachable or throwing a 500 error
5. **Hypothesis 5:** The knowledge base/documents processing is throwing an error before calling the LLM

---

## Evidence
### Pre-Fix Logs
- [x] Hypothesis 2 confirmed! The code was looking for JUNOS_GEMINI_API_KEY/VITE_GEMINI_API_KEY, but env var is named GEMINI_API_KEY!
- [x] Root cause FOUND! Vite config was only loading env vars with prefixes JUNOS_/VITE_, so GEMINI_API_KEY was never loaded!

---

## Changes Made
- [x] Fix env var name mismatch in constants.ts and api/llm.ts (added support for GEMINI_API_KEY and OPENAI_API_KEY directly)
- [x] Added logging for API key presence
- [x] FIXED VITE CONFIG! Added GEMINI_ and OPENAI_ to envPrefix and loadEnv in vite.config.ts
- [x] Added detailed logging in client-side (services/llmService.ts)
- [x] Added full error reporting in /api/llm.ts
- [x] Added auto-detection of provider based on model name (if model contains gpt → openai, else gemini)
- [x] Added failsafe fallback to Gemini if OpenAI key is missing


### Post-Fix Logs
- [ ] Fix applied
- [ ] Logs collected
- [ ] Issue verified resolved

---

## Changes Made
- [ ] Instrumentation added
- [ ] Fix implemented
- [ ] Instrumentation removed
