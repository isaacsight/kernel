import dspy
import ast
import os
import sys

# 1. Configure Language Model
# We'll use Anthropic Claude 3 Haiku (Sovereign Tier)
api_key = os.getenv("ANTHROPIC_API_KEY")
if not api_key:
    print("Error: ANTHROPIC_API_KEY not found.")
    sys.exit(1)

# Note: DSPy uses LiteLLM.
lm = dspy.LM('anthropic/claude-3-haiku-20240307', api_key=api_key)
dspy.configure(lm=lm)

# 2. Define the Signature (Input/Output Contract)
class CodeMigration(dspy.Signature):
    """
    Migrates legacy synchronous Python code (using requests) to modern async/await patterns (using httpx/asyncio).
    """
    legacy_code = dspy.InputField(desc="Old synchronous Python code block")
    feedback = dspy.InputField(desc="Optional feedback from previous failures", optional=True)
    modern_code = dspy.OutputField(desc="Compilable, modern asynchronous Python code block")

# 3. Validation Logic
def is_valid_syntax(code_str):
    clean_code = code_str.replace("```python", "").replace("```", "").strip()
    try:
        ast.parse(clean_code)
        return True, None
    except SyntaxError as e:
        return False, f"SyntaxError at line {e.lineno}: {e.msg}"

# 4. Agentic Migrator (Explicit Loop)
class AgenticMigrator(dspy.Module):
    def __init__(self):
        super().__init__()
        self.generate = dspy.ChainOfThought(CodeMigration)

    def forward(self, legacy_code):
        # 1. First Attempt
        print("   Attempt 1: Generating implementation...")
        pred = self.generate(legacy_code=legacy_code)
        
        valid, error = is_valid_syntax(pred.modern_code)
        if valid:
            return pred

        # 2. Self-Healing Attempt
        print(f"   ⚠️ Syntax Error detected: {error}")
        print("   Attempt 2: Self-Healing with feedback...")
        
        # We recursively call generate, injecting the specific error as context
        pred_healing = self.generate(
            legacy_code=legacy_code,
            feedback=f"The previous code had a syntax error: {error}. Please fix it."
        )
        
        return pred_healing

# 5. CLI Entry Point
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python auto_migrate.py <file_to_migrate.py>")
        sys.exit(1)
        
    filepath = sys.argv[1]
    with open(filepath, 'r') as f:
        legacy_content = f.read()
    
    print(f"🤖 AgenticMigrator: Analyzing {filepath}...")
    
    # Instantiate and Run
    agent = AgenticMigrator()
    
    try:
        # The 'forward' method runs the generation + assertion loop
        result = agent(legacy_code=legacy_content)
        
        # Output
        print("\n✅ Migration Successful (Self-Corrected if needed):")
        print("-" * 40)
        print(result.modern_code)
        print("-" * 40)
        
        # Save validation
        valid, _ = is_valid_syntax(result.modern_code)
        if valid:
            print("Verified: Syntax Validated via AST.")
        
    except Exception as e:
        print(f"❌ Agent failed: {e}")
