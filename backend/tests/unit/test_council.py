"""
Unit tests for backend.council module.

Tests the core ranking parsing and aggregation logic.
"""
import pytest
from backend.council import parse_ranking_from_text, calculate_aggregate_rankings


class TestParseRankingFromText:
    """Tests for parse_ranking_from_text function."""

    def test_standard_final_ranking_format(self):
        """Parse standard FINAL RANKING: format with numbered list."""
        text = """
        Here is my evaluation of the responses.

        FINAL RANKING:
        1. Response C
        2. Response A
        3. Response B
        """
        result = parse_ranking_from_text(text)
        assert result == ["Response C", "Response A", "Response B"]

    def test_final_ranking_without_numbers(self):
        """Parse FINAL RANKING: section without numbered format."""
        text = """
        FINAL RANKING:
        Response B is best, followed by Response A, then Response C.
        """
        result = parse_ranking_from_text(text)
        assert result == ["Response B", "Response A", "Response C"]

    def test_fallback_no_final_ranking_header(self):
        """Fallback extraction when no FINAL RANKING header."""
        text = "I think Response A is best, then Response B."
        result = parse_ranking_from_text(text)
        assert result == ["Response A", "Response B"]

    def test_empty_string(self):
        """Return empty list for empty input."""
        result = parse_ranking_from_text("")
        assert result == []

    def test_no_response_patterns(self):
        """Return empty list when no Response X patterns found."""
        text = "This is some text without any rankings."
        result = parse_ranking_from_text(text)
        assert result == []

    def test_multiple_response_mentions(self):
        """Handle text with multiple mentions - extracts in order found."""
        text = """
        Response A was good. Response B was better.
        FINAL RANKING:
        1. Response B
        2. Response A
        """
        result = parse_ranking_from_text(text)
        # Should extract from FINAL RANKING section
        assert result == ["Response B", "Response A"]

    def test_response_letters_a_through_e(self):
        """Handle Response A through E (5 models)."""
        text = """
        FINAL RANKING:
        1. Response D
        2. Response B
        3. Response E
        4. Response A
        5. Response C
        """
        result = parse_ranking_from_text(text)
        assert result == ["Response D", "Response B", "Response E", "Response A", "Response C"]

    def test_irregular_spacing(self):
        """Handle irregular spacing in ranking."""
        text = """
        FINAL RANKING:
        1.Response A
        2.  Response B
        3.   Response C
        """
        result = parse_ranking_from_text(text)
        assert result == ["Response A", "Response B", "Response C"]


class TestCalculateAggregateRankings:
    """Tests for calculate_aggregate_rankings function."""

    def test_basic_aggregation(self):
        """Calculate average rankings from multiple models."""
        stage2_results = [
            {"model": "gpt-4", "ranking": "FINAL RANKING:\n1. Response A\n2. Response B\n3. Response C"},
            {"model": "claude", "ranking": "FINAL RANKING:\n1. Response B\n2. Response A\n3. Response C"},
        ]
        label_to_model = {
            "Response A": "openai/gpt-4",
            "Response B": "anthropic/claude",
            "Response C": "google/gemini"
        }

        result = calculate_aggregate_rankings(stage2_results, label_to_model)

        # Response A: positions 1, 2 -> avg 1.5
        # Response B: positions 2, 1 -> avg 1.5
        # Response C: positions 3, 3 -> avg 3.0
        assert len(result) == 3
        # Both A and B have 1.5 average, C has 3.0
        avg_ranks = {r["model"]: r["average_rank"] for r in result}
        assert avg_ranks["openai/gpt-4"] == 1.5
        assert avg_ranks["anthropic/claude"] == 1.5
        assert avg_ranks["google/gemini"] == 3.0

    def test_sorted_by_average_rank(self):
        """Results should be sorted by average rank (lower is better)."""
        stage2_results = [
            {"model": "gpt-4", "ranking": "FINAL RANKING:\n1. Response C\n2. Response A\n3. Response B"},
            {"model": "claude", "ranking": "FINAL RANKING:\n1. Response C\n2. Response B\n3. Response A"},
        ]
        label_to_model = {
            "Response A": "model-a",
            "Response B": "model-b",
            "Response C": "model-c"
        }

        result = calculate_aggregate_rankings(stage2_results, label_to_model)

        # Response C: positions 1, 1 -> avg 1.0 (best)
        # Response A: positions 2, 3 -> avg 2.5
        # Response B: positions 3, 2 -> avg 2.5
        assert result[0]["model"] == "model-c"
        assert result[0]["average_rank"] == 1.0

    def test_empty_stage2_results(self):
        """Handle empty stage2 results."""
        result = calculate_aggregate_rankings([], {"Response A": "model-a"})
        assert result == []

    def test_missing_label_in_mapping(self):
        """Skip labels not in label_to_model mapping."""
        stage2_results = [
            {"model": "gpt-4", "ranking": "FINAL RANKING:\n1. Response A\n2. Response Z"},
        ]
        label_to_model = {"Response A": "model-a"}  # Response Z not mapped

        result = calculate_aggregate_rankings(stage2_results, label_to_model)

        # Only Response A should be in results
        assert len(result) == 1
        assert result[0]["model"] == "model-a"

    def test_rankings_count_tracked(self):
        """Track how many rankings contributed to average."""
        stage2_results = [
            {"model": "m1", "ranking": "FINAL RANKING:\n1. Response A\n2. Response B"},
            {"model": "m2", "ranking": "FINAL RANKING:\n1. Response A\n2. Response B"},
            {"model": "m3", "ranking": "FINAL RANKING:\n1. Response B\n2. Response A"},
        ]
        label_to_model = {
            "Response A": "model-a",
            "Response B": "model-b"
        }

        result = calculate_aggregate_rankings(stage2_results, label_to_model)

        # Each model should have 3 rankings counted
        for r in result:
            assert r["rankings_count"] == 3

    def test_single_ranker(self):
        """Handle case with only one model providing rankings."""
        stage2_results = [
            {"model": "solo", "ranking": "FINAL RANKING:\n1. Response B\n2. Response A"},
        ]
        label_to_model = {
            "Response A": "model-a",
            "Response B": "model-b"
        }

        result = calculate_aggregate_rankings(stage2_results, label_to_model)

        assert len(result) == 2
        assert result[0]["model"] == "model-b"  # Ranked 1st
        assert result[0]["average_rank"] == 1.0
        assert result[1]["model"] == "model-a"  # Ranked 2nd
        assert result[1]["average_rank"] == 2.0
