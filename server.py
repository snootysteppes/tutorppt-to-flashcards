# OVERWRITE_CONFIRM=true

import os
import uuid
import time
import logging
import json
import os
from datetime import datetime
import requests
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from pptx import Presentation
import fitz  # PyMuPDF for PDF text extraction

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('tutorx')
handler = logging.FileHandler('tutorx.log')
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
logger.addHandler(handler)

app = Flask(__name__, static_folder='static')
CORS(app)

# Create necessary directories
STATIC_DIR = 'static'
ASSETS_DIR = os.path.join(STATIC_DIR, 'assets')
TEMP_DIR = 'temp'
for directory in [STATIC_DIR, ASSETS_DIR, TEMP_DIR]:
    os.makedirs(directory, exist_ok=True)

# Global processing status
processing_status = {
    'status': None,
    'progress': 0,
    'current_slide': 0,
    'total_slides': 0,
    'current_chunk': 0,
    'total_chunks': 0,
    'flashcard_count': 0,
    'error': None
}

# OpenRouter API configuration
API_CONFIG = {
    'url': 'https://openrouter.ai/api/v1/chat/completions',
    'key': os.getenv('apikey', ''),  # Use environment variable 'apikey'
    'model': 'mistralai/mistral-7b-instruct:free'  # Changed to a more reliable model
}

def update_status(status=None, progress=None, current_slide=None, total_slides=None, 
                 current_chunk=None, total_chunks=None, flashcard_count=None, error=None):
    """Update the global processing status"""
    global processing_status
    if status is not None:
        processing_status['status'] = status
    if progress is not None:
        processing_status['progress'] = progress
    if current_slide is not None:
        processing_status['current_slide'] = current_slide
    if total_slides is not None:
        processing_status['total_slides'] = total_slides
    if current_chunk is not None:
        processing_status['current_chunk'] = current_chunk
    if total_chunks is not None:
        processing_status['total_chunks'] = total_chunks
    if flashcard_count is not None:
        processing_status['flashcard_count'] = flashcard_count
    if error is not None:
        processing_status['error'] = error
    logger.info(f"Status updated: {processing_status}")

def get_api_headers():
    """Get headers for OpenRouter API requests"""
    return {
        'Authorization': f'Bearer {API_CONFIG["key"]}',
        'Content-Type': 'application/json',
        'HTTP-Referer': request.host_url,
        'X-Title': 'TutorX'
    }

def chunk_text(text, chunk_size=15000):  # Reduced chunk size for better reliability
    """Split text into chunks of approximately equal size."""
    words = text.split()
    chunks = []
    current_chunk = []
    current_length = 0
    
    for word in words:
        if current_length + len(word) > chunk_size:
            chunks.append(' '.join(current_chunk))
            current_chunk = [word]
            current_length = len(word)
        else:
            current_chunk.append(word)
            current_length += len(word) + 1
            
    if current_chunk:
        chunks.append(' '.join(current_chunk))
    return chunks

def generate_flashcards(text, slide_count):
    """Generate flashcards using OpenRouter API with multiple requests for longer content"""
    try:
        chunks = chunk_text(text)
        all_flashcards = []
        cards_per_chunk = max(3, min(10, slide_count // len(chunks)))  # Reduced cards per chunk
        
        update_status(
            status="Starting flashcard generation",
            progress=0,
            current_chunk=0,
            total_chunks=len(chunks),
            flashcard_count=0
        )
        
        for i, chunk in enumerate(chunks, 1):
            update_status(
                status=f"Processing chunk {i}/{len(chunks)}",
                progress=(i-1) * 100 // len(chunks),
                current_chunk=i
            )
            
            prompt = f"""Create {cards_per_chunk} educational flashcards from this content. Each flashcard should have a question and answer separated by a colon.

Content:
{chunk}

Format: One flashcard per line, with question and answer separated by a colon.
Example:
What is the powerhouse of the cell?:Mitochondria
What is photosynthesis?:The process by which plants convert sunlight into energy

Create {cards_per_chunk} flashcards now:"""

            payload = {
                'model': API_CONFIG['model'],
                'messages': [
                    {
                        'role': 'system',
                        'content': 'You are a teacher creating educational flashcards. Format: question:answer'
                    },
                    {'role': 'user', 'content': prompt}
                ],
                'temperature': 0.7,
                'max_tokens': 1000
            }

            max_retries = 3
            retry_delay = 2
            
            for attempt in range(max_retries):
                try:
                    logger.info(f"Processing chunk {i}/{len(chunks)} (attempt {attempt + 1}/{max_retries})")
                    response = requests.post(
                        API_CONFIG['url'],
                        headers=get_api_headers(),
                        json=payload,
                        timeout=30
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        # Log the full API response for debugging
                        logger.info(f"Full API response: {json.dumps(result)}")
                        if result.get('choices'):
                            content = result['choices'][0]['message']['content'].strip()
                            chunk_cards = []
                            
                            # Log the raw API response content for debugging
                            logger.info(f"API Response content: {content}")
                            
                            for line in content.split('\n'):
                                line = line.strip()
                                if ':' in line and not line.startswith('```'):
                                    # Additional validation
                                    parts = line.split(':', 1)
                                    if len(parts) == 2 and all(part.strip() for part in parts):
                                        chunk_cards.append(line)
                            
                            if chunk_cards:
                                all_flashcards.extend(chunk_cards)
                                update_status(
                                    flashcard_count=len(all_flashcards),
                                    progress=i * 100 // len(chunks)
                                )
                                break
                            else:
                                logger.error(f"No valid flashcards found in chunk {i} response")
                                if attempt < max_retries - 1:
                                    continue
                        else:
                            logger.error(f"No choices in API response for chunk {i}")
                            if attempt < max_retries - 1:
                                continue
                    else:
                        logger.error(f"API Error for chunk {i}: {response.status_code} - {response.text}")
                        if attempt < max_retries - 1:
                            update_status(status=f"Retrying chunk {i} (attempt {attempt + 2}/{max_retries})")
                            time.sleep(retry_delay)
                            retry_delay *= 2
                            continue
                        
                except requests.exceptions.RequestException as e:
                    logger.error(f"Request failed for chunk {i}: {str(e)}")
                    if attempt < max_retries - 1:
                        update_status(status=f"Retrying chunk {i} (attempt {attempt + 2}/{max_retries})")
                        time.sleep(retry_delay)
                        retry_delay *= 2
                        continue
                    raise

        if not all_flashcards:
            raise Exception("The server is busy, try again in ~15m")

        update_status(
            status="Flashcard generation complete",
            progress=100,
            flashcard_count=len(all_flashcards)
        )
        
        logger.info(f"Successfully generated {len(all_flashcards)} total flashcards")
        return all_flashcards

    except Exception as e:
        logger.error(f"Unexpected error in generate_flashcards: {str(e)}")
        update_status(error=str(e))
        return None

def extract_text_from_pptx(file_path):
    """Extract text from PowerPoint slides"""
    try:
        logger.info(f"Opening PowerPoint file: {file_path}")
        prs = Presentation(file_path)
        text_content = []
        slide_count = len(prs.slides)
        
        update_status(
            status="Starting PowerPoint extraction",
            total_slides=slide_count,
            current_slide=0
        )
        
        for i, slide in enumerate(prs.slides, 1):
            update_status(
                status=f"Processing slide {i}/{slide_count}",
                current_slide=i
            )
            
            slide_text = []
            logger.info(f"Processing slide {i}/{slide_count}")
            
            if slide.shapes.title and slide.shapes.title.text.strip():
                title_text = slide.shapes.title.text.strip()
                slide_text.append(f"Title: {title_text}")
            
            for shape in slide.shapes:
                if hasattr(shape, "text") and shape.text.strip():
                    text = shape.text.strip()
                    if text not in slide_text:
                        slide_text.append(text)
            
            if slide_text:
                text_content.append("\n".join(slide_text))
        
        full_text = "\n\n".join(text_content)
        logger.info(f"Total extracted text length: {len(full_text)} characters")
        
        if not full_text.strip():
            raise Exception("No text content found in the PowerPoint file")
            
        return full_text, slide_count
        
    except Exception as e:
        logger.error(f"PowerPoint extraction error: {str(e)}")
        update_status(error=str(e))
        return None, 0

def save_flashcards_txt(flashcards, filename):
    """Save flashcards to a text file"""
    try:
        update_status(status="Saving flashcards")
        flashcard_id = str(uuid.uuid4())
        output_path = os.path.join(ASSETS_DIR, f'flashcards_{flashcard_id}.txt')
        
        with open(output_path, 'w') as f:
            f.write('\n'.join(flashcards))
            
        logger.info(f"Saved {len(flashcards)} flashcards to {output_path}")
        return flashcard_id
        
    except Exception as e:
        logger.error(f"Error saving flashcards: {str(e)}")
        update_status(error=str(e))
        return None

@app.route('/')
def index():
    """Serve the landing page"""
    return send_from_directory('.', 'index.html')

@app.route('/autox.html')
def autox():
    """Serve the AutoX page"""
    return send_from_directory('.', 'autox.html')

@app.route('/flashcards.html')
def flashcards():
    """Serve the flashcards page"""
    return send_from_directory('.', 'flashcards.html')

@app.route('/process/status')
def get_status():
    """Get the current processing status"""
    return jsonify(processing_status)

@app.route('/process', methods=['POST'])
def process_powerpoint():
    # Reset processing status
    global processing_status
    processing_status = {
        'status': None,
        'progress': 0,
        'current_slide': 0,
        'total_slides': 0,
        'current_chunk': 0,
        'total_chunks': 0,
        'flashcard_count': 0,
        'error': None
    }

    if 'file' not in request.files:
        logger.error("No file provided in request")
        return jsonify({
            'error': 'No file provided',
            'message': 'Please upload a PowerPoint or PDF file'
        }), 400

    file = request.files['file']
    if not file.filename.endswith(('.ppt', '.pptx', '.pdf')):
        logger.error(f"Invalid file format: {file.filename}")
        return jsonify({
            'error': 'Invalid file format',
            'message': 'Please upload a .ppt, .pptx, or .pdf file'
        }), 400

    temp_path = os.path.join(TEMP_DIR, f"{uuid.uuid4()}_{file.filename}")
    logger.info(f"Saving uploaded file to {temp_path}")
    file.save(temp_path)

    try:
        if file.filename.endswith(('.ppt', '.pptx')):
            logger.info("Starting PowerPoint text extraction")
            text_content, slide_count = extract_text_from_pptx(temp_path)
            if not text_content:
                logger.error("No text content extracted from PowerPoint")
                return jsonify({
                    'error': 'Extraction failed',
                    'message': 'Could not extract text from the PowerPoint file'
                }), 400
        elif file.filename.endswith('.pdf'):
            logger.info("Starting PDF text extraction")
            text_content, slide_count = extract_text_from_pdf(temp_path)
            if not text_content:
                logger.error("No text content extracted from PDF")
                return jsonify({
                    'error': 'Extraction failed',
                    'message': 'Could not extract text from the PDF file'
                }), 400
        else:
            logger.error(f"Unsupported file format: {file.filename}")
            return jsonify({
                'error': 'Unsupported file format',
                'message': 'Please upload a supported file type'
            }), 400

        logger.info("Starting flashcard generation")
        flashcards = generate_flashcards(text_content, slide_count)
        if not flashcards:
            logger.error("Flashcard generation failed")
            return jsonify({
                'error': 'Generation failed',
                'message': processing_status.get('error', 'Failed to generate flashcards from the content')
            }), 500

        logger.info("Saving generated flashcards")
        flashcard_id = save_flashcards_txt(flashcards, file.filename)
        if not flashcard_id:
            logger.error("Failed to save flashcards")
            return jsonify({
                'error': 'Save failed',
                'message': 'Failed to save generated flashcards'
            }), 500

        return jsonify({
            'success': True,
            'flashcard_id': flashcard_id,
            'count': len(flashcards),
            'flashcards': flashcards,
            'share_link': f'/flashcards.html?id={flashcard_id}'
        })

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return jsonify({
            'error': 'Processing failed',
            'message': str(e)
        }), 500

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
            logger.info(f"Cleaned up temporary file: {temp_path}")

@app.route('/static/<path:filename>')
def serve_static(filename):
    """Serve static files"""
    return send_from_directory('static', filename)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)
