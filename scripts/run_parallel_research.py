import sys
import os
import time

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.research_engineer import ResearchEngineer

def main():
    print("🚀 Starting Parallel Frontier Research Campaign...")
    engineer = ResearchEngineer()
    
    tracks = [
        {
            "id": "A",
            "name": "Reasoning Track",
            "topic": "Test-Time Compute and System 2 Thinking in Autonomous Agents. How can agents 'think' before acting?"
        },
        {
            "id": "B",
            "name": "Memory Track",
            "topic": "Infinite Context Windows vs. Semantic RAG for Long-Term Memory. Best architectural for Studio OS?"
        },
        {
            "id": "C",
            "name": "Alignment Track",
            "topic": "Constitutional AI and Recursive Oversight in Agent Systems. How to ensure safety without human loop?"
        }
    ]
    
    results = []
    
    for track in tracks:
        print(f"\n🧪 [Track {track['id']}] Researching: {track['name']}...")
        print(f"   Query: {track['topic']}")
        
        try:
            # We use the existing 'conduct_research' method
            output = engineer.conduct_research(track['topic'])
            
            # Save strictly to a file for review
            filename = f"research_track_{track['id']}_{track['name'].replace(' ', '_')}.md"
            filepath = os.path.join(engineer.papers_dir, filename)
            
            with open(filepath, 'w') as f:
                f.write(f"# Research Track {track['id']}: {track['name']}\n\n")
                f.write(f"**Topic:** {track['topic']}\n\n")
                f.write(output)
                
            print(f"✅ Track {track['id']} Complete. Saved to {filepath}")
            results.append(filepath)
            
            # Cool down to be polite to API
            time.sleep(2)
            
        except Exception as e:
            print(f"❌ Track {track['id']} Failed: {e}")

    print("\n🏁 Research Campaign Complete.")
    print("Artifacts generated:")
    for path in results:
        print(f"- {path}")

if __name__ == "__main__":
    main()
