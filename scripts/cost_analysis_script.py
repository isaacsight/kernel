import sqlite3
import os
import json
from datetime import datetime

# Paths
MEMORY_DB = "admin/brain/studio_memory.db"
FINANCE_DB = "sql/finance.db"

# Rates per 1M tokens (from ModelRouter.py)
COST_MAP = {
    "gemini": {"in": 0.35, "out": 1.05},  # Defaulting to Flash rates for safety
    "gemini-1.5-pro": {"in": 3.50, "out": 10.50},
    "gemini-1.5-flash": {"in": 0.35, "out": 1.05},
    "gpt-4o": {"in": 5.00, "out": 15.00},
    "gpt-4o-mini": {"in": 0.15, "out": 0.60},
    "claude-3.5-sonnet": {"in": 3.00, "out": 15.00},
    "remote": {"in": 0, "out": 0},  # Assuming local/private node is free
    "ollama": {"in": 0, "out": 0},
}


def estimate_tokens(text):
    if not text:
        return 0
    return len(text) // 4


def calculate_total_cost():
    total_llm_cost = 0.0
    llm_breakdown = {}

    print("--- LLM Usage Analysis ---")

    if os.path.exists(MEMORY_DB):
        conn = sqlite3.connect(MEMORY_DB)
        cursor = conn.cursor()

        # 1. Analyze Generations
        try:
            cursor.execute("SELECT provider, content, success FROM generations")
            rows = cursor.fetchall()
            for provider, content, success in rows:
                if not success:
                    continue

                # Normalize provider name
                p_key = provider.lower()
                if "gemini" in p_key:
                    p_key = "gemini-1.5-flash"  # Assuming flash as default for logs

                rates = COST_MAP.get(p_key, COST_MAP["gemini"])

                # Estimate output tokens (since only content is stored in generations)
                out_tokens = estimate_tokens(content)
                # Assume prompt is roughly 500 tokens if unknown (average system prompt + context)
                in_tokens = 500

                cost = (in_tokens / 1_000_000 * rates["in"]) + (
                    out_tokens / 1_000_000 * rates["out"]
                )
                total_llm_cost += cost

                if p_key not in llm_breakdown:
                    llm_breakdown[p_key] = {"cost": 0.0, "count": 0}
                llm_breakdown[p_key]["cost"] += cost
                llm_breakdown[p_key]["count"] += 1
        except Exception as e:
            print(f"Error querying generations: {e}")

        # 2. Analyze Agent Actions (more detailed input/output)
        try:
            cursor.execute("SELECT agent_name, input_data, output_data, success FROM agent_actions")
            rows = cursor.fetchall()
            for agent, input_data, output_data, success in rows:
                if not success:
                    continue

                # Heuristic: Check if output looks like LLM generation (long text)
                if output_data and len(output_data) > 100:
                    # We don't know the exact model here, so we'll assume a mid-tier (Gemini Pro)
                    rates = COST_MAP["gemini-1.5-pro"]

                    in_tokens = estimate_tokens(input_data)
                    out_tokens = estimate_tokens(output_data)

                    cost = (in_tokens / 1_000_000 * rates["in"]) + (
                        out_tokens / 1_000_000 * rates["out"]
                    )
                    total_llm_cost += cost

                    if "agent_actions" not in llm_breakdown:
                        llm_breakdown["agent_actions"] = {"cost": 0.0, "count": 0}
                    llm_breakdown["agent_actions"]["cost"] += cost
                    llm_breakdown["agent_actions"]["count"] += 1
        except Exception as e:
            print(f"Error querying agent_actions: {e}")

        conn.close()
    else:
        print(f"Memory DB not found at {MEMORY_DB}")

    for p, stats in llm_breakdown.items():
        print(f"  {p}: {stats['count']} calls, ${stats['cost']:.4f}")

    print(f"\nTotal Estimated LLM Cost: ${total_llm_cost:.4f}")

    print("\n--- Financial Ledger Analysis ---")
    total_ledger_expenses = 0.0
    if os.path.exists(FINANCE_DB):
        conn = sqlite3.connect(FINANCE_DB)
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT SUM(amount) FROM transactions WHERE amount < 0")
            result = cursor.fetchone()[0]
            total_ledger_expenses = abs(result) if result else 0.0
            print(f"  Manual Expenses (Server Hosting, etc): ${total_ledger_expenses:.2f}")
        except Exception as e:
            print(f"Error querying finance ledger: {e}")
        conn.close()
    else:
        print(f"Finance DB not found at {FINANCE_DB}")

    print("\n" + "=" * 30)
    print(f"GRAND TOTAL COST: ${total_llm_cost + total_ledger_expenses:.4f}")
    print("=" * 30)


if __name__ == "__main__":
    calculate_total_cost()
