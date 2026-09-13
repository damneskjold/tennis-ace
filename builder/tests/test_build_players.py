"""Offline sanity check for build_players.py against a tiny synthetic fixture.

Not real ATP data -- just enough to prove the CSV parsing, aggregation,
return-stat mirroring, tie-break/decider detection, and normalization
math run end to end without exceptions and produce plausible numbers.

Run with: python builder/tests/test_build_players.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from build_players import build  # noqa: E402

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


def main() -> int:
    result = build(years=[2021], top_n=2, cache_dir=FIXTURES_DIR, min_matches=1)

    assert result["meta"]["player_count"] == 2, result["meta"]
    by_name = {p["name"]: p for p in result["players"]}
    assert "Test PlayerA" in by_name
    assert "Test PlayerB" in by_name

    for p in result["players"]:
        for key, value in p["stats"].items():
            assert value is None or 0 <= value <= 100, f"{p['name']} {key}={value} out of range"

    a, b = by_name["Test PlayerA"], by_name["Test PlayerB"]

    # PlayerA won the only match it played, 7-6(4) 6-3: one tiebreak, played, won.
    assert a["stats"]["tiebreaks_won_pct"] == 100.0, a["stats"]
    # PlayerB lost that tiebreak, and separately reached (and won) a 3-set decider vs PlayerC.
    assert b["stats"]["tiebreaks_won_pct"] == 0.0, b["stats"]
    assert b["stats"]["deciding_set_won_pct"] == 100.0, b["stats"]
    # PlayerA never reached a decider (won in straight sets).
    assert a["stats"]["deciding_set_won_pct"] is None, a["stats"]

    for key in result["stat_keys"]:
        assert key in result["stat_stddev"]
        assert result["stat_stddev"][key] >= 0

    gp = result["gap_percentiles"]
    assert 0 <= gp["p25"] <= gp["p50"] <= gp["p75"], gp

    print("OK -- build_players.py fixture test passed")
    print(f"  PlayerA stats: {a['stats']}")
    print(f"  PlayerB stats: {b['stats']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
