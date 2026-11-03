"""Duration, sample peak, integrated loudness and loudest 100 ms of MP3 files, as JSON.
Usage: python3 -I measure.py <file.mp3>...

Loudness is ffmpeg's ebur128 integrated LUFS with 1 s of silence padded either side (a sound under 400 ms still gets a
gated block, so short sounds read lower: compare them with library sounds of their length). Peaks are read in the file's
own channel count (ffmpeg's mono-to-stereo upmix is 3 dB down)."""
import subprocess, sys, json, os
import numpy as np

SR = 44100


def channels(p):
    return int(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=channels", "-of", "csv=p=0", p],
                              capture_output=True, text=True, check=True).stdout.split()[0])


def load(p):
    ch = channels(p)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-f", "f32le", "-ac", str(ch), "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).astype(np.float64)


def db(v):
    return 20 * np.log10(max(v, 1e-12))


def lufs_array(x):
    """Integrated loudness (ebur128) with 1 s of digital silence either side, so a sound under 400 ms still gets a gated
    block. Mono is measured as one channel, as ebur128 does."""
    x = x if x.ndim == 2 else x[:, None]
    pad = np.zeros((SR, x.shape[1]))
    data = np.concatenate([pad, x, pad]).astype(np.float32).tobytes()
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-f", "f32le", "-ac", str(x.shape[1]), "-ar", str(SR), "-i", "-",
                          "-af", "ebur128", "-f", "null", "-"], input=data, capture_output=True).stderr.decode()
    s = out[out.rfind("Summary:"):]
    return float(s.split("I:")[1].split("LUFS")[0])


def rms100(m):
    n = int(SR * 0.1)
    if len(m) < n:
        return 10 * np.log10((m ** 2).mean() + 1e-12)
    c = np.cumsum(np.concatenate([[0], m ** 2]))
    return 10 * np.log10(((c[n:] - c[:-n]) / n).max() + 1e-12)


def onset_ms(a):
    """The first sample within 24 dB of the peak: where the sound's attack is."""
    i = np.nonzero(a > a.max() * 10 ** (-24 / 20))[0]
    return i[0] / SR * 1000 if len(i) else 0.0


out = {}
for p in sys.argv[1:]:
    x = load(p)
    a = np.abs(x).max(1)
    out[os.path.basename(p)] = {"dur": round(len(x) / SR, 3), "peak": round(db(a.max()), 1), "lufs": round(lufs_array(x), 1),
                                "rms100": round(rms100(x.mean(1)), 1), "onset_ms": round(onset_ms(a), 1)}
print(json.dumps(out))
