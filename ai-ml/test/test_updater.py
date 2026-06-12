"""
Dedicated smoke test for Step 7 — CSV Updater (src/updater.py).
Run with: python test_updater.py

Tests all behaviours specified in the implementation plan:
  - Locates row by invoice_no and increments followup_count by 1
  - Sets last_followup_date to today's date
  - Returns the mutated DataFrame (in-place + return)
  - Does NOT call save_invoices() internally
  - Raises ValueError for unknown invoice_no
  - Full round-trip: load -> update -> save -> reload passes without data loss
"""

import os
import shutil
import tempfile
from datetime import date

import pandas as pd

from src.config import DATA_PATH
from src.data_loader import load_invoices, save_invoices
from src.updater import update_followup

TODAY = date.today().isoformat()
print("=== STEP 7 - CSV UPDATER TESTS ===\n")
print(f"    Today's date: {TODAY}\n")

# Work on a temp copy for all tests — never touch the real CSV
tmp_path = tempfile.mktemp(suffix=".csv")
shutil.copy(DATA_PATH, tmp_path)


def fresh_df() -> pd.DataFrame:
    """Reload a clean copy from the temp CSV each time."""
    return load_invoices(tmp_path)


# ── Test 1: followup_count incremented by exactly 1 ─────────────────────────
print("[1] followup_count incremented by 1")
df = fresh_df()
target = df[df["payment_status"] == "Pending"].iloc[0]["invoice_no"]
before = int(df.loc[df["invoice_no"] == target, "followup_count"].iloc[0])

returned_df = update_followup(target, df)

after = int(returned_df.loc[returned_df["invoice_no"] == target, "followup_count"].iloc[0])
assert after == before + 1, f"followup_count not incremented: {before} -> {after}"
print(f"    PASS  {target}: followup_count {before} -> {after}")
print()

# ── Test 2: last_followup_date set to today ───────────────────────────────────
print("[2] last_followup_date set to today")
after_date = str(returned_df.loc[returned_df["invoice_no"] == target, "last_followup_date"].iloc[0])[:10]
assert after_date == TODAY, f"Expected {TODAY}, got {after_date}"
print(f"    PASS  last_followup_date = {after_date}")
print()

# ── Test 3: returns the same DataFrame object (mutates in-place) ──────────────
print("[3] Returns the same DataFrame object (in-place mutation)")
df2 = fresh_df()
returned = update_followup(target, df2)
assert returned is df2, "update_followup should return the same DataFrame object"
print("    PASS  Returned object is the same DataFrame (id match)")
print()

# ── Test 4: only the targeted row is modified ─────────────────────────────────
print("[4] Only the targeted invoice row is modified — others unchanged")
df3 = fresh_df()
snapshot_before = df3[["invoice_no", "followup_count", "last_followup_date"]].copy()
update_followup(target, df3)

for _, row in df3.iterrows():
    if row["invoice_no"] == target:
        continue   # skip the modified row
    orig = snapshot_before.loc[snapshot_before["invoice_no"] == row["invoice_no"]]
    assert int(orig["followup_count"].iloc[0]) == int(row["followup_count"]), (
        f"followup_count changed for unrelated invoice {row['invoice_no']}"
    )
print("    PASS  No other invoice rows were modified")
print()

# ── Test 5: ValueError for unknown invoice_no ─────────────────────────────────
print("[5] ValueError raised for unknown invoice_no")
df4 = fresh_df()
try:
    update_followup("INV-DOES-NOT-EXIST", df4)
    print("    FAIL  No error raised for unknown invoice")
    raise SystemExit(1)
except ValueError as e:
    print(f"    PASS  ValueError raised: {e}")
print()

# ── Test 6: save_invoices NOT called internally ───────────────────────────────
print("[6] update_followup does NOT call save_invoices() internally")
from unittest.mock import patch
import src.updater as updater_module

df5 = fresh_df()
with patch("src.data_loader.save_invoices") as mock_save:
    update_followup(target, df5)
    assert mock_save.call_count == 0, "save_invoices should NOT be called by update_followup"
print("    PASS  save_invoices not called by update_followup")
print()

# ── Test 7: FULL ROUND-TRIP — load -> update -> save -> reload ────────────────
print("[7] Full round-trip: load -> update -> save -> reload")
rt_tmp = tempfile.mktemp(suffix=".csv")
shutil.copy(DATA_PATH, rt_tmp)

# Load
rt_df = load_invoices(rt_tmp)
invoice_no = rt_df[rt_df["payment_status"] == "Pending"].iloc[1]["invoice_no"]
before_count = int(rt_df.loc[rt_df["invoice_no"] == invoice_no, "followup_count"].iloc[0])

# Update in-memory
update_followup(invoice_no, rt_df)

# Save to disk
save_invoices(rt_df, rt_tmp)

# Reload from disk
rt_df2 = load_invoices(rt_tmp)

# Verify
after_count = int(rt_df2.loc[rt_df2["invoice_no"] == invoice_no, "followup_count"].iloc[0])
after_date_rt = str(rt_df2.loc[rt_df2["invoice_no"] == invoice_no, "last_followup_date"].iloc[0])[:10]
total_rows = len(rt_df2)

assert after_count == before_count + 1, f"Count wrong after round-trip: {before_count} -> {after_count}"
assert after_date_rt == TODAY, f"Date wrong after round-trip: {after_date_rt}"
assert total_rows == 9, f"Row count changed after round-trip: {total_rows}"
assert list(rt_df2.columns) == list(rt_df.columns), "Column order changed after round-trip"

os.unlink(rt_tmp)
os.unlink(tmp_path)

print(f"    PASS  followup_count: {before_count} -> {after_count} (persisted)")
print(f"    PASS  last_followup_date = {after_date_rt} (persisted)")
print(f"    PASS  Total rows preserved: {total_rows}")
print(f"    PASS  Column order preserved after save/reload")
print()

print("ALL CSV UPDATER CHECKS PASSED.")
