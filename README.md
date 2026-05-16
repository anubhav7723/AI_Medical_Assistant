# 🩺 MediTalk – AI Medical Assistant

MediTalk is an AI-powered medical assistant platform that helps users analyze medical reports, understand health conditions, and receive AI-generated medical insights in a simple and interactive way.

The platform combines Machine Learning, Generative AI, OCR, and Retrieval-Augmented Generation (RAG) to process medical documents and provide meaningful health summaries and recommendations.

---

# 🚀 Features

## 📄 Medical Report Analysis
- Upload medical reports in image or PDF format
- Extract medical text using OCR
- Detect important medical parameters automatically
- Generate simplified medical summaries

## 🤖 AI-Powered Health Assistant
- Interactive chatbot for health-related queries
- Context-aware AI responses
- Personalized health insights based on uploaded reports
- Medical explanation in easy-to-understand language

## 🧠 Generative AI + RAG
- Uses Retrieval-Augmented Generation (RAG)
- Retrieves medical context before generating responses
- Improves accuracy and relevance of answers
- Supports medical knowledge-based conversations

## 📊 Health Insights Dashboard
- Visual representation of health metrics
- Displays report analysis results
- Easy-to-read medical indicators
- Future-ready for health tracking features

## 🔒 Secure & Scalable
- FastAPI backend architecture
- Optimized API handling
- Scalable frontend-backend integration
- Modular AI pipeline

---

# 🛠️ Tech Stack

## Frontend
- React.js
- Tailwind CSS
- Axios
- HTML5
- CSS3
- JavaScript

## Backend
- FastAPI
- Python
- Uvicorn
- REST APIs

## AI / ML / GenAI
- OpenAI API / LLMs
- LangChain
- FAISS Vector Database
- RAG Pipeline
- OCR Processing
- NLP

## Database & Storage
- FAISS
- Local Storage / Cloud Storage

---

# 📂 Project Structure

```bash
MediTalk/
│
├── backend/
│   ├── main.py
│   ├── routes/
│   ├── models/
│   ├── services/
│   ├── utils/
│   ├── uploads/
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── components/
│   ├── pages/
│   └── package.json
│
├── vector_db/
├── README.md
└── .env
```

---

# ⚙️ Installation & Setup

## 1️⃣ Clone the Repository

```bash
git clone https://github.com/anubhav7723/AI_Medical_Assistant.git
cd MediTalk
```

---

## 2️⃣ Backend Setup

### Create Virtual Environment

```bash
python -m venv venv
```

### Activate Virtual Environment

#### Windows

```bash
venv\Scripts\activate
```

#### Mac/Linux

```bash
source venv/bin/activate
```

### Install Dependencies

```bash
pip install -r requirements.txt
```

### Run Backend Server

```bash
uvicorn main:app --reload
```

Backend will run on:

```bash
http://127.0.0.1:8000
```

---

## 3️⃣ Frontend Setup

### Navigate to Frontend Folder

```bash
cd frontend
```

### Install Dependencies

```bash
npm install
```


# 🔑 Environment Variables

Create a `.env` file in the backend folder.

```env
OPENAI_API_KEY=your_api_key
LANGCHAIN_API_KEY=your_langchain_key
```

---

# 🧠 How MediTalk Works

## Step 1 – Upload Medical Report
User uploads a medical report in image or PDF format.

## Step 2 – OCR Processing
OCR extracts text and medical values from the report.

## Step 3 – AI Analysis
The AI model processes:
- Medical parameters
- Symptoms
- Health indicators
- Report context

## Step 4 – RAG Retrieval
Relevant medical knowledge is retrieved from the vector database.

## Step 5 – AI Response Generation
LLM generates:
- Medical summary
- Health explanation
- Recommendations
- Insights

---

# 🔥 Future Improvements

- Voice-enabled AI medical assistant
- Real-time doctor consultation integration
- Multi-language support
- Wearable health device integration
- Advanced health analytics
- User authentication system
- Cloud deployment optimization
- Appointment booking system

---

# 🎯 Use Cases

- Medical report understanding
- AI-based healthcare assistance
- Patient health monitoring
- Simplified medical insights
- Medical education support
- Healthcare accessibility

---

# 🧪 API Endpoints

## Upload Report

```http
POST /upload
```

## Analyze Report

```http
POST /analyze
```

## Chat with AI

```http
POST /chat
```

---

# 📈 Advantages of MediTalk

- Simplifies complex medical reports
- Reduces confusion for patients
- Fast AI-powered analysis
- User-friendly interface
- Intelligent health insights
- Scalable AI architecture

---

# 🤝 Contributing

Contributions are welcome.

## Steps to Contribute

1. Fork the repository
2. Create a new branch
3. Commit your changes
4. Push to your branch
5. Create a Pull Request

---

# 👨‍💻 Author

## Anubhav Gupta
AI/ML Developer | GenAI Enthusiast

---

# ⭐ Support

If you like this project, give it a ⭐ on GitHub and support the development of AI-powered healthcare solutions.