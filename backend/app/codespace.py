import os
import re
import difflib
from typing import List, Dict, Any, Optional

CODESPACE_ROOT = os.environ.get(
    "CODESPACE_ROOT",
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

IGNORED_DIRS = frozenset({
    "node_modules", "__pycache__", ".git", "venv", ".venv",
    "dist", "build", ".next", ".cache", "coverage", "target",
    "spacetimedb_data", ".idea", ".vscode", ".mypy_cache",
    "htmlcov", "eggs", ".eggs",
})
IGNORED_FILES = frozenset({".DS_Store", "Thumbs.db"})
IGNORED_EXTENSIONS = frozenset({".pyc", ".pyo", ".log", ".sock", ".pid", ".wasm", ".bin"})
MAX_FILE_BYTES = 500_000

_FENCE_RE = re.compile(
    r"^```[\w]*\n(.*?)^```\s*$",
    re.MULTILINE | re.DOTALL
)


def strip_code_fences(text: str) -> str:
    """Remove markdown code fences from LLM output, keeping only the inner code.
    If multiple fenced blocks exist, keeps the largest one (most likely the full file).
    Falls back to the original text if no fences found."""
    matches = _FENCE_RE.findall(text)
    if not matches:
        return text.strip()
    # Return the largest block — that's the full file, not a snippet
    return max(matches, key=len).strip()


def safe_resolve(rel_path: str) -> Optional[str]:
    """Resolve a relative path within CODESPACE_ROOT; return None if traversal attempt."""
    if not rel_path:
        return CODESPACE_ROOT
    joined = os.path.realpath(os.path.join(CODESPACE_ROOT, rel_path.lstrip("/")))
    root = os.path.realpath(CODESPACE_ROOT)
    if not (joined == root or joined.startswith(root + os.sep)):
        return None
    return joined


def get_file_tree(sub: str = "", max_depth: int = 5) -> List[Dict]:
    base = safe_resolve(sub)
    if not base or not os.path.isdir(base):
        return []

    def walk(path: str, rel: str, depth: int) -> List[Dict]:
        if depth > max_depth:
            return []
        try:
            entries = sorted(os.scandir(path), key=lambda e: (not e.is_dir(), e.name.lower()))
        except PermissionError:
            return []

        nodes = []
        for entry in entries:
            name = entry.name
            if name.startswith(".") and name not in {".env", ".env.example", ".gitignore"}:
                continue
            if name in IGNORED_FILES:
                continue
            _, ext = os.path.splitext(name)
            if ext in IGNORED_EXTENSIONS:
                continue

            node_rel = f"{rel}/{name}" if rel else name

            if entry.is_dir(follow_symlinks=False):
                if name in IGNORED_DIRS:
                    continue
                children = walk(entry.path, node_rel, depth + 1)
                nodes.append({"name": name, "path": node_rel, "type": "directory", "children": children})
            else:
                nodes.append({"name": name, "path": node_rel, "type": "file"})

        return nodes

    return walk(base, sub.strip("/"), 0)


def read_file(rel_path: str) -> Dict[str, Any]:
    abs_path = safe_resolve(rel_path)
    if abs_path is None:
        return {"error": "Access denied — path traversal attempt"}
    if not os.path.isfile(abs_path):
        return {"error": f"File not found: {rel_path}"}

    size = os.path.getsize(abs_path)
    if size > MAX_FILE_BYTES:
        return {"error": f"File too large ({size} bytes, max {MAX_FILE_BYTES})"}

    try:
        with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        return {"path": rel_path, "content": content, "size": size}
    except Exception as e:
        return {"error": str(e)}


def write_file(rel_path: str, content: str) -> Dict[str, Any]:
    abs_path = safe_resolve(rel_path)
    if abs_path is None:
        return {"error": "Access denied — path traversal attempt"}

    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    try:
        with open(abs_path, "w", encoding="utf-8") as f:
            f.write(content)
        return {"path": rel_path, "size": len(content.encode("utf-8")), "ok": True}
    except Exception as e:
        return {"error": str(e)}


def compute_diff(original: str, modified: str) -> List[Dict]:
    """Return structured diff lines using SequenceMatcher."""
    orig_lines = original.splitlines(keepends=True)
    mod_lines = modified.splitlines(keepends=True)

    matcher = difflib.SequenceMatcher(None, orig_lines, mod_lines, autojunk=False)
    result: List[Dict] = []

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for k, (ol, ml) in enumerate(zip(orig_lines[i1:i2], mod_lines[j1:j2])):
                result.append({
                    "type": "context",
                    "orig_no": i1 + k + 1,
                    "mod_no": j1 + k + 1,
                    "content": ol.rstrip("\n"),
                })
        elif tag in ("replace", "delete"):
            for k, ol in enumerate(orig_lines[i1:i2]):
                result.append({
                    "type": "removed",
                    "orig_no": i1 + k + 1,
                    "mod_no": None,
                    "content": ol.rstrip("\n"),
                })
            if tag == "replace":
                for k, ml in enumerate(mod_lines[j1:j2]):
                    result.append({
                        "type": "added",
                        "orig_no": None,
                        "mod_no": j1 + k + 1,
                        "content": ml.rstrip("\n"),
                    })
        elif tag == "insert":
            for k, ml in enumerate(mod_lines[j1:j2]):
                result.append({
                    "type": "added",
                    "orig_no": None,
                    "mod_no": j1 + k + 1,
                    "content": ml.rstrip("\n"),
                })

    return result
