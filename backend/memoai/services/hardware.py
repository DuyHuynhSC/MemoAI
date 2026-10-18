import os
import platform
import sys
from typing import Any


def get_system_ram_gb() -> tuple[float, float]:
    """Return (total_ram_gb, available_ram_gb).
    Uses psutil if available; otherwise falls back to OS-specific APIs with zero external dependencies.
    """
    try:
        import psutil
        vm = psutil.virtual_memory()
        return round(vm.total / (1024**3), 2), round(vm.available / (1024**3), 2)
    except ImportError:
        pass

    # Windows fallback via kernel32 GlobalMemoryStatusEx
    if sys.platform == "win32":
        try:
            import ctypes
            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [
                    ("dwLength", ctypes.c_ulong),
                    ("dwMemoryLoad", ctypes.c_ulong),
                    ("ullTotalPhys", ctypes.c_ulonglong),
                    ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong),
                    ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong),
                    ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
                ]
            stat = MEMORYSTATUSEX()
            stat.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
            if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat)):
                return round(stat.ullTotalPhys / (1024**3), 2), round(stat.ullAvailPhys / (1024**3), 2)
        except Exception:
            pass

    # Linux fallback via /proc/meminfo
    elif sys.platform.startswith("linux"):
        try:
            total_kb, avail_kb = 0, 0
            with open("/proc/meminfo", "r") as f:
                for line in f:
                    if line.startswith("MemTotal:"):
                        total_kb = int(line.split()[1])
                    elif line.startswith("MemAvailable:"):
                        avail_kb = int(line.split()[1])
            if total_kb > 0:
                return round(total_kb / (1024**2), 2), round(avail_kb / (1024**2), 2)
        except Exception:
            pass

    # Generic fallback
    return 8.0, 4.0


def get_hardware_info() -> dict[str, Any]:
    """Scan and return system hardware capabilities for running local AI/ASR models."""
    total_ram, avail_ram = get_system_ram_gb()
    cpu_cores = os.cpu_count() or 4

    # Check CUDA / GPU
    cuda_available = False
    cuda_device_count = 0
    cuda_device_name = None
    cuda_supported_types: list[str] = []
    cpu_supported_types: list[str] = ["int8", "float32"]

    try:
        import ctranslate2
        cuda_device_count = ctranslate2.get_cuda_device_count()
        cuda_available = cuda_device_count > 0
        if cuda_available:
            cuda_supported_types = sorted(list(ctranslate2.get_supported_compute_types("cuda")))
        cpu_supported_types = sorted(list(ctranslate2.get_supported_compute_types("cpu")))
    except Exception:
        pass

    # Check PyTorch CUDA if available for device name
    if cuda_available:
        try:
            import torch
            if torch.cuda.is_available():
                cuda_device_name = torch.cuda.get_device_name(0)
        except Exception:
            cuda_device_name = f"NVIDIA GPU (Device 0)"

    # Determine recommended configuration
    if cuda_available:
        recommended_device = "cuda"
        recommended_compute_type = "float16" if "float16" in cuda_supported_types else "default"
        recommended_model = "large-v3-turbo"
        reason = "Phát hiện card đồ họa rời NVIDIA hỗ trợ tăng tốc CUDA phần cứng."
    else:
        recommended_device = "cpu"
        recommended_compute_type = "int8" if "int8" in cpu_supported_types else "default"
        if total_ram >= 16.0:
            recommended_model = "small"
            reason = f"Chạy trên CPU {cpu_cores} nhân với {total_ram}GB RAM. Mô hình 'small' cân bằng tối ưu giữa tốc độ và độ chính xác."
        elif total_ram >= 8.0:
            recommended_model = "base"
            reason = f"Chạy trên CPU {cpu_cores} nhân với {total_ram}GB RAM. Mô hình 'base' mượt mà, phản hồi nhanh và tốn ít bộ nhớ."
        else:
            recommended_model = "tiny"
            reason = f"Dung lượng RAM khiêm tốn ({total_ram}GB). Khuyến nghị mô hình 'tiny' để tránh tràn bộ nhớ."

    return {
        "platform": platform.system(),
        "cpu_cores": cpu_cores,
        "ram_total_gb": total_ram,
        "ram_avail_gb": avail_ram,
        "cuda_available": cuda_available,
        "cuda_device_count": cuda_device_count,
        "cuda_device_name": cuda_device_name,
        "cpu_supported_compute_types": cpu_supported_types,
        "cuda_supported_compute_types": cuda_supported_types,
        "recommended_device": recommended_device,
        "recommended_compute_type": recommended_compute_type,
        "recommended_model": recommended_model,
        "recommendation_reason": reason,
    }
