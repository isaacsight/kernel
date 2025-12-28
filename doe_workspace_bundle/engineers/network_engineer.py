import logging
from config import config
from admin.infrastructure.data_center import DataCenter

logger = logging.getLogger("NetworkEngineer")

class NetworkEngineer:
    """
    The Network Engineer (Infrastructure Specialist)
    
    Mission: Ensure connectivity and health of the Data Center.
    """
    def __init__(self):
        self.name = "The Network Engineer"
        self.data_center = DataCenter(config)
        
    def manage_infrastructure(self):
        """
        Checks the health of the entire Data Center and reports status.
        """
        logger.info("Inspecting Data Center infrastructure...")
        report = self.data_center.get_status_report()
        
        # Summarize findings
        summary = []
        for node, status in report.items():
            icon = "🟢" if status['status'] == 'online' else "🔴" if status['status'] == 'offline' else "🟡"
            summary.append(f"{icon} {node.upper()}: {status['message']}")
            
        return "\n".join(summary)

    def check_node_status(self):
        """
        Legacy method for backward compatibility.
        Checks specifically the Studio Node.
        """
        return self.data_center.check_node_health("studio_node")

if __name__ == "__main__":
    eng = NetworkEngineer()
    print(eng.manage_infrastructure())
