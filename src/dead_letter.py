import json
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger("DLQ")

DLQ_ALERT_THRESHOLD = 3


class DeadLetterQueue:
    

    def __init__(self, path: str) -> None:
        self._path = Path(path)
        self._lock = threading.RLock()
        self._data: dict[str, dict] = self._load()


    def _load(self) -> dict[str, dict]:
        """Load existing DLQ state from disk, or return empty dict."""
        if self._path.is_file():
            try:
                raw = self._path.read_text(encoding="utf-8")
                return json.loads(raw)
            except (json.JSONDecodeError, OSError) as exc:
                logger.warning("DLQ file unreadable (%s), starting fresh: %s", self._path, exc)
        return {}

    def _flush(self) -> None:
        """Write current state to disk atomically."""
        self._path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._data, indent=2), encoding="utf-8")
        tmp.replace(self._path) 


    def increment(self, invoice_id: str, error: str = "") -> int:

        now = datetime.now(tz=timezone.utc).isoformat()

        with self._lock:
            entry = self._data.get(invoice_id, {
                "consecutive_failures": 0,
                "last_error": "",
                "first_failure": now,
                "last_failure": now,
            })
            entry["consecutive_failures"] = entry.get("consecutive_failures", 0) + 1
            entry["last_error"] = error
            entry["last_failure"] = now
            # Preserve first_failure if it already exists
            if "first_failure" not in entry:
                entry["first_failure"] = now
            self._data[invoice_id] = entry
            self._flush()

        return entry["consecutive_failures"]

    def reset(self, invoice_id: str) -> None:
        """
        Remove *invoice_id* from the DLQ after a successful run.

        Safe to call even if the invoice is not in the queue.
        """
        with self._lock:
            if invoice_id in self._data:
                del self._data[invoice_id]
                self._flush()

    def get(self, invoice_id: str) -> dict | None:
        """Return the DLQ entry for *invoice_id*, or ``None``."""
        with self._lock:
            return self._data.get(invoice_id)

    def get_failure_count(self, invoice_id: str) -> int:
        """Return the consecutive failure count (0 if not in DLQ)."""
        with self._lock:
            entry = self._data.get(invoice_id)
            return entry["consecutive_failures"] if entry else 0

    def get_all(self) -> dict[str, dict]:
        """Return a snapshot of all DLQ entries (safe to mutate)."""
        with self._lock:
            return dict(self._data)

    def __len__(self) -> int:
        with self._lock:
            return len(self._data)

    def __contains__(self, invoice_id: str) -> bool:
        with self._lock:
            return invoice_id in self._data
