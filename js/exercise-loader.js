// Exercise Loader - Loads exercises from JSON and displays them dynamically

// Global variables
let allExercises = [];
let filteredExercises = [];
let currentFilters = {
    difficulty: 'all',
    topic: 'all',
    search: ''
};
// User Profile Functions
function getUserName() {
    let userName = localStorage.getItem('userName');
    if (!userName) {
        userName = prompt('Welcome! Please enter your name:') || 'Guest';
        localStorage.setItem('userName', userName);
    }
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        userNameElement.textContent = userName;
    }
    return userName;
}

function changeUserName() {
    const newName = prompt('Enter your name:');
    if (newName && newName.trim()) {
        localStorage.setItem('userName', newName.trim());
        document.getElementById('userName').textContent = newName.trim();
        if (window.mainUtils && window.mainUtils.showNotification) {
            window.mainUtils.showNotification(`Welcome, ${newName.trim()}!`, 'success');
        }
    }
}
// Password for solutions (same as before)
const SOLUTION_PASSWORD = 'ronanIsTheBest';
let passwordVerified = false;

// Load exercises from JSON when page loads
document.addEventListener('DOMContentLoaded', async function() {
     getUserName();
    await loadExercises();
    initializeFilters();
    initializeSearch();
    applyFilters();
    updateProgressBar(); // Update progress bar on load
});

// Load exercises from JSON file
async function loadExercises() {
    try {
        const response = await fetch('data/exercises.json');
        const data = await response.json();
        allExercises = data.exercises;
        filteredExercises = [...allExercises];
        console.log(`Loaded ${allExercises.length} exercises`);
    } catch (error) {
        console.error('Error loading exercises:', error);
        showError('Failed to load exercises. Please refresh the page.');
    }
}
async function getAIHint(exerciseId) {
    const exercise = allExercises.find(e => e.id === exerciseId);
    const userCode = document.getElementById(`code-${exerciseId}`).value;
    
    if (!userCode.trim()) {
        window.mainUtils.showNotification('Write some code first to get a personalized hint!', 'info');
        return;
    }
    
    // Show loading state
    const hintBox = document.getElementById(`hint-${exerciseId}`);
    hintBox.innerHTML = '<div class="loading-feedback"><div class="spinner"></div><p>🤖 AI is analyzing your code...</p></div>';
    hintBox.classList.add('show');
    
    try {
        const response = await fetch('/api/get-hint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                exerciseId: exerciseId,
                userCode: userCode,
                problemDescription: exercise.description,
                hints: exercise.hints
            })
        });
        
        const data = await response.json();
        
        hintBox.innerHTML = `
            <h5>🤖 AI Hint:</h5>
            <p>${data.hint}</p>
            ${data.encouragement ? `<p style="color: var(--success); margin-top: 0.5rem;">💪 ${data.encouragement}</p>` : ''}
        `;
        
    } catch (error) {
        hintBox.innerHTML = '<p>❌ Failed to get AI hint. Try the regular hints!</p>';
    }
}
// Submit solution to AI for checking
async function submitSolution(exerciseId) {
    const exercise = allExercises.find(e => e.id === exerciseId);
    const userCode = document.getElementById(`code-${exerciseId}`).value;
    
    if (!userCode.trim()) {
        if (window.mainUtils && window.mainUtils.showNotification) {
            window.mainUtils.showNotification('Please write some code before submitting!', 'error');
        } else {
            alert('Please write some code before submitting!');
        }
        return;
    }
    
    // Show loading state
    const feedbackSection = document.getElementById(`feedback-${exerciseId}`);
    const submitBtn = document.getElementById(`submit-btn-${exerciseId}`);
    
    feedbackSection.innerHTML = `
        <div class="loading-feedback">
            <div class="spinner"></div>
            <p>🤖 AI is analyzing your code...</p>
        </div>
    `;
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Checking...';
    
    try {
        // Determine the API URL based on environment
        const apiUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000/api/check-solution'
            : '/api/check-solution';
            
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                exerciseId: exerciseId,
                userCode: userCode,
                expectedSolution: exercise.solution.code,
                problemDescription: exercise.description,
                maxPoints: exercise.points,
                difficulty: exercise.difficulty,
                userName: getUserName()
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to check solution');
        }
        
        const result = await response.json();
        displayFeedback(exerciseId, result);
        
        // Save the submission
        saveSubmission(exerciseId, userCode, result.score, exercise.points);
        
    } catch (error) {
        console.error('Error submitting solution:', error);
        feedbackSection.innerHTML = `
            <div class="error-feedback">
                <p>❌ Failed to check solution. Please try again.</p>
            </div>
        `;
        
        if (window.mainUtils && window.mainUtils.showNotification) {
            window.mainUtils.showNotification('Failed to check solution. Please try again.', 'error');
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Solution';
    }
}

// Display AI feedback
function displayFeedback(exerciseId, result) {
    const feedbackSection = document.getElementById(`feedback-${exerciseId}`);
    const exercise = allExercises.find(e => e.id === exerciseId);
    
    // Determine feedback class based on percentage
    const percentage = result.percentage || Math.round((result.score / exercise.points) * 100);
    let feedbackClass = 'error';
    let emoji = '😅';
    if (percentage >= 80) {
        feedbackClass = 'success';
        emoji = '🎉';
    } else if (percentage >= 60) {
        feedbackClass = 'warning';
        emoji = '💪';
    }
    
    feedbackSection.innerHTML = `
        <div class="ai-feedback ${feedbackClass}">
            <div class="feedback-header">
                <h4>${emoji} AI Feedback</h4>
                <div class="score-display">
                    <span class="score-label">Score:</span>
                    <span class="score-value">${result.score}/${result.maxScore || exercise.points}</span>
                    <span class="score-percentage">(${percentage}%)</span>
                </div>
            </div>
            
            <div class="feedback-content">
                ${result.strengths ? `
                    <div class="feedback-section">
                        <h5>✅ What you did well:</h5>
                        <p>${result.strengths}</p>
                    </div>
                ` : ''}
                
                ${result.issues ? `
                    <div class="feedback-section">
                        <h5>⚠️ Issues found:</h5>
                        <p>${result.issues}</p>
                    </div>
                ` : ''}
                
                ${result.suggestions ? `
                    <div class="feedback-section">
                        <h5>💡 Suggestions for improvement:</h5>
                        <p>${result.suggestions}</p>
                    </div>
                ` : ''}
            </div>
            
            <div class="feedback-actions">
                ${percentage >= 80 ? `
                    <button class="btn btn-success" onclick="exerciseFunctions.markExerciseCompleted(${exerciseId})">
                        ✓ Mark as Complete
                    </button>
                ` : `
                    <button class="btn btn-primary" onclick="document.getElementById('code-${exerciseId}').focus()">
                        Try Again
                    </button>
                `}
            </div>
        </div>
    `;
    
    // Show notification
    if (window.mainUtils && window.mainUtils.showNotification) {
        if (percentage >= 80) {
            window.mainUtils.showNotification('Great job! Your solution is excellent!', 'success');
        } else if (percentage >= 60) {
            window.mainUtils.showNotification('Good effort! Check the feedback for improvements.', 'info');
        } else {
            window.mainUtils.showNotification('Keep trying! Review the feedback and try again.', 'warning');
        }
    }
}

// Save submission to localStorage
function saveSubmission(exerciseId, code, score, maxScore) {
    const submissions = JSON.parse(localStorage.getItem('codeSubmissions') || '{}');
    
    if (!submissions[exerciseId]) {
        submissions[exerciseId] = [];
    }
    
    submissions[exerciseId].push({
        code: code,
        score: score,
        maxScore: maxScore,
        percentage: Math.round((score / maxScore) * 100),
        timestamp: new Date().toISOString()
    });
    
    // Keep only last 5 submissions per exercise
    if (submissions[exerciseId].length > 5) {
        submissions[exerciseId] = submissions[exerciseId].slice(-5);
    }
    
    localStorage.setItem('codeSubmissions', JSON.stringify(submissions));
}

// Get last submission for an exercise
function getLastSubmission(exerciseId) {
    const submissions = JSON.parse(localStorage.getItem('codeSubmissions') || '{}');
    const exerciseSubmissions = submissions[exerciseId] || [];
    return exerciseSubmissions[exerciseSubmissions.length - 1] || null;
}

// Create HTML for a single exercise card
function createExerciseCard(exercise) {
    // Check if this exercise is completed
    const completedExercises = getCompletedExercises();
    const isCompleted = completedExercises.includes(exercise.id);
    
    // Get last submission if exists
    const lastSubmission = getLastSubmission(exercise.id);
    
    // Add completed badge if needed
    const completedBadge = isCompleted ? '<span class="completed-badge">✓ Completed</span>' : '';
    
    // Generate hints HTML
    const hintsHTML = exercise.hints.map((hint, index) => 
        `<p>💡 ${hint}</p>`
    ).join('');
    
    // Generate examples HTML
    const examplesHTML = exercise.examples.map((example, index) => `
        <div class="example-io">
            <div class="io-box">
                <h5>Example Input</h5>
                <pre><code>${example.input}</code></pre>
            </div>
            <div class="io-box">
                <h5>Expected Output</h5>
                <pre><code>${example.output}</code></pre>
            </div>
        </div>
    `).join('');
    
    // Create the card HTML
    return `
        <div class="exercise-card ${isCompleted ? 'completed' : ''}" data-difficulty="${exercise.difficulty}" data-topic="${exercise.topic}" data-id="${exercise.id}">
            <div class="exercise-header">
                <h3 class="exercise-title">Exercise ${exercise.id}: ${exercise.title}</h3>
                ${completedBadge}
                <div class="exercise-meta">
                    <span class="difficulty-indicator ${exercise.difficulty}">${exercise.difficulty.toUpperCase()}</span>
                    <span class="topic-indicator">${exercise.topic}</span>
                    <span class="points-indicator">${exercise.points} pts</span>
                </div>
            </div>
            
            <div class="exercise-description">
                <p>${exercise.description}</p>
            </div>
            
            <div class="code-section">
                <h4>Struct Definition</h4>
                <pre><code class="language-c">${highlightCode(exercise.structDefinition.code)}</code></pre>
            </div>
            
            ${examplesHTML}
            
            <div class="exercise-actions">
                            <button class="btn btn-primary" onclick="exerciseFunctions.toggleHint(${exercise.id})">
                    <span id="hint-btn-${exercise.id}">Show Hint</span>
                </button>
                <button class="btn btn-primary" onclick="exerciseFunctions.getAIHint(${exercise.id})">
                    🤖 Get AI Hint
                </button>
                <button class="btn btn-primary solution-toggle" onclick="exerciseFunctions.toggleSolution(${exercise.id})">
                    <span id="solution-btn-${exercise.id}">Show Solution 🔒</span>
                </button>
                <button class="btn btn-success mark-complete-btn ${isCompleted ? 'completed' : ''}" 
                        onclick="exerciseFunctions.markExerciseCompleted(${exercise.id})" 
                        id="complete-btn-${exercise.id}">
                    ${isCompleted ? '✓ Completed' : '✓ Mark Complete'}
                </button>
            </div>
            
            <div class="hint-box" id="hint-${exercise.id}">
                ${hintsHTML}
            </div>
            
            <div class="solution-box" id="solution-${exercise.id}">
                <h4>Solution:</h4>
                <pre><code class="language-c">${highlightCode(exercise.solution.code)}</code></pre>
            </div>
            
            <div class="code-submission">
                <h4>Your Solution:</h4>
                <textarea 
                    id="code-${exercise.id}" 
                    class="code-editor" 
                    placeholder="// Write your C code here...\n// Start by defining the struct as shown above"
                >${lastSubmission ? lastSubmission.code : ''}</textarea>
                <button 
                    class="btn submit-solution-btn" 
                    id="submit-btn-${exercise.id}"
                    onclick="submitSolution(${exercise.id})">
                    Submit Solution
                </button>
                ${lastSubmission ? `
                    <span class="last-score">Last score: ${lastSubmission.score}/${lastSubmission.maxScore} (${lastSubmission.percentage}%)</span>
                ` : ''}
            </div>
            
            <div class="feedback-section" id="feedback-${exercise.id}"></div>
        </div>
    `;
}

// Simple syntax highlighting for C code
function highlightCode(code) {
    return code
        .replace(/\b(typedef|struct|int|char|bool|void|for|while|if|else|return|break|true|false)\b/g, '<span class="keyword">$1</span>')
        .replace(/\b(Point|Character|Rectangle|CollisionResult)\b/g, '<span class="type">$1</span>')
        .replace(/\b(findClosest|battle|checkCollision)\b/g, '<span class="function">$1</span>')
        .replace(/\/\/.*$/gm, '<span class="comment">$&</span>')
        .replace(/\/\*[\s\S]*?\*\//g, '<span class="comment">$&</span>')
        .replace(/\b(\d+)\b/g, '<span class="number">$1</span>')
        .replace(/"([^"]*)"/g, '<span class="string">"$1"</span>');
}

// Initialize filter buttons
function initializeFilters() {
    const filterBadges = document.querySelectorAll('[data-filter]');
    
    filterBadges.forEach(badge => {
        badge.addEventListener('click', function() {
            const filterType = this.dataset.filter;
            const filterValue = this.dataset.value;
            
            // Update active state
            document.querySelectorAll(`[data-filter="${filterType}"]`).forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            
            // Update current filters
            currentFilters[filterType] = filterValue;
            
            // Apply filters
            applyFilters();
        });
    });
}

// Initialize search
function initializeSearch() {
    const searchInput = document.getElementById('searchInput');
    
    searchInput.addEventListener('input', function(e) {
        currentFilters.search = e.target.value.toLowerCase();
        applyFilters();
    });
}

// Apply all filters
function applyFilters() {
    filteredExercises = allExercises.filter(exercise => {
        // Difficulty filter
        if (currentFilters.difficulty !== 'all' && exercise.difficulty !== currentFilters.difficulty) {
            return false;
        }
        
        // Topic filter
        if (currentFilters.topic !== 'all' && exercise.topic !== currentFilters.topic) {
            return false;
        }
        
        // Search filter
        if (currentFilters.search) {
            const searchTerm = currentFilters.search;
            const matchesSearch = 
                exercise.title.toLowerCase().includes(searchTerm) ||
                exercise.description.toLowerCase().includes(searchTerm) ||
                exercise.topic.toLowerCase().includes(searchTerm);
            
            if (!matchesSearch) {
                return false;
            }
        }
        
        return true;
    });
    
    displayExercises();
    updateStats();
}

// Display filtered exercises
function displayExercises() {
    const exercisesGrid = document.getElementById('exercisesGrid');
    const noResults = document.getElementById('noResults');
    
    if (filteredExercises.length > 0) {
        // Create HTML for all filtered exercises
        const exercisesHTML = filteredExercises.map(exercise => createExerciseCard(exercise)).join('');
        exercisesGrid.innerHTML = exercisesHTML;
        noResults.style.display = 'none';
    } else {
        exercisesGrid.innerHTML = '';
        noResults.style.display = 'block';
    }
}

// Update statistics
function updateStats() {
    document.getElementById('totalExercises').textContent = allExercises.length;
    document.getElementById('showingExercises').textContent = filteredExercises.length;
    
    // Update completed count
    const completed = getCompletedExercises();
    document.getElementById('completedExercises').textContent = completed.length;
}

// Get completed exercises from localStorage
function getCompletedExercises() {
    const completed = localStorage.getItem('completedExercises');
    return completed ? JSON.parse(completed) : [];
}

// Mark exercise as completed
function markExerciseCompleted(exerciseId) {
    const completed = getCompletedExercises();
    const btn = document.getElementById(`complete-btn-${exerciseId}`);
    const card = document.querySelector(`[data-id="${exerciseId}"]`);
    
    if (!completed.includes(exerciseId)) {
        completed.push(exerciseId);
        localStorage.setItem('completedExercises', JSON.stringify(completed));
        
        // Update button
        if (btn) {
            btn.textContent = '✓ Completed';
            btn.classList.add('completed');
        }
        
        // Update card
        if (card) {
            card.classList.add('completed');
            // Add completed badge if it doesn't exist
            const header = card.querySelector('.exercise-header');
            if (!header.querySelector('.completed-badge')) {
                const titleElement = header.querySelector('.exercise-title');
                titleElement.insertAdjacentHTML('afterend', '<span class="completed-badge">✓ Completed</span>');
            }
        }
        
        updateStats();
        updateProgressBar();
        
        // Show notification if available
        if (window.mainUtils && window.mainUtils.showNotification) {
            window.mainUtils.showNotification('Exercise marked as completed!', 'success');
        }
    } else {
        // Toggle uncomplete
        const index = completed.indexOf(exerciseId);
        completed.splice(index, 1);
        localStorage.setItem('completedExercises', JSON.stringify(completed));
        
        // Update button
        if (btn) {
            btn.textContent = '✓ Mark Complete';
            btn.classList.remove('completed');
        }
        
        // Update card
        if (card) {
            card.classList.remove('completed');
            // Remove completed badge
            const badge = card.querySelector('.completed-badge');
            if (badge) {
                badge.remove();
            }
        }
        
        updateStats();
        updateProgressBar();
        
        // Show notification if available
        if (window.mainUtils && window.mainUtils.showNotification) {
            window.mainUtils.showNotification('Exercise marked as incomplete', 'info');
        }
    }
}

// Update progress bar
function updateProgressBar() {
    const total = allExercises.length;
    const completed = getCompletedExercises().length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    // Update progress bar
    const progressBar = document.querySelector('.progress-bar-fill');
    const progressText = document.querySelector('.progress-text');
    
    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
    }
    
    if (progressText) {
        progressText.textContent = `${percentage}% Complete`;
    }
}

// Clear all progress
function clearProgress() {
    if (confirm('Are you sure you want to clear all progress? This cannot be undone.')) {
        localStorage.removeItem('completedExercises');
        localStorage.removeItem('codeSubmissions');
        passwordVerified = false; // Reset password verification too
        
        // Show notification if available
        if (window.mainUtils && window.mainUtils.showNotification) {
            window.mainUtils.showNotification('All progress has been cleared', 'info');
        }
        
        // Reload the page to refresh everything
        setTimeout(() => {
            location.reload();
        }, 1000);
    }
}

// Toggle hint visibility
function toggleHint(exerciseId) {
    const hintBox = document.getElementById(`hint-${exerciseId}`);
    const btnText = document.getElementById(`hint-btn-${exerciseId}`);
    
    if (hintBox) {
        hintBox.classList.toggle('show');
        btnText.textContent = hintBox.classList.contains('show') ? 'Hide Hint' : 'Show Hint';
    }
}

// Toggle solution visibility (with password)
function toggleSolution(exerciseId) {
    const solutionBox = document.getElementById(`solution-${exerciseId}`);
    const btnText = document.getElementById(`solution-btn-${exerciseId}`);
    
    if (!solutionBox) return;
    
    const isShowing = solutionBox.classList.contains('show');
    
    if (!isShowing) {
        // Trying to show solution - check password
        if (!passwordVerified) {
            const userPassword = prompt("Enter password to view solutions:");
            
            if (userPassword === SOLUTION_PASSWORD) {
                passwordVerified = true;
                if (window.mainUtils && window.mainUtils.showNotification) {
                    window.mainUtils.showNotification("Password correct! You can now view all solutions.", "success");
                }
            } else if (userPassword !== null) {
                if (window.mainUtils && window.mainUtils.showNotification) {
                    window.mainUtils.showNotification("Incorrect password. Try again!", "error");
                }
                return;
            } else {
                return; // User cancelled
            }
        }
        
        solutionBox.classList.add('show');
        btnText.textContent = 'Hide Solution';
    } else {
        // Hiding solution
        solutionBox.classList.remove('show');
        btnText.textContent = 'Show Solution 🔒';
    }
}

// Show error message
function showError(message) {
    const exercisesGrid = document.getElementById('exercisesGrid');
    exercisesGrid.innerHTML = `
        <div class="error-message">
            <h3>⚠️ Error</h3>
            <p>${message}</p>
        </div>
    `;
}

// Export functions for global use
window.exerciseFunctions = {
    toggleHint,
    toggleSolution,
    markExerciseCompleted,
    clearProgress,
    changeUserName,
    getAIHint
};

// Make submitSolution globally available
window.submitSolution = submitSolution;