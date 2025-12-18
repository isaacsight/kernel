import pexpect
import sys

HOSTS = ["100.83.248.106", "100.91.174.71", "100.98.193.42"]
USER = "advented-gx1"
PASS = "6214Adv"
PROJECT_DIR = "/home/advented-gx1/Desktop/projects/exo/exo-source"

def run_remote_cmds():
    for host in HOSTS:
        print(f"\n⚡ Trying connection to {USER}@{host}...")
        try:
            # Spawn SSH connection
            child = pexpect.spawn(f"ssh {USER}@{host}", timeout=10)
            
            # Expect password prompt
            i = child.expect(["password:", "Are you sure you want to continue connecting", pexpect.EOF, pexpect.TIMEOUT])
            
            if i == 1: # Are you sure...
                child.sendline("yes")
                i = child.expect(["password:", pexpect.EOF, pexpect.TIMEOUT])
            
            if i == 0: # password:
                child.sendline(PASS)
                
                # Expect shell prompt
                index = child.expect([r"\$", r"\#", "Permission denied", pexpect.TIMEOUT], timeout=10)
                if index == 0 or index == 1:
                    print(f"✅ SUCCESSFULLY connected to {host}!")
                    
                    # Execute tasks
                    exec_cmd(child, f"ls -F {PROJECT_DIR}", "Listing Project Directory")
                    exec_cmd(child, f"cat {PROJECT_DIR}/ARCHITECTURE.md", "Content of ARCHITECTURE.md")
                    
                    print(f"\n--- Finding Recent Progress Reports ---")
                    child.sendline(f"ls -lt {PROJECT_DIR}")
                    child.expect([r"\$", r"\#"])
                    print(child.before.decode())
                    
                    child.sendline("exit")
                    child.close()
                    return # Exit after success
                elif index == 2:
                    print(f"❌ Permission denied on {host}.")
                else:
                    print(f"⚠️  Login timeout or weird prompt on {host}.")
                    print(child.before.decode() if child.before else "No output")

            else:
                print(f"❌ Failed to reach password prompt on {host}. Result index: {i}")

        except Exception as e:
            print(f"Error checking {host}: {e}")
    
    print("\n❌ Could not connect to any host.")

# Helper to run command and get output
def exec_cmd(child, cmd, desc):
    print(f"\n--- {desc} ---")
    child.sendline(cmd)
    child.expect([r"\$", r"\#"])
    lines = child.before.decode().splitlines()
    print("\n".join(lines[1:]))


if __name__ == "__main__":
    try:
        run_remote_cmds()
    except Exception as e:
        print(f"Error: {e}")
