from app.schemas.radar import aggregate_score, clamp_score, zero_radar_scores


def test_clamp_score_bounds() -> None:
    assert clamp_score(-10) == 0
    assert clamp_score(150) == 100
    assert clamp_score(72.4) == 72
    assert clamp_score("88") == 88
    assert clamp_score(None) == 0


def test_aggregate_score_formula() -> None:
    # 60 * 0.7 + 90 * 0.3 = 42 + 27 = 69
    assert aggregate_score(60, 90) == 69
    assert aggregate_score(0, 100) == 30
    assert aggregate_score(100, 0) == 70


def test_zero_radar_scores() -> None:
    scores = zero_radar_scores()
    assert set(scores.keys()) == {
        "needs_discovery",
        "solution_presentation",
        "objection_handling",
        "closing_persistence",
        "technical_expertise",
        "risk_management",
    }
    assert all(value == 0 for value in scores.values())
