"""
Standalone entry point for running the Kountry Eyecare server.
This is used by PyInstaller to create the executable.
"""
import uvicorn
import os
import sys


def get_base_path():
    """Get the base path for the application"""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


if __name__ == "__main__":
    # Change to the base directory so relative paths work
    base_path = get_base_path()
    os.chdir(base_path)
    
    # Run the server
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        log_level="info"
    )
