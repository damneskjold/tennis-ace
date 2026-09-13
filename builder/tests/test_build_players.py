"""Offline sanity check for build_players.py against a tiny synthetic fixture.

Not real ATP data -- just enough to prove the CSV parsing, aggregation,
return-stat mirroring, tie-break/decider detection, shrinkage and
normalization math run end to end and produce plausible numbers.

Run with: python builder/tests/test_build_players.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from build_players import SHRINKAGE_MATCHES, apply_shrinkage, build  # noqa: E402

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


def test_shrinkage() -> None:
    """Thin rates get pulled toward the pool's own rate; fat ones barely move."""
    players = [
        {"stats": {"tiebreaks_won_pct": 100.0}, "samples": {"tiebreaks_won_pct": 10}},
        {"stats": {"tiebreaks_won_pct": 50.0}, "samples": {"tiebreaks_won_pct": 20}},
        {"stats": {"tiebreaks_won_pct": None}, "samples": {"tiebreaks_won_pct": 0}},
    ]
    # Every other small-sample stat is absent from this pool, so each must be
    # left alone rather than invented as a 0.
    for p in players:
        for stat in ("slow_win_pct", "fast_win_pct", "deciding_set_won_pct", "comeback_win_pct"):
            p["stats"][stat] = None
            p["samples"][stat] = 0

    apply_shrinkage(players)

    # Pooled rate: (100*10 + 50*20) / 30 = 66.67
    prior = round((100 * 10 + 50 * 20) / 30, 2)
    assert players[2]["stats"]["tiebreaks_won_pct"] == prior, "no sample must land exactly on the pool rate"

    a = players[0]["stats"]["tiebreaks_won_pct"]
    assert prior < a < 100.0, f"a 10-sample 100% should sit between pool and raw, got {a}"
    expected_a = round((10 * 100.0 + SHRINKAGE_MATCHES * (100 * 10 + 50 * 20) / 30) / (10 + SHRINKAGE_MATCHES), 2)
    assert a == expected_a, f"{a} != {expected_a}"

    assert players[0]["stats"]["slow_win_pct"] is None, "a stat nobody has must stay unknown, not become 0"


def test_build_end_to_end() -> None:
    result = build(years=[2021], top_n=2, cache_dir=FIXTURES_DIR, min_matches=1)

    assert result["meta"]["player_count"] == 2, result["meta"]
    by_name = {p["name"]: p for p in result["players"]}
    a, b = by_name["Test PlayerA"], by_name["Test PlayerB"]

    for p in result["players"]:
        for key, value in p["stats"].items():
            assert value is None or 0 <= value <= 100, f"{p['name']} {key}={value} out of range"

    # Serve and return rates rest on hundreds of points, so they aren't shrunk
    # and stay exactly what the box scores say.
    assert a["stats"]["ace_pct"] == 11.43, a["stats"]
    assert a["stats"]["service_games_won_pct"] == 91.67, a["stats"]
    assert b["stats"]["return_games_won_pct"] == 12.0, b["stats"]

    # Sample sizes are what shrinkage keys off, so they have to be right:
    # PlayerA played one tiebreak, PlayerB two matches' worth of deciders.
    assert a["samples"]["tiebreaks_won_pct"] == 1, a["samples"]
    assert b["samples"]["deciding_set_won_pct"] == 1, b["samples"]

    # Surfaces: the fixture is all hard court, so the fast card has a sample
    # and the slow one has none at all.
    assert a["samples"]["fast_win_pct"] > 0, a["samples"]
    assert a["samples"]["slow_win_pct"] == 0, a["samples"]

    for key in result["stat_keys"]:
        assert key in result["stat_stddev"]
        assert result["stat_stddev"][key] >= 0

    gp = result["gap_percentiles"]
    assert 0 <= gp["p25"] <= gp["p50"] <= gp["p75"], gp


def main() -> int:
    test_shrinkage()
    test_build_end_to_end()
    print("OK -- build_players.py fixture tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
