"""Spreadsheet exports that can't be turned into formulas.

A patient who types "=HYPERLINK(...)" as their name would otherwise become a live
formula when staff open the export in Excel. Text starting with = + - @ (or a tab or
carriage return) gets a leading apostrophe so Excel shows it as plain text."""
import csv

_TRIGGERS = ("=", "+", "-", "@", "\t", "\r")


def safe_cell(value):
    if isinstance(value, str) and value.startswith(_TRIGGERS):
        return "'" + value
    return value


def safe_row(row):
    return [safe_cell(v) for v in row]


class _SafeCsvWriter:
    def __init__(self, f, **kw):
        self._w = csv.writer(f, **kw)

    def writerow(self, row):
        return self._w.writerow(safe_row(row))

    def writerows(self, rows):
        return self._w.writerows(safe_row(r) for r in rows)


def csv_writer(f, **kw):
    return _SafeCsvWriter(f, **kw)


class SafeSheet:
    """Wraps an openpyxl worksheet; append() writes safe cells, everything else passes through."""

    def __init__(self, ws):
        object.__setattr__(self, "_ws", ws)

    def append(self, row):
        return self._ws.append(safe_row(row))

    def __getattr__(self, name):
        return getattr(self._ws, name)

    def __setattr__(self, name, value):
        setattr(self._ws, name, value)
