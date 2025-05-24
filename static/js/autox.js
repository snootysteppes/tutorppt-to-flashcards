// AutoX JavaScript functionality
const initializeAutoX = () => {
    const elements = {
        dropZone: document.getElementById('drop-zone'),
        fileInput: document.getElementById('file-input'),
        uploadSection: document.getElementById('upload-section'),
        processingSection: document.getElementById('processing-section'),
        resultsSection: document.getElementById('results-section'),
        errorSection: document.getElementById('error-section'),
        slideCount: document.getElementById('slide-count'),
        slideProgress: document.getElementById('slide-progress'),
        flashcardCount: document.getElementById('flashcard-count'),
        currentStatus: document.getElementById('current-status'),
        timeEstimate: document.getElementById('time-estimate'),
        progressRing: document.getElementById('progress-ring'),
        progressPercentage: document.getElementById('progress-percentage'),
        statsEl: document.getElementById('stats'),
        errorMessageEl: document.getElementById('error-message')
    };

    let startTime;
    let currentFlashcards = [];
    let currentCardIndex = 0;
    let processingTimeout;

    const updateProgress = (progress) => {
        const circumference = 2 * Math.PI * 15.9155;
        const offset = circumference - (progress / 100) * circumference;
        elements.progressRing.style.strokeDasharray = `${circumference} ${circumference}`;
        elements.progressRing.style.strokeDashoffset = offset;
        elements.progressPercentage.textContent = `${Math.round(progress)}%`;
    };

    const showProcessingSection = () => {
        elements.uploadSection.classList.add('hidden');
        elements.processingSection.classList.remove('hidden');
        elements.resultsSection.classList.add('hidden');
        elements.errorSection.classList.add('hidden');
        startTime = Date.now();
    };

    const updateProcessingStatus = (status, progress = 0) => {
        elements.currentStatus.textContent = status;
        updateProgress(progress);

        const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
        const timeLeft = Math.floor((elapsedTime / progress) * (100 - progress));
        
        if (progress > 0 && progress < 100) {
            elements.timeEstimate.textContent = `Estimated time remaining: ${timeLeft} seconds`;
        } else {
            elements.timeEstimate.textContent = 'Calculating time remaining...';
        }
    };

    const processFile = async (file) => {
        try {
            showProcessingSection();
            const formData = new FormData();
            formData.append('file', file);

            // Start polling for status updates
            let statusCheckInterval = setInterval(async () => {
                try {
                    const statusResponse = await fetch('/process/status');
                    if (statusResponse.ok) {
                        const status = await statusResponse.json();
                        if (status.current_slide) {
                            elements.slideCount.textContent = `${status.current_slide}/${status.total_slides}`;
                            const slideProgress = (status.current_slide / status.total_slides) * 100;
                            elements.slideProgress.style.width = `${slideProgress}%`;
                        }
                        if (status.status) {
                            updateProcessingStatus(status.status, status.progress || 0);
                        }
                        if (status.flashcard_count) {
                            elements.flashcardCount.textContent = status.flashcard_count;
                        }
                    }
                } catch (error) {
                    console.warn('Status check failed:', error);
                }
            }, 1000);

            const response = await fetch('/process', {
                method: 'POST',
                body: formData
            });

            clearInterval(statusCheckInterval);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to process file');
            }

            const result = await response.json();
            if (result.success) {
                showResults(result);
            } else {
                throw new Error(result.message || 'Processing failed');
            }
        } catch (error) {
            console.error('Error processing file:', error);
            showError(error.message);
        }
    };

const showResults = (result) => {
    elements.processingSection.classList.add('hidden');
    elements.resultsSection.classList.remove('hidden');
    elements.statsEl.textContent = `Generated ${result.count} flashcards from your presentation`;
    
    currentFlashcards = result.flashcards;
    currentCardIndex = 0;
    showCurrentCard();
    updateNavigationButtons();

    // Update URL with flashcard ID for sharing and refresh page
    if (result.flashcard_id) {
        const newUrl = `/flashcards.html?id=${result.flashcard_id}`;
        window.history.pushState({}, '', newUrl);
        // Refresh the page to load flashcards.html with the new id
        window.location.href = newUrl;
    }
};

    const showError = (message) => {
        elements.uploadSection.classList.add('hidden');
        elements.processingSection.classList.add('hidden');
        elements.resultsSection.classList.add('hidden');
        elements.errorSection.classList.remove('hidden');
        elements.errorMessageEl.textContent = message || 'An error occurred while processing your file';
    };

    const showCurrentCard = () => {
        if (!currentFlashcards.length) return;
        
        const card = currentFlashcards[currentCardIndex];
        const [question, answer] = card.split(':');
        
        const questionEl = document.getElementById('current-question');
        const answerEl = document.getElementById('current-answer');
        const counterEl = document.getElementById('card-counter');
        
        questionEl.textContent = question;
        answerEl.textContent = answer;
        counterEl.textContent = `Card ${currentCardIndex + 1} of ${currentFlashcards.length}`;
        
        const flashcard = document.querySelector('.flashcard');
        flashcard.classList.remove('flipped');
    };

    const updateNavigationButtons = () => {
        const prevBtn = document.getElementById('prev-card');
        const nextBtn = document.getElementById('next-card');
        
        prevBtn.disabled = currentCardIndex === 0;
        nextBtn.disabled = currentCardIndex === currentFlashcards.length - 1;
        
        prevBtn.classList.toggle('opacity-50', currentCardIndex === 0);
        nextBtn.classList.toggle('opacity-50', currentCardIndex === currentFlashcards.length - 1);
    };

    const downloadFlashcards = () => {
        const content = currentFlashcards.join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'flashcards.txt';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    // Event Listeners
    elements.dropZone.addEventListener('click', () => elements.fileInput.click());
    elements.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.dropZone.classList.add('drag-over');
    });
    elements.dropZone.addEventListener('dragleave', () => {
        elements.dropZone.classList.remove('drag-over');
    });
    elements.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.dropZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.ppt') || file.name.endsWith('.pptx'))) {
            processFile(file);
        } else {
            showError('Please upload a PowerPoint file (.ppt or .pptx)');
        }
    });

    elements.fileInput.addEventListener('change', () => {
        const file = elements.fileInput.files[0];
        if (file) {
            processFile(file);
        }
    });

    // Flashcard navigation
    document.getElementById('prev-card')?.addEventListener('click', () => {
        if (currentCardIndex > 0) {
            currentCardIndex--;
            showCurrentCard();
            updateNavigationButtons();
        }
    });

    document.getElementById('next-card')?.addEventListener('click', () => {
        if (currentCardIndex < currentFlashcards.length - 1) {
            currentCardIndex++;
            showCurrentCard();
            updateNavigationButtons();
        }
    });

    // Flashcard flip
    const flashcard = document.querySelector('.flashcard');
    if (flashcard) {
        flashcard.addEventListener('click', () => {
            flashcard.classList.toggle('flipped');
        });
    }

    // Download button
    document.getElementById('download-btn')?.addEventListener('click', downloadFlashcards);

    // Convert another / try again buttons
    document.getElementById('convert-another-btn')?.addEventListener('click', () => {
        elements.uploadSection.classList.remove('hidden');
        elements.resultsSection.classList.add('hidden');
        elements.fileInput.value = '';
        currentFlashcards = [];
        currentCardIndex = 0;
        startTime = null;
    });

    document.getElementById('try-again-btn')?.addEventListener('click', () => {
        elements.uploadSection.classList.remove('hidden');
        elements.errorSection.classList.add('hidden');
        elements.fileInput.value = '';
        startTime = null;
    });
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeAutoX);
