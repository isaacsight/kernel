import sys
import os

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))

from admin.engineers import (
    BioEngineer,
    QuantumEngineer,
    RoboticsEngineer,
    QuantResearcher, # Strategic Finance
    PrincipalEngineer, # AI
    InfrastructureEngineer, # EE
    ProductEngineer # CS
)

def test_agent(AgentClass, domain_keyword):
    print(f"Testing {AgentClass.__name__}...")
    try:
        agent = AgentClass()
        advice = agent.consult()
        print(f"  Role: {agent.role}")
        print(f"  Advice: {advice['advice'][:100]}...")
        
        if domain_keyword.lower() in str(advice).lower():
             print("  ✅ Domain Knowledge Verified")
             return True
        else:
             print(f"  ❌ Domain Keyword '{domain_keyword}' not found in advice.")
             return False
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False

def main():
    agents = [
        (BioEngineer, "CRISPR"),
        (QuantumEngineer, "Quantum"),
        (RoboticsEngineer, "Robotics"),
        (QuantResearcher, "money"),
        (PrincipalEngineer, "electricity"),
        (InfrastructureEngineer, "Hardware"),
        (ProductEngineer, "pivot")
    ]
    
    passed = 0
    for agent_class, keyword in agents:
        if test_agent(agent_class, keyword):
            passed += 1
            
    print(f"\nPassed {passed}/{len(agents)} tests.")

if __name__ == "__main__":
    main()
