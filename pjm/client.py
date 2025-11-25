"""Flexible PJM Data Miner 2 client."""

from __future__ import annotations

import io
import json
import logging
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Iterable

import pandas as pd
import requests

logger = logging.getLogger(__name__)


class PJMDataFetchError(Exception):
    """Raised when PJM Data Miner data cannot be fetched or parsed."""


@dataclass
class _RetryConfig:
    timeout: float = 20.0
    max_retries: int = 3
    backoff_factor: float = 1.0


class PJMDataMinerClient:
    """Client for PJM Data Miner 2 public feeds.

    The client is designed to work with any feed under
    ``https://dataminer2.pjm.com/feed/<feed_name>`` by passing arbitrary
    query parameters. Convenience methods can be layered on top for feed-specific
    behavior (see :meth:`fetch_gen_by_fuel` for an example).
    """

    BASE_URL = "https://dataminer2.pjm.com/feed"

    def __init__(self, retry_config: _RetryConfig | None = None) -> None:
        self._retry_config = retry_config or _RetryConfig()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def fetch_feed(
        self,
        feed_name: str,
        params: dict[str, str] | None = None,
        output_format: str = "dataframe",
    ) -> pd.DataFrame | list[dict[str, Any]] | str:
        """Fetch a generic PJM feed.

        Args:
            feed_name: Name of the Data Miner 2 feed, appended to ``BASE_URL``.
            params: Optional query parameters passed directly to the request.
            output_format: One of ``"dataframe"``, ``"json"``, ``"csv"``.

        Returns:
            Parsed feed data in the requested format.

        Raises:
            ValueError: If ``output_format`` is invalid.
            PJMDataFetchError: On network or parsing errors.
        """

        response = self._get(feed_name, params=params)
        df = self._parse_response(response)
        df = self._normalize_columns(df)
        df = self._parse_timestamps(df)

        return self._format_output(df, output_format)

    def fetch_gen_by_fuel(
        self,
        start: str | datetime | None = None,
        end: str | datetime | None = None,
        row_count: int | None = None,
        output_format: str = "dataframe",
    ) -> pd.DataFrame | list[dict[str, Any]] | str:
        """Fetch generation by fuel type with normalized columns.

        Args:
            start: Optional start datetime (string or ``datetime``).
            end: Optional end datetime (string or ``datetime``).
            row_count: Optional maximum rows to return.
            output_format: One of ``"dataframe"``, ``"json"``, ``"csv"``.

        Returns:
            Feed data with normalized column names.

        Raises:
            ValueError: If the date range is invalid or ``output_format`` is unknown.
            PJMDataFetchError: On network or parsing errors.
        """

        params: dict[str, str] = {}

        if start is not None:
            params["start"] = self._coerce_datetime(start)
        if end is not None:
            params["end"] = self._coerce_datetime(end)
        if row_count is not None:
            params["rowCount"] = str(row_count)

        if "start" in params and "end" in params:
            start_ts = pd.to_datetime(params["start"])
            end_ts = pd.to_datetime(params["end"])
            if end_ts < start_ts:
                raise ValueError("end must be greater than or equal to start")

        df = self.fetch_feed("gen_by_fuel", params=params, output_format="dataframe")
        normalized_df = self._normalize_gen_by_fuel(df)
        return self._format_output(normalized_df, output_format)

    # ------------------------------------------------------------------
    # HTTP helpers
    # ------------------------------------------------------------------
    def _get(
        self,
        feed_name: str,
        params: dict[str, str] | None = None,
        timeout: float | None = None,
        max_retries: int | None = None,
    ) -> requests.Response:
        """Perform a GET request with simple retry logic."""

        retry_config = self._retry_config
        timeout = retry_config.timeout if timeout is None else timeout
        max_retries = retry_config.max_retries if max_retries is None else max_retries

        url = f"{self.BASE_URL}/{feed_name}"

        last_exc: Exception | None = None
        for attempt in range(max_retries):
            try:
                response = requests.get(url, params=params, timeout=timeout)
                if response.status_code >= 400:
                    raise PJMDataFetchError(
                        f"HTTP {response.status_code} from PJM for feed '{feed_name}'",
                    )
                if 500 <= response.status_code < 600:
                    raise PJMDataFetchError(
                        f"Server error {response.status_code} from PJM",
                    )
                return response
            except (requests.RequestException, PJMDataFetchError) as exc:  # pragma: no cover - retry path
                last_exc = exc
                sleep_time = retry_config.backoff_factor * (2**attempt)
                logger.warning("Request failed (attempt %s/%s): %s", attempt + 1, max_retries, exc)
                if attempt == max_retries - 1:
                    break
                time.sleep(sleep_time or 1.0)

        raise PJMDataFetchError(f"Failed to fetch feed '{feed_name}'") from last_exc

    # ------------------------------------------------------------------
    # Parsing helpers
    # ------------------------------------------------------------------
    def _parse_response(self, response: requests.Response) -> pd.DataFrame:
        """Convert a PJM response to a DataFrame."""

        content_type = response.headers.get("Content-Type", "").lower()
        text = response.text

        try:
            if "csv" in content_type or self._looks_like_csv(text):
                return self._parse_csv(text)
            return self._parse_json(text)
        except Exception as exc:  # pragma: no cover - defensive guard
            raise PJMDataFetchError("Unable to parse PJM response") from exc

    def _parse_csv(self, text: str) -> pd.DataFrame:
        return pd.read_csv(io.StringIO(text))

    def _parse_json(self, text: str) -> pd.DataFrame:
        data = json.loads(text)
        if isinstance(data, dict):
            # Some PJM feeds wrap data under a "items" or similar key.
            records = next((value for value in data.values() if isinstance(value, list)), [])
        elif isinstance(data, list):
            records = data
        else:
            records = []
        return pd.DataFrame.from_records(records)

    @staticmethod
    def _looks_like_csv(text: str) -> bool:
        sample = text.strip().splitlines()[:3]
        if not sample:
            return False
        delimiter_counts = [line.count(",") for line in sample]
        return any(count > 0 for count in delimiter_counts)

    def _format_output(
        self,
        df: pd.DataFrame,
        output_format: str,
    ) -> pd.DataFrame | list[dict[str, Any]] | str:
        if output_format == "dataframe":
            return df
        if output_format == "json":
            return df.to_dict(orient="records")
        if output_format == "csv":
            return df.to_csv(index=False)
        raise ValueError(f"Unknown output_format: {output_format}")

    # ------------------------------------------------------------------
    # Normalization helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _snake_case(name: str) -> str:
        cleaned: list[str] = []
        for char in name:
            if char.isupper():
                cleaned.append("_" + char.lower())
            elif char in {" ", "-"}:
                cleaned.append("_")
            else:
                cleaned.append(char)
        return "".join(cleaned).strip("_")

    def _normalize_columns(self, df: pd.DataFrame, columns: Iterable[str] | None = None) -> pd.DataFrame:
        columns = columns or df.columns
        rename_map = {col: self._snake_case(str(col)) for col in columns}
        return df.rename(columns=rename_map)

    def _parse_timestamps(self, df: pd.DataFrame) -> pd.DataFrame:
        timestamp_columns = [col for col in df.columns if any(key in col for key in ["date", "time", "timestamp"])]
        for col in timestamp_columns:
            parsed = pd.to_datetime(df[col], errors="coerce")
            if not parsed.isna().all():
                df[col] = parsed
        return df

    def _normalize_gen_by_fuel(self, df: pd.DataFrame) -> pd.DataFrame:
        normalized = self._normalize_columns(df)

        column_map = {
            "datetime_beginning_utc": "timestamp",
            "datetime_beginning_ept": "timestamp_ept",
            "fueltype": "fuel_type",
            "mw": "mw",
        }

        for original, target in column_map.items():
            if original in normalized.columns:
                normalized = normalized.rename(columns={original: target})

        if "timestamp" in normalized.columns:
            normalized["timestamp"] = pd.to_datetime(normalized["timestamp"], errors="coerce")

        return normalized

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------
    def _coerce_datetime(self, value: str | datetime) -> str:
        if isinstance(value, datetime):
            return value.isoformat()
        # Assume already ISO-like; additional validation can be added here.
        return str(value)

    def __repr__(self) -> str:  # pragma: no cover - convenience
        return f"PJMDataMinerClient(base_url={self.BASE_URL!r})"


# ----------------------------------------------------------------------
# Extensibility notes
# ----------------------------------------------------------------------
# To add a new convenience method for another feed, follow the pattern of
# fetch_gen_by_fuel:
#   1. Accept feed-specific parameters and convert them to strings.
#   2. Call fetch_feed with the appropriate feed name.
#   3. Apply any normalization specific to that feed's schema.
# The underlying fetch_feed method and _get HTTP helper are feed-agnostic.
