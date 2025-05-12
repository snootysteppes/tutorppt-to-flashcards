
Built by https://www.blackbox.ai

---

# TutorX

## Project Overview
TutorX is a web application that transforms PowerPoint presentations into interactive flashcards using AI-driven content extraction and question generation. It is designed for students, teachers, and lifelong learners who want to enhance their studying experience by converting presentation content into engaging and effective learning materials.

## Installation

To run TutorX locally, follow these steps:

1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/tutorx.git
   cd tutorx
   ```

2. **Install Required Python Packages**
   Make sure you have Python 3.6 or later installed. Install the required libraries using pip:
   ```bash
   pip install Flask flask-cors python-pptx requests
   ```

3. **Run the Application**
   You can start the Flask web server by running:
   ```bash
   python server.py
   ```
   The application should now be running on `http://localhost:8000`.

## Usage

Once the application is running, open your browser and navigate to `http://localhost:8000`. You will be greeted with the home page where you can upload PowerPoint files.

### How to Convert PowerPoints to Flashcards

1. Click on the **Start Converting** button on the home page.
2. Drag and drop your PowerPoint file or use the upload button to select a file.
3. The application will process your file, extract the text, and generate flashcards.
4. Once the process is completed, you can view, navigate, and download your generated flashcards.

## Features

- **Instant Conversion**: Upload your PowerPoint and get flashcards in seconds.
- **AI-Powered**: Smart algorithms extract key concepts and create effective question-answer pairs.
- **Easy Export**: Download your generated flashcards in a simple text format.
- **Progress Tracking**: Monitor the status of your conversion in real time.

## Dependencies

Here is a list of the essential dependencies for this project:
- `Flask`: A web framework for Python.
- `flask-cors`: A Flask extension for enabling Cross-Origin Resource Sharing.
- `requests`: A simple HTTP library for Python.
- `python-pptx`: A library for creating and manipulating PowerPoint (.pptx) files.

To see all dependencies, you can refer to the `requirements.txt` file or the `setup.py` file if provided.

## Project Structure

The project directory contains the following files:

```
tutorx/
│
├── static/                   # Contains static files (CSS, JS, images)
│   ├── assets/               # Flashcard text files
│   └── js/                   # JavaScript files for dynamic behavior
│
├── templates/                # HTML templates for the application
│   ├── index.html            # Main landing page
│   ├── autox.html            # PowerPoint upload page
│   └── flashcards.html       # Flashcard display page
│
├── server.py                 # Main application code with Flask setup
└── tutorx.log                # Log file for tracking application events
```

Using this structure allows for organization of assets while providing a clean interface for interacting with the functionality of the application.

## Contributing

If you would like to contribute to TutorX, please fork the repository and submit a pull request. Any contributions, bug reports, or feature requests are welcome.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.