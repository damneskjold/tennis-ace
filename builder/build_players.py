#!/usr/bin/env python3
"""Builds data/players.json from Jeff Sackmann's tennis_atp CSV dataset.

For each of the requested seasons, takes the ATP year-end Top N players and
aggregates their serve/return/clutch statistics from that season's matches
into a single "player-year card". Also computes, once over the whole pool,
the standard deviation of each statistic — the game engine needs it to
normalize deltas before comparing categories of very different natural
variance (see docs/PROJECT_BRIEF.md).

Usage:
    python builder/build_players.py --years 2021 2022 2023 2024 2025 \
        --top-n 10 --cache-dir .cache --out data/players.json

Source files are downloaded once into --cache-dir and reused on later runs.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import statistics
import sys
import urllib.request
from pathlib import Path

RAW_BASE = "https://raw.githubusercontent.com/JeffSackmann/tennis_atp/master"
INCOMPLETE_MARKERS = ("RET", "W/O", "WEA", "DEF", "ABN")

STAT_KEYS = [
    "ace_pct",
    "first_in_pct",
    "first_won_pct",
    "second_won_pct",
    "bp_saved_pct",
    "service_games_won_pct",
    "return_first_won_pct",
    "return_second_won_pct",
    "bp_converted_pct",
    "return_games_won_pct",
    "tiebreaks_won_pct",
    "deciding_set_won_pct",
]

NUMERIC_MATCH_FIELDS = [
    "w_ace", "w_svpt", "w_1stIn", "w_1stWon", "w_2ndWon", "w_SvGms", "w_bpSaved", "w_bpFaced",
    "l_ace", "l_svpt", "l_1stIn", "l_1stWon", "l_2ndWon", "l_SvGms", "l_bpSaved", "l_bpFaced",
]


def fetch(url: str, cache_path: Path) -> str:
    if cache_path.exists():
        return cache_path.read_text(encoding="utf-8")
    with urllib.request.urlopen(url, timeout=60) as resp:
        text = resp.read().decode("utf-8")
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(text, encoding="utf-8")
    return text


def load_csv_rows(text: str) -> list[dict]:
    return list(csv.DictReader(io.StringIO(text)))


def year_end_top_n(rankings_rows: list[dict], year: int, top_n: int) -> list[str]:
    """Player IDs ranked 1..top_n as of the last ranking date on or before Dec 31 of `year`."""
    cutoff = f"{year}1231"
    dates_in_year = sorted(
        {r["ranking_date"] for r in rankings_rows if r["ranking_date"] <= cutoff and r["ranking_date"].startswith(str(year))}
    )
    if not dates_in_year:
        raise ValueError(f"No ranking dates found for {year}")
    last_date = dates_in_year[-1]
    rows = [r for r in rankings_rows if r["ranking_date"] == last_date]
    rows.sort(key=lambda r: int(r["rank"]))
    return [r["player"] for r in rows[:top_n]]


def new_agg() -> dict:
    return {
        "ace": 0, "svpt": 0, "first_in": 0, "first_won": 0, "second_won": 0,
        "svgms": 0, "bp_saved": 0, "bp_faced": 0,
        "opp_svpt": 0, "opp_first_in": 0, "opp_first_won": 0, "opp_second_won": 0,
        "opp_svgms": 0, "opp_bp_saved": 0, "opp_bp_faced": 0,
        "tb_played": 0, "tb_won": 0,
        "decider_played": 0, "decider_won": 0,
        "matches": 0,
    }


def has_all_numeric(row: dict, fields: list[str]) -> bool:
    return all(row.get(f) not in (None, "") for f in fields)


def add_serve_stats(agg: dict, row: dict, prefix: str) -> None:
    agg["ace"] += int(row[f"{prefix}_ace"])
    agg["svpt"] += int(row[f"{prefix}_svpt"])
    agg["first_in"] += int(row[f"{prefix}_1stIn"])
    agg["first_won"] += int(row[f"{prefix}_1stWon"])
    agg["second_won"] += int(row[f"{prefix}_2ndWon"])
    agg["svgms"] += int(row[f"{prefix}_SvGms"])
    agg["bp_saved"] += int(row[f"{prefix}_bpSaved"])
    agg["bp_faced"] += int(row[f"{prefix}_bpFaced"])


def add_opponent_serve_stats(agg: dict, row: dict, opp_prefix: str) -> None:
    agg["opp_svpt"] += int(row[f"{opp_prefix}_svpt"])
    agg["opp_first_in"] += int(row[f"{opp_prefix}_1stIn"])
    agg["opp_first_won"] += int(row[f"{opp_prefix}_1stWon"])
    agg["opp_second_won"] += int(row[f"{opp_prefix}_2ndWon"])
    agg["opp_svgms"] += int(row[f"{opp_prefix}_SvGms"])
    agg["opp_bp_saved"] += int(row[f"{opp_prefix}_bpSaved"])
    agg["opp_bp_faced"] += int(row[f"{opp_prefix}_bpFaced"])


def parse_sets(score: str) -> list[tuple[int, int, bool]]:
    """Returns (winner_games, loser_games, was_tiebreak) for each completed set."""
    sets = []
    for token in score.split():
        token = token.strip()
        if not token or "-" not in token:
            continue
        was_tb = "(" in token
        core = token.split("(")[0]
        try:
            w_games, l_games = (int(x) for x in core.split("-"))
        except ValueError:
            continue
        sets.append((w_games, l_games, was_tb))
    return sets


def add_clutch_stats(agg_winner: dict, agg_loser: dict, row: dict) -> None:
    score = row.get("score", "") or ""
    if any(marker in score for marker in INCOMPLETE_MARKERS):
        return
    sets = parse_sets(score)
    if not sets:
        return

    for w_games, l_games, was_tb in sets:
        if was_tb:
            agg_winner["tb_played"] += 1
            agg_loser["tb_played"] += 1
            if w_games > l_games:
                agg_winner["tb_won"] += 1
            else:
                agg_loser["tb_won"] += 1

    try:
        best_of = int(row["best_of"])
    except (KeyError, ValueError):
        return
    if len(sets) == best_of:
        agg_winner["decider_played"] += 1
        agg_winner["decider_won"] += 1
        agg_loser["decider_played"] += 1


def aggregate_year(matches_rows: list[dict], player_ids: set[str], id_to_name: dict) -> dict[str, dict]:
    aggs: dict[str, dict] = {pid: new_agg() for pid in player_ids}

    for row in matches_rows:
        wid, lid = row.get("winner_id"), row.get("loser_id")
        if wid in id_to_name:
            pass
        else:
            id_to_name[wid] = row.get("winner_name", "")
        if lid not in id_to_name:
            id_to_name[lid] = row.get("loser_name", "")

        w_in, l_in = wid in aggs, lid in aggs
        if not w_in and not l_in:
            continue
        if not has_all_numeric(row, NUMERIC_MATCH_FIELDS):
            continue

        if w_in:
            add_serve_stats(aggs[wid], row, "w")
            add_opponent_serve_stats(aggs[wid], row, "l")
            aggs[wid]["matches"] += 1
        if l_in:
            add_serve_stats(aggs[lid], row, "l")
            add_opponent_serve_stats(aggs[lid], row, "w")
            aggs[lid]["matches"] += 1
        if w_in or l_in:
            add_clutch_stats(
                aggs.get(wid, new_agg()),
                aggs.get(lid, new_agg()),
                row,
            )

    return aggs


def pct(numerator: int, denominator: int) -> float | None:
    if denominator <= 0:
        return None
    return round(100 * numerator / denominator, 2)


def compute_stats(agg: dict) -> dict[str, float | None]:
    breaks_against = agg["bp_faced"] - agg["bp_saved"]
    breaks_achieved = agg["opp_bp_faced"] - agg["opp_bp_saved"]
    return {
        "ace_pct": pct(agg["ace"], agg["svpt"]),
        "first_in_pct": pct(agg["first_in"], agg["svpt"]),
        "first_won_pct": pct(agg["first_won"], agg["first_in"]),
        "second_won_pct": pct(agg["second_won"], agg["svpt"] - agg["first_in"]),
        "bp_saved_pct": pct(agg["bp_saved"], agg["bp_faced"]),
        "service_games_won_pct": pct(agg["svgms"] - breaks_against, agg["svgms"]),
        "return_first_won_pct": pct(agg["opp_first_in"] - agg["opp_first_won"], agg["opp_first_in"]),
        "return_second_won_pct": pct(
            agg["opp_svpt"] - agg["opp_first_in"] - agg["opp_second_won"],
            agg["opp_svpt"] - agg["opp_first_in"],
        ),
        "bp_converted_pct": pct(breaks_achieved, agg["opp_bp_faced"]),
        "return_games_won_pct": pct(breaks_achieved, agg["opp_svgms"]),
        "tiebreaks_won_pct": pct(agg["tb_won"], agg["tb_played"]),
        "deciding_set_won_pct": pct(agg["decider_won"], agg["decider_played"]),
    }


def build(years: list[int], top_n: int, cache_dir: Path) -> dict:
    rankings_text = fetch(f"{RAW_BASE}/atp_rankings_20s.csv", cache_dir / "atp_rankings_20s.csv")
    rankings_rows = load_csv_rows(rankings_text)

    id_to_name: dict[str, str] = {}
    players = []

    for year in years:
        matches_text = fetch(f"{RAW_BASE}/atp_matches_{year}.csv", cache_dir / f"atp_matches_{year}.csv")
        matches_rows = load_csv_rows(matches_text)

        top_ids = set(year_end_top_n(rankings_rows, year, top_n))
        aggs = aggregate_year(matches_rows, top_ids, id_to_name)

        for pid, agg in aggs.items():
            if agg["matches"] == 0:
                print(f"warning: no matches found for player_id={pid} name={id_to_name.get(pid)} year={year}", file=sys.stderr)
                continue
            players.append({
                "id": f"{pid}-{year}",
                "player_id": pid,
                "name": id_to_name.get(pid, pid),
                "year": year,
                "matches_played": agg["matches"],
                "stats": compute_stats(agg),
            })

    stat_values: dict[str, list[float]] = {k: [] for k in STAT_KEYS}
    for p in players:
        for k, v in p["stats"].items():
            if v is not None:
                stat_values[k].append(v)

    stat_stddev = {k: round(statistics.pstdev(v), 4) if len(v) > 1 else 0.0 for k, v in stat_values.items()}
    stat_mean = {k: round(statistics.fmean(v), 4) if v else 0.0 for k, v in stat_values.items()}

    return {
        "meta": {
            "source": "https://github.com/JeffSackmann/tennis_atp",
            "years": years,
            "top_n": top_n,
            "player_count": len(players),
        },
        "stat_keys": STAT_KEYS,
        "stat_mean": stat_mean,
        "stat_stddev": stat_stddev,
        "players": players,
    }


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--years", type=int, nargs="+", default=[2021, 2022, 2023, 2024, 2025])
    parser.add_argument("--top-n", type=int, default=10)
    parser.add_argument("--cache-dir", type=Path, default=Path(".cache/tennis_atp"))
    parser.add_argument("--out", type=Path, default=Path("data/players.json"))
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    result = build(args.years, args.top_n, args.cache_dir)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {result['meta']['player_count']} player-year cards to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
