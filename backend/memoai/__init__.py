"""MemoAI package initialization."""
__version__ = "0.1.0"

# Fix compatibility between faster-whisper and newer PyAV versions (av >= 14 removed 'metadata_errors' parameter)
try:
    import av
    _orig_av_open = av.open

    def _safe_av_open(*args, **kwargs):
        if "metadata_errors" in kwargs:
            try:
                return _orig_av_open(*args, **kwargs)
            except TypeError as e:
                if "metadata_errors" in str(e):
                    kwargs.pop("metadata_errors", None)
                    return _orig_av_open(*args, **kwargs)
                raise e
        return _orig_av_open(*args, **kwargs)

    av.open = _safe_av_open
except ImportError:
    pass

