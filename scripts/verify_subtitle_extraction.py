
import re

def extract_excerpt(content):
    excerpt = ""
    lines = content.split('\n')
    
    for line in lines:
        clean_line = line.strip()
        # Skip empty or headers
        if not clean_line or clean_line.startswith('#'):
            continue
            
        # Skip separator lines (e.g. * * * or - - -)
        # Check if line has at least some alphanumeric characters
        if not re.search(r'[a-zA-Z0-9]', clean_line):
            continue
            
        # If we're here, it's a candidate.
        # Clean up markdown bold/italic for the plain text excerpt
        candidate = clean_line.replace('**', '').replace('*', '').replace('__', '').replace('_', '')
        
        if len(candidate) > 10: # Avoid very short fragments
            excerpt = candidate
            if len(excerpt) > 200:
                excerpt = excerpt[:197] + "..."
            break
    return excerpt

def test_logic():
    print("🧪 Testing Subtitle Extraction Logic...")
    
    sample_content = """## The Quiet Architecture of Feeling: Meeting Your Inner Engineering Team

***

**You know when something’s off. This is a space to explore that feeling.**

We live in a time defined by optimization..."""

    print(f"\n--- sample content ---")
    print(sample_content[:100] + "...")
    
    excerpt = extract_excerpt(sample_content)
    
    print(f"\n--- Extracted Excerpt ---")
    print(f"'{excerpt}'")
    
    expected = "You know when something’s off. This is a space to explore that feeling."
    
    if excerpt == expected:
        print("✅ SUCCESS: Extracted correct subtitle.")
    else:
        print(f"❌ FAILURE: Expected '{expected}', got '{excerpt}'")

if __name__ == "__main__":
    test_logic()
