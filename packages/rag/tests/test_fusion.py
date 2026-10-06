from contexta_rag.fusion import order_by_fusion, reciprocal_rank_fusion


def test_a_key_ranked_first_by_either_arm_beats_one_both_rank_mid_table() -> None:
    scores = reciprocal_rank_fusion(
        ranked_keys=[["a", "b", "c"], ["c", "a", "b"]],
    )

    assert order_by_fusion(scores) == ["a", "c", "b"]


def test_only_positions_count_so_arms_with_different_scales_cannot_outvote() -> None:
    single = reciprocal_rank_fusion([["a", "b"]])
    paired = reciprocal_rank_fusion([["a", "b"], ["b", "a"]])

    assert single["a"] > paired["a"] / 2  # equal ranks sum, no magnitude involved
    assert paired["a"] == paired["b"]


def test_an_arm_that_never_returns_a_key_cannot_erase_the_other_arms_ranking() -> None:
    scores = reciprocal_rank_fusion(ranked_keys=[["a", "b"], []])

    assert order_by_fusion(scores) == ["a", "b"]
    assert scores["b"] < scores["a"]


def test_ties_are_broken_toward_the_arm_passed_first() -> None:
    scores = reciprocal_rank_fusion(ranked_keys=[["x", "y"], ["y", "x"]])

    assert scores["x"] == scores["y"]
    assert order_by_fusion(scores) == ["x", "y"]


def test_a_larger_window_flattens_the_gap_between_ranks() -> None:
    wide = reciprocal_rank_fusion([["a", "b"]], k=60)
    narrow = reciprocal_rank_fusion([["a", "b"]], k=1)

    assert wide["a"] / wide["b"] < narrow["a"] / narrow["b"]
