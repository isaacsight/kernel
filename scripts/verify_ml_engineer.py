import sys
import os
import asyncio

# Ensure admin module is in path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from admin.engineers import MLEngineer

async def main():
    print("--- Verifying ML Engineer ---")
    engineer = MLEngineer()
    
    print(f"\nName: {engineer.name}")
    print(f"Role: {engineer.role}")
    print(f"Status: {engineer.report_status()}")
    
    print("\n[Consulting...]")
    advice = engineer.consult()
    print(f"Advice: {advice['advice']}")
    
    print("\n[Running Demo Pipeline...]")
    # Note: This might fail if installation isn't complete yet
    result = engineer.demo_pipeline()
    print(f"Pipeline Result: {result}")
    
    if result.get("status") == "success":
        print("\n✅ Verification Successful!")
    else:
        print("\n❌ Verification Failed (or libs missing).")

if __name__ == "__main__":
    asyncio.run(main())
