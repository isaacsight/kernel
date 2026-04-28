# Reference: LLaDA2.0-Uni (Inclusion AI, 2026-04-22)

**Title:** *LLaDA2.0-Uni: Unifying Multimodal Understanding and Generation with Diffusion Large Language Model*
**Authors:** Tiwei Bie, Haoxing Chen, Tieyuan Chen, Zhenglin Cheng, Long Cui, Kai Gan, Zhicheng Huang, Zhenzhong Lan, Haoquan Li, Jianguo Li, Tao Lin, Qi Qin, Hongjun Wang, Xiaomei Wang, Haoyuan Wu, Yi Xin, Junbo Zhao
**Affiliation:** AGI Research Center, Inclusion AI
**ArXiv:** [2604.20796](https://arxiv.org/abs/2604.20796)
**Repo:** <https://github.com/inclusionAI/LLaDA2.0-Uni>
**Weights:** <https://huggingface.co/inclusionAI/LLaDA2.0-Uni>
**License:** Apache 2.0

## Architecture in three pieces

1. **Discrete semantic tokenizer (SigLIP-VQ).** Visual inputs are quantized
   into discrete semantic tokens, sharing a token vocabulary with the dLLM.
2. **Unified dLLM-MoE backbone.** Mask-token prediction on a joint text+image
   token stream — same model, same objective for understanding *and*
   generation. Built on LLaDA 2.0.
3. **Diffusion decoder + 8-step distillation.** A specialized decoder
   reconstructs pixels from the discrete token plan; the distilled
   "decoder-turbo" runs in 8 steps with negligible quality loss.

Modes exposed: `generate_image`, `generate_image(mode="thinking")`,
`understand_image`, `edit_image`. SPRINT acceleration (KV-cache reuse +
adaptive unmasking + batch acceptance) is built in.

## Why this matters for kbot's action-token research

The action-token track is asking a structurally similar question: *can we
encode a stream of discrete agent decisions (tool calls, agent routes) as a
token vocabulary, and predict the next decision the way an LLM predicts the
next word?* LLaDA2.0-Uni is an existence proof that the
**discrete-tokenizer + diffusion-decoder** pattern works across modalities
that don't share a natural vocabulary — image patches and text — by routing
both through a shared mask-prediction objective.

Three bits we want to keep an eye on:

- **Mask-token prediction beats next-token AR for non-sequential structure.**
  Tool-call plans aren't strictly sequential either (parallel sub-agents,
  retry branches). A diffusion / mask-fill objective may match the structure
  of an action plan better than left-to-right AR.
- **Distillation to 8-step inference.** If we ever ship a real action-token
  model on-device, distilled few-step diffusion is a credible serving target
  (vs. the 50–100-step transformer rollouts the original transformer
  proposal assumed).
- **Unified backbone.** One model that does both planning and execution
  (reasoning *and* image gen, in LLaDA's case) is the same shape as the
  unified planner+router we sketched in `PROPOSAL.md`. Worth tracking the
  scaling story — does a unified objective help action prediction the way
  it helped Inclusion AI's multimodal numbers?

This is a watch-list reference — not a recommendation to pivot the embedding
nearest-neighbor track. The current `embedding-nn/` direction is the one we
ship; LLaDA2.0-Uni is filed here so we don't lose the connection if the
action-token vocabulary question comes back.

## Citation

```bibtex
@article{LLaDA2Uni,
  title  = {LLaDA2.0-Uni: Unifying Multimodal Understanding and Generation with Diffusion Large Language Model},
  author = {Bie, Tiwei and Chen, Haoxing and Chen, Tieyuan and Cheng, Zhenglin and Cui, Long and Gan, Kai and Huang, Zhicheng and Lan, Zhenzhong and Li, Haoquan and Li, Jianguo and Lin, Tao and Qin, Qi and Wang, Hongjun and Wang, Xiaomei and Wu, Haoyuan and Xin, Yi and Zhao, Junbo},
  journal = {arXiv preprint arXiv:2604.20796},
  year   = {2026}
}
```

## kbot integration

LLaDA2.0-Uni is wired in as a local provider:

- `src/providers/llada.ts` — typed HTTP client (OpenAI-compatible shape, see comment for the SPEC caveat).
- `src/tools/llada-image.ts` — `local_image_thoughtful` tool. $0 path to plan/refine/generate image gen.
- `src/auth.ts` — `llada` entry in the PROVIDERS map.
