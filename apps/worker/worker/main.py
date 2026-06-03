from __future__ import annotations

import time

from worker.processor import InMemoryDocumentRepository, WorkerProcessor


def run_worker(poll_interval_seconds: int = 5) -> None:
    repository = InMemoryDocumentRepository([])
    processor = WorkerProcessor(repository)

    while True:
        processed = processor.process_once()
        if not processed:
            time.sleep(poll_interval_seconds)


if __name__ == "__main__":
    run_worker()
