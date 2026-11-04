"""mlx_lm.lora with a trainable Qwen3.5 linear-attention path.

mlx-lm trains the gated delta rule with a per-token loop that keeps every
[H, Dv, Dk] state for backprop (~1 MB per token per layer, so ~200 GB for one
3k-token sample). This swaps in the chunked WY form (as in
flash-linear-attention / transformers' torch_chunk_gated_delta_rule): states
only at chunk edges, matmuls inside. Inference still uses mlx-lm's kernel.

    python train.py -c lora.yaml   # same flags as mlx_lm.lora
    python train.py --selftest
"""

import sys

import mlx.core as mx
import mlx.nn as nn
import mlx_lm.models.qwen3_5 as qwen3_5

CHUNK = 64


def unit_lower_inverse(L):
    """(I + L)^-1 for strictly lower-triangular L [..., C, C], C a power of
    two, by merging inverted diagonal blocks: [[A, 0], [B, D]]^-1 =
    [[A^-1, 0], [-D^-1 B A^-1, D^-1]]. A power series in L is exact too but
    loses all precision once neighbouring keys are alike, as in real text."""
    C = L.shape[-1]
    lead = L.shape[:-2]
    inv = mx.ones(lead + (C, 1, 1))
    b = 1
    while b < C:
        nb = C // (2 * b)
        blocks = mx.diagonal(L.reshape(lead + (nb, 2 * b, nb, 2 * b)), axis1=-4, axis2=-2)
        lower_left = mx.moveaxis(blocks, -1, -3)[..., b:, :b]
        pairs = inv.reshape(lead + (nb, 2, b, b))
        A_inv, D_inv = pairs[..., 0, :, :], pairs[..., 1, :, :]
        top = mx.concatenate([A_inv, mx.zeros_like(A_inv)], axis=-1)
        bottom = mx.concatenate([-(D_inv @ lower_left @ A_inv), D_inv], axis=-1)
        inv = mx.concatenate([top, bottom], axis=-2)
        b *= 2
    return inv.reshape(lead + (C, C))


def chunked_gated_delta(q, k, v, log_g, beta, state, mask=None):
    """q, k: [B, T, Hk, Dk] (q pre-scaled); v: [B, T, Hv, Dv];
    log_g, beta: [B, T, Hv]; state: [B, Hv, Dv, Dk]."""
    B, T, Hk, Dk = q.shape
    Hv, Dv = v.shape[-2:]
    if Hv // Hk > 1:
        q = mx.repeat(q, Hv // Hk, -2)
        k = mx.repeat(k, Hv // Hk, -2)
    dtype = q.dtype
    q, k, v, log_g, beta = (x.astype(mx.float32) for x in (q, k, v, log_g, beta))
    if mask is not None:
        # Padded steps neither decay nor write the state.
        log_g = mx.where(mask[..., None], log_g, 0)
        beta = mx.where(mask[..., None], beta, 0)

    C = CHUNK
    pad = (-T) % C
    if pad:
        q, k, v = (mx.pad(x, [(0, 0), (0, pad), (0, 0), (0, 0)]) for x in (q, k, v))
        log_g, beta = (mx.pad(x, [(0, 0), (0, pad), (0, 0)]) for x in (log_g, beta))
    n = (T + pad) // C

    def chunks(x):
        return x.reshape(B, n, C, Hv, -1).transpose(0, 3, 1, 2, 4)

    q, k, v = chunks(q), chunks(k), chunks(v)
    g = mx.cumsum(log_g.reshape(B, n, C, Hv).transpose(0, 3, 1, 2), axis=-1)
    beta = beta.reshape(B, n, C, Hv).transpose(0, 3, 1, 2)[..., None]
    kb, vb = k * beta, v * beta

    lower = mx.tril(mx.ones((C, C), dtype=mx.bool_))
    strict = mx.tril(mx.ones((C, C), dtype=mx.bool_), -1)
    diff = g[..., :, None] - g[..., None, :]
    decay = mx.where(lower, mx.exp(mx.where(lower, diff, 0)), 0)

    W = unit_lower_inverse(mx.where(strict, (kb @ k.swapaxes(-1, -2)) * decay, 0))
    u = W @ vb
    w = W @ (kb * mx.exp(g)[..., None])

    S = state.astype(mx.float32).swapaxes(-1, -2)  # [B, H, Dk, Dv]
    outs = []
    for i in range(n):
        qi, ki, gi = q[:, :, i], k[:, :, i], g[:, :, i]
        v_new = u[:, :, i] - w[:, :, i] @ S
        intra = (qi @ ki.swapaxes(-1, -2)) * decay[:, :, i]
        outs.append((qi * mx.exp(gi)[..., None]) @ S + intra @ v_new)
        last = gi[..., -1:]
        S = S * mx.exp(last)[..., None] + (
            ki * mx.exp(last - gi)[..., None]
        ).swapaxes(-1, -2) @ v_new
    out = mx.stack(outs, axis=2).transpose(0, 2, 3, 1, 4).reshape(B, n * C, Hv, Dv)
    return out[:, :T].astype(dtype), S.swapaxes(-1, -2)


_kernel_update = qwen3_5.gated_delta_update


def gated_delta_update(q, k, v, a, b, A_log, dt_bias, state=None, mask=None, *, use_kernel=True, **kw):
    if use_kernel or kw:
        return _kernel_update(q, k, v, a, b, A_log, dt_bias, state, mask, use_kernel=use_kernel, **kw)
    log_g = -mx.exp(A_log.astype(mx.float32)) * nn.softplus(a + dt_bias)
    if state is None:
        state = mx.zeros((q.shape[0], v.shape[-2], v.shape[-1], q.shape[-1]), dtype=mx.float32)
    return chunked_gated_delta(q, k, v, log_g, mx.sigmoid(b), state, mask)


def selftest():
    from mlx_lm.models.gated_delta import gated_delta_ops

    mx.random.seed(0)
    B, T, H, D = 2, 150, 4, 32
    for alike in (False, True):
        q = mx.random.normal((B, T, H, D)) * D**-0.5
        k = mx.random.normal((B, T, H, D))
        if alike:
            # Real text: neighbouring keys nearly parallel, little decay.
            k = mx.random.normal((B, 1, H, D)) + 0.05 * k
        k = k / mx.linalg.norm(k, axis=-1, keepdims=True)
        v = mx.random.normal((B, T, H, D))
        log_g = -mx.random.uniform(0, 0.02 if alike else 1, (B, T, H))
        beta = mx.random.uniform(0.5 if alike else 0, 1, (B, T, H))
        state = mx.random.normal((B, H, D, D)) * 0.1

        ref_y, ref_s = gated_delta_ops(q, k, v, mx.exp(log_g), beta, state)
        y, s = chunked_gated_delta(q, k, v, log_g, beta, state)
        assert mx.allclose(y, ref_y, atol=1e-3, rtol=1e-3).item(), mx.abs(y - ref_y).max()
        assert mx.allclose(s, ref_s, atol=1e-3, rtol=1e-3).item(), mx.abs(s - ref_s).max()

        loss = lambda f: lambda q, k, v: (f(q, k, v) ** 2).sum()
        args = (q, k, v)
        ref = mx.grad(loss(lambda q, k, v: gated_delta_ops(q, k, v, mx.exp(log_g), beta, state)[0]), argnums=(0, 1, 2))(*args)
        got = mx.grad(loss(lambda q, k, v: chunked_gated_delta(q, k, v, log_g, beta, state)[0]), argnums=(0, 1, 2))(*args)
        for r, g in zip(ref, got):
            scale = mx.abs(r).max()
            assert (mx.abs(g - r).max() / scale).item() < 1e-3, (mx.abs(g - r).max(), scale)
    print("selftest ok")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest()
    else:
        qwen3_5.gated_delta_update = gated_delta_update
        from mlx_lm.lora import main

        main()
