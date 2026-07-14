import uvicorn
from main import app

# Hugging Face runs Spaces on port 7860
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)