#!/usr/bin/env bash
# Type Safety Check Script
# Sovereign Laboratory OS - Foundation Hardening

set -e

echo "🔍 Sovereign Laboratory OS - Type Safety Check"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if mypy is installed
if ! command -v mypy &> /dev/null; then
    echo -e "${RED}❌ mypy not found${NC}"
    echo "Installing mypy..."
    pip install mypy
fi

echo -e "${YELLOW}📊 Running type checks...${NC}"
echo ""

# Phase 1: Check critical modules
MODULES=(
    "admin/brain/agent_base.py"
    "admin/brain/model_router.py"
    "admin/brain/memory_store.py"
    "admin/brain/collective_intelligence.py"
    "core/loop_manager.py"
    "core/agent_interface.py"
    "core/dtfr_schemas.py"
)

TOTAL=0
PASSED=0
FAILED=0

for module in "${MODULES[@]}"; do
    TOTAL=$((TOTAL + 1))
    echo -e "Checking ${module}..."

    if mypy "$module" --config-file mypy.ini 2>&1 | tee /tmp/mypy_output.txt; then
        # Check if there were any errors (mypy returns 0 even with warnings)
        if grep -q "error:" /tmp/mypy_output.txt; then
            echo -e "${RED}  ✗ Type errors found${NC}"
            FAILED=$((FAILED + 1))
        else
            echo -e "${GREEN}  ✓ Passed${NC}"
            PASSED=$((PASSED + 1))
        fi
    else
        echo -e "${RED}  ✗ Failed${NC}"
        FAILED=$((FAILED + 1))
    fi
    echo ""
done

echo "=============================================="
echo -e "Results: ${GREEN}${PASSED} passed${NC}, ${RED}${FAILED} failed${NC} (${TOTAL} total)"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All type checks passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Type errors detected. Review output above.${NC}"
    echo ""
    echo "To fix incrementally:"
    echo "  1. Run: mypy <file> --config-file mypy.ini"
    echo "  2. Add type hints to untyped functions"
    echo "  3. Fix revealed type errors"
    echo "  4. Re-run this script"
    exit 1
fi
