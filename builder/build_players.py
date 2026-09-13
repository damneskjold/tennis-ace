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

# The original JeffSackmann/tennis_atp repo was removed from GitHub at some
# point after mid-2026; this points at a maintained archival mirror instead
# (see docs/DATA_SOURCE.md for details).
RAW_BASE = "https://raw.githubusercontent.com/Aneeshers/tennis-sackmann-archive/main/atp"
# Played but unfinished: the games that were played still count.
INCOMPLETE_MARKERS = ("RET", "W/O", "WEA", "DEF", "ABN")
# Never played at all -- a withdrawal or a default. These aren't matches and
# don't belong in a win-loss record (it's why our first build had Sinner 2024
# at 81 matches against Wikipedia's 73-6 = 79).
NOT_PLAYED_MARKERS = ("W/O", "DEF")

# Serve and return categories come from the per-match stat columns, which
# Sackmann only has from 1991 on (verified: 1985 has 0% of matches with
# w_svpt populated, 1991 has 86%). Everything below SCORE_STAT_KEYS is
# derived from the score string alone, which exists back to 1968 -- that's
# what makes 70s/80s player-years playable at all. A cross-era matchup
# simply has fewer shared categories; the engine already drops any category
# missing on either side.
SERVE_RETURN_STAT_KEYS = [
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
]

# Measured on 1319 real cards, matches_won/sets_won/games_won correlate at
# r=0.91-0.96 -- they're the same "how good were you" axis three times over,
# which would have the engine offering three flavors of one category. Only
# games_won_pct survives (finest-grained, least lumpy). The rest of this list
# deliberately measures PROFILE rather than LEVEL, which is what the player is
# supposed to be learning about their player-year.
SCORE_STAT_KEYS = [
    "tiebreaks_won_pct",
    "deciding_set_won_pct",
    "games_won_pct",
    "straight_sets_win_pct",
    "comeback_win_pct",
    "first_set_win_pct",
    "slow_win_pct",
    "fast_win_pct",
]

# Surface as a style of play, not a venue: "fast ball" is hard, grass and
# carpet together (grass isn't a third style -- it belongs with the fast
# stuff), "slow ball" is clay.
FAST_SURFACES = {"hard", "grass", "carpet"}
SLOW_SURFACES = {"clay"}

# Surface rates rest on a handful of matches, so instead of dropping the thin
# ones (a cutoff at 8 matches threw out 102 cards -- Sampras, Agassi, late
# Federer, Roddick, Isner, Karlovic: skipping the clay season *is* the
# fast-court specialist's profile, not a data gap) each rate is pulled toward
# the pool mean in proportion to how few matches back it. SHRINKAGE_MATCHES is
# that pull expressed in matches: a player with this many of them sits halfway
# between their own rate and the pool's.
SHRINKAGE_MATCHES = 10

STAT_KEYS = SERVE_RETURN_STAT_KEYS + SCORE_STAT_KEYS

# The eight cards the v1 game is played with. Each groups raw stats that were
# measured to be the same axis (correlations 0.62-0.89 within a group), so the
# player faces eight distinct decisions rather than eighteen overlapping ones.
# See docs/V1_DESIGN.md for the correlation evidence behind each grouping.
CATEGORIES = {
    "servizio": ["ace_pct", "first_won_pct", "bp_saved_pct", "service_games_won_pct"],
    "prima": ["first_in_pct"],
    "seconda": ["second_won_pct"],
    "risposta": ["return_first_won_pct", "return_second_won_pct", "return_games_won_pct"],
    "palle_break": ["bp_converted_pct"],
    "tenuta": ["tiebreaks_won_pct", "deciding_set_won_pct", "comeback_win_pct"],
    "palla_veloce": ["fast_win_pct"],
    "palla_lenta": ["slow_win_pct"],
}

# Overall is deliberately compressed: everyone in the pool is a top-25 season,
# so the gap between the worst and the best of them is narrow by construction.
OVERALL_FLOOR, OVERALL_CEILING = 80, 99

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
        # Score-derived, available in every era.
        "matches_won": 0, "matches_counted": 0,
        "games_won": 0, "games_played": 0,
        "wins_complete": 0, "straight_set_wins": 0,
        "lost_first_set": 0, "comeback_wins": 0,
        "first_sets_won": 0, "first_sets_played": 0,
        "slow_won": 0, "slow_played": 0,
        "fast_won": 0, "fast_played": 0,
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
        core = token.split("(")[0]
        try:
            w_games, l_games = (int(x) for x in core.split("-"))
        except ValueError:
            continue
        # Pre-1991 scores carry no "(4)" detail, so the games themselves have
        # to reveal the tie-break: under advantage scoring a set can't end
        # 7-6 without one.
        was_tb = "(" in token or {w_games, l_games} == {7, 6}
        sets.append((w_games, l_games, was_tb))
    return sets


def add_score_stats(agg_winner: dict, agg_loser: dict, row: dict) -> None:
    """Everything derivable from the score string alone -- works in any era."""
    score = row.get("score", "") or ""

    # A retirement still counts in the win-loss record, but its partial score
    # can't be trusted for games/sets breakdowns.
    if any(marker in score for marker in NOT_PLAYED_MARKERS):
        return

    incomplete = any(marker in score for marker in INCOMPLETE_MARKERS)
    agg_winner["matches_won"] += 1
    agg_winner["matches_counted"] += 1
    agg_loser["matches_counted"] += 1

    surface = (row.get("surface") or "").strip().lower()
    if surface in SLOW_SURFACES:
        agg_winner["slow_won"] += 1
        agg_winner["slow_played"] += 1
        agg_loser["slow_played"] += 1
    elif surface in FAST_SURFACES:
        agg_winner["fast_won"] += 1
        agg_winner["fast_played"] += 1
        agg_loser["fast_played"] += 1

    if incomplete:
        return

    sets = parse_sets(score)
    if not sets:
        return

    winner_sets = sum(1 for w, l, _ in sets if w > l)
    loser_sets = len(sets) - winner_sets

    winner_games = sum(w for w, _, _ in sets)
    loser_games = sum(l for _, l, _ in sets)
    total_games = winner_games + loser_games
    agg_winner["games_won"] += winner_games
    agg_loser["games_won"] += loser_games
    agg_winner["games_played"] += total_games
    agg_loser["games_played"] += total_games

    agg_winner["wins_complete"] += 1
    if loser_sets == 0:
        agg_winner["straight_set_wins"] += 1

    first_w, first_l, _ = sets[0]
    agg_winner["first_sets_played"] += 1
    agg_loser["first_sets_played"] += 1
    if first_w > first_l:
        agg_winner["first_sets_won"] += 1
        # The match winner took the opening set, so the loser is the one who
        # went down a set and failed to come back.
        agg_loser["lost_first_set"] += 1
    else:
        agg_loser["first_sets_won"] += 1
        agg_winner["lost_first_set"] += 1
        agg_winner["comeback_wins"] += 1

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


def aggregate_year(
    matches_rows: list[dict],
    player_ids: set[str],
    id_to_name: dict,
    id_to_country: dict,
) -> dict[str, dict]:
    aggs: dict[str, dict] = {pid: new_agg() for pid in player_ids}

    for row in matches_rows:
        wid, lid = row.get("winner_id"), row.get("loser_id")
        if wid not in id_to_name:
            id_to_name[wid] = row.get("winner_name", "")
            id_to_country[wid] = row.get("winner_ioc", "")
        if lid not in id_to_name:
            id_to_name[lid] = row.get("loser_name", "")
            id_to_country[lid] = row.get("loser_ioc", "")

        w_in, l_in = wid in aggs, lid in aggs
        if not w_in and not l_in:
            continue

        # Score-derived stats first: they only need the score column, so they
        # work for pre-1991 seasons where every serve stat is blank.
        add_score_stats(
            aggs[wid] if w_in else new_agg(),
            aggs[lid] if l_in else new_agg(),
            row,
        )

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
        "games_won_pct": pct(agg["games_won"], agg["games_played"]),
        "straight_sets_win_pct": pct(agg["straight_set_wins"], agg["wins_complete"]),
        "comeback_win_pct": pct(agg["comeback_wins"], agg["lost_first_set"]),
        "first_set_win_pct": pct(agg["first_sets_won"], agg["first_sets_played"]),
        "slow_win_pct": pct(agg["slow_won"], agg["slow_played"]),
        "fast_win_pct": pct(agg["fast_won"], agg["fast_played"]),
    }


# Stats whose denominator is a handful of matches/sets rather than hundreds of
# points, so they need shrinking toward the pool mean before they can be
# compared across players.
SMALL_SAMPLE_STATS = {
    "slow_win_pct": "slow_played",
    "fast_win_pct": "fast_played",
    "tiebreaks_won_pct": "tb_played",
    "deciding_set_won_pct": "decider_played",
    "comeback_win_pct": "lost_first_set",
}


def sample_sizes(agg: dict) -> dict[str, int]:
    return {stat: agg[counter] for stat, counter in SMALL_SAMPLE_STATS.items()}


def percentile_rank(sorted_values: list[float], value: float) -> float:
    """Share of the pool this value sits above, 0..1."""
    below = sum(1 for v in sorted_values if v < value)
    return below / len(sorted_values)


def compute_profiles(players: list[dict], stat_mean: dict, stat_stddev: dict) -> None:
    """Add each player's eight category scores and their overall, in place.

    A category score is the mean of its component stats in z-score space: the
    raw percentages have different scales and spreads (ace% swings far wider
    across players than break-points-saved%), so averaging them directly would
    let the widest-spread stat dominate its own group.

    Each card also carries a 1-99 rating, which is its percentile in the pool
    -- that's what the UI shows for your own cards and what the opponent's
    stars are bucketed from. Ratings span the full range while the overall
    stays in the 80s and 90s, the same way a sports game shows attributes on a
    wider scale than the headline number.
    """
    for p in players:
        scores = {}
        for category, keys in CATEGORIES.items():
            zs = [
                (p["stats"][k] - stat_mean[k]) / stat_stddev[k]
                for k in keys
                if p["stats"][k] is not None and stat_stddev[k]
            ]
            scores[category] = round(statistics.fmean(zs), 4) if len(zs) == len(keys) else None
        p["categories"] = scores
        # Equal weight per card, so a four-stat group doesn't outvote a
        # one-stat group just for having more parts.
        known = [v for v in scores.values() if v is not None]
        p["_overall_raw"] = statistics.fmean(known) if known else None

    by_category = {
        c: sorted(p["categories"][c] for p in players if p["categories"][c] is not None)
        for c in CATEGORIES
    }
    for p in players:
        p["ratings"] = {
            c: (None if v is None else round(1 + 98 * percentile_rank(by_category[c], v)))
            for c, v in p["categories"].items()
        }

    raws = [p["_overall_raw"] for p in players if p["_overall_raw"] is not None]
    lo, hi = min(raws), max(raws)
    span = hi - lo
    for p in players:
        raw = p.pop("_overall_raw")
        p["overall"] = (
            None
            if raw is None or not span
            else round(OVERALL_FLOOR + (OVERALL_CEILING - OVERALL_FLOOR) * (raw - lo) / span)
        )


def apply_shrinkage(players: list[dict]) -> None:
    """Pull thin rates toward the pool's own rate, in place.

    A 0%-on-clay built from two matches isn't a weakness, it's an absence of
    evidence, and treating it as a real number would hand Agassi 2004 a
    catastrophic card off a two-match sample. Each rate is blended with the
    pooled rate, weighted by how many matches actually back it: nothing
    observed lands exactly on the pool rate, a full season barely moves.
    """
    for stat in SMALL_SAMPLE_STATS:
        weighted = total = 0.0
        for p in players:
            n, rate = p["samples"][stat], p["stats"][stat]
            if rate is None or n == 0:
                continue
            weighted += rate * n
            total += n
        if not total:
            # Nobody in the pool ever played one. There's nothing to shrink
            # toward, and inventing a 0% for everyone would be worse than
            # leaving the stat unknown.
            continue
        prior = weighted / total

        for p in players:
            n, rate = p["samples"][stat], p["stats"][stat]
            observed = prior if rate is None else rate
            p["stats"][stat] = round(
                (n * observed + SHRINKAGE_MATCHES * prior) / (n + SHRINKAGE_MATCHES), 2
            )


def compute_gap_percentiles(players: list[dict], stat_keys: list[str], stat_stddev: dict[str, float]) -> dict[str, float]:
    """Distribution of |normalized delta| over every ordered pair of players and
    every stat both have defined, pooled across all categories (normalization
    already put them on a comparable scale). The game engine uses these
    percentiles -- not arbitrary fixed thresholds -- to decide which categories
    count as "wide gap" (easy round) vs "narrow gap" (hard round) for a given
    matchup, per docs/PROJECT_BRIEF.md's difficulty-curve design.
    """
    gaps: list[float] = []
    for a in players:
        for b in players:
            if a is b:
                continue
            for key in stat_keys:
                va, vb = a["stats"][key], b["stats"][key]
                if va is None or vb is None:
                    continue
                sd = stat_stddev[key]
                if sd == 0:
                    continue
                gaps.append(abs(va - vb) / sd)

    if not gaps:
        return {"p25": 0.0, "p50": 0.0, "p75": 0.0}

    q = statistics.quantiles(gaps, n=4, method="inclusive")
    return {"p25": round(q[0], 4), "p50": round(q[1], 4), "p75": round(q[2], 4)}


def rankings_files_for(years: list[int]) -> list[str]:
    """ATP rankings live in per-decade files (rankings themselves start in 1973)."""
    decades = set()
    for year in years:
        decade = (year // 10) * 10
        suffix = f"{decade % 100:02d}s"
        decades.add(f"atp_rankings_{suffix}.csv")
    return sorted(decades)


def build(years: list[int], top_n: int, cache_dir: Path, min_matches: int) -> dict:
    rankings_rows: list[dict] = []
    for filename in rankings_files_for(years):
        rankings_rows.extend(load_csv_rows(fetch(f"{RAW_BASE}/{filename}", cache_dir / filename)))

    id_to_name: dict[str, str] = {}
    id_to_country: dict[str, str] = {}
    players = []
    skipped = 0

    for year in years:
        matches_text = fetch(f"{RAW_BASE}/atp_matches_{year}.csv", cache_dir / f"atp_matches_{year}.csv")
        matches_rows = load_csv_rows(matches_text)

        top_ids = set(year_end_top_n(rankings_rows, year, top_n))
        aggs = aggregate_year(matches_rows, top_ids, id_to_name, id_to_country)

        for pid, agg in aggs.items():
            # matches_counted comes from the score column, so it's the count
            # that exists in every era; agg["matches"] only counts matches that
            # also carried serve stats (nothing before 1991).
            played = agg["matches_counted"]
            if played < min_matches:
                skipped += 1
                continue
            players.append({
                "id": f"{pid}-{year}",
                "player_id": pid,
                "name": id_to_name.get(pid, pid),
                "country": id_to_country.get(pid, ""),
                "year": year,
                "matches_played": played,
                "matches_with_serve_stats": agg["matches"],
                "stats": compute_stats(agg),
                "samples": sample_sizes(agg),
            })

    if skipped:
        print(f"note: skipped {skipped} player-years with fewer than {min_matches} matches", file=sys.stderr)

    # Before any pool statistic is derived: thin rates have to be tamed first,
    # or the mean and stddev they feed are computed over noise.
    apply_shrinkage(players)

    stat_values: dict[str, list[float]] = {k: [] for k in STAT_KEYS}
    for p in players:
        for k, v in p["stats"].items():
            if v is not None:
                stat_values[k].append(v)

    stat_stddev = {k: round(statistics.pstdev(v), 4) if len(v) > 1 else 0.0 for k, v in stat_values.items()}
    stat_mean = {k: round(statistics.fmean(v), 4) if v else 0.0 for k, v in stat_values.items()}
    gap_percentiles = compute_gap_percentiles(players, STAT_KEYS, stat_stddev)
    compute_profiles(players, stat_mean, stat_stddev)

    return {
        "categories": list(CATEGORIES),
        "meta": {
            "source": RAW_BASE,
            "years": years,
            "top_n": top_n,
            "min_matches": min_matches,
            "player_count": len(players),
        },
        "serve_return_stat_keys": SERVE_RETURN_STAT_KEYS,
        "score_stat_keys": SCORE_STAT_KEYS,
        "stat_keys": STAT_KEYS,
        "stat_mean": stat_mean,
        "stat_stddev": stat_stddev,
        "gap_percentiles": gap_percentiles,
        "players": players,
    }


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--years", type=int, nargs="+", default=[2021, 2022, 2023, 2024, 2025])
    parser.add_argument("--top-n", type=int, default=25)
    parser.add_argument(
        "--min-matches",
        type=int,
        default=20,
        help="drop player-years with fewer matches than this (injury-shortened seasons are statistical noise)",
    )
    parser.add_argument("--cache-dir", type=Path, default=Path(".cache/tennis_atp"))
    parser.add_argument("--out", type=Path, default=Path("data/players.json"))
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    result = build(args.years, args.top_n, args.cache_dir, args.min_matches)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {result['meta']['player_count']} player-year cards to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
