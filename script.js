let score = 0;
let currentStage = 1;
let maxStages = 15;
let storyTree = null;
let serverPort = 3000;
const minimumScore = -15; // Score threshold for game over

async function findAvailableServer() {
    // Try ports 3000 through 3010
    for (let port = 3000; port <= 3010; port++) {
        try {
            const response = await fetch(`http://localhost:${port}/`, {
                method: "HEAD",
                headers: { "Accept": "text/html" },
                // Short timeout to quickly check if server responds
                signal: AbortSignal.timeout(500)
            });
            
            if (response.ok) {
                console.log(`Server found on port ${port}`);
                return port;
            }
        } catch (error) {
            // Continue to next port if connection failed
            console.log(`Port ${port} not available: ${error.name}`);
        }
    }
    return null; // No server found
}

async function generateStoryTree() {
    try {
        // Find the server first
        const port = await findAvailableServer();
        if (!port) {
            throw new Error("Could not connect to the server on any port. Make sure the server is running.");
        }
        serverPort = port;

        const response = await fetch(`http://localhost:${serverPort}/generate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
        });

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const errorData = await response.json();
            
            if (!response.ok) {
                console.error("Server error details:", errorData);
                
                // Handle Groq API specific errors
                if (errorData.error && errorData.error.message) {
                    throw new Error(`API Error: ${errorData.error.message}`);
                } else if (typeof errorData.error === 'string') {
                    throw new Error(`API Error: ${errorData.error}`);
                } else if (errorData.error) {
                    throw new Error(`API Error: ${JSON.stringify(errorData.error)}`);
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            }
            
            console.log("API Response:", errorData);

            if (!errorData.stages || !Array.isArray(errorData.stages)) {
                console.error("Invalid response structure:", errorData);
                throw new Error("Invalid response format from server");
            }

            return errorData;
        } else {
            const text = await response.text();
            console.error("Non-JSON response:", text);
            throw new Error("Server returned non-JSON response");
        }
    } catch (error) {
        console.error("Error fetching AI story:", error);
        
        // Improved error handling
        let errorMessage = "Unknown error occurred";
        if (error.message) {
            errorMessage = error.message;
        } else if (typeof error === 'object') {
            errorMessage = JSON.stringify(error);
        }
        
        document.getElementById("story-text").innerHTML = `
            <div style="color: red;">
                <h3>Error: ${errorMessage}</h3>
                <p>Please check if the server is running and your API key is configured correctly.</p>
                <p>Look at the server console for more details.</p>
                <div style="margin-top: 20px;">
                    <button onclick="startGame()">Try Again</button>
                </div>
            </div>`;
        return { stages: [] };
    }
}

async function startGame() {
    score = 0;
    currentStage = 1;
    document.getElementById("score").innerText = "Ethical Score: " + score;
    document.getElementById("story-text").innerText = "Loading story...";
    
    // Generate the complete story tree
    storyTree = await generateStoryTree();
    if (!storyTree || !storyTree.stages || storyTree.stages.length === 0) {
        document.getElementById("story-text").innerHTML = `
            <div style="color: red;">
                <h3>Failed to load story</h3>
                <p>Please check the server console for more information.</p>
                <div style="margin-top: 20px;">
                    <button onclick="startGame()">Try Again</button>
                </div>
            </div>`;
        return;
    }
    
    showStory();
}

function showGameOver() {
    document.getElementById("story-text").innerHTML = `
        <div style="color: red;">
            <h2>GAME OVER</h2>
            <p>Your ethical score dropped below ${minimumScore}. Your poor ethical choices have led to serious consequences.</p>
            <p>Final Score: ${score}</p>
        </div>`;
    document.getElementById("choices").innerHTML = "";
    
    // Show restart button
    const restartButton = document.createElement("button");
    restartButton.innerText = "Start New Game";
    restartButton.onclick = startGame;
    restartButton.style.marginTop = "20px";
    document.getElementById("choices").appendChild(restartButton);
    
    document.getElementById("restart").style.display = "none";
}

function showStoryComplete() {
    document.getElementById("story-text").innerHTML = `
        <div style="color: green;">
            <h2>Story Complete!</h2>
            <p>Congratulations! You have completed the AI Ethics Adventure.</p>
            <p>Final Ethical Score: ${score}</p>
        </div>`;
    document.getElementById("choices").innerHTML = "";
    
    // Show restart button
    const restartButton = document.createElement("button");
    restartButton.innerText = "Start New Game";
    restartButton.onclick = startGame;
    restartButton.style.marginTop = "20px";
    document.getElementById("choices").appendChild(restartButton);
    
    document.getElementById("restart").style.display = "none";
}

function showStory() {
    // Check if player has hit minimum score
    if (score <= minimumScore) {
        showGameOver();
        return;
    }

    // Check if story is complete
    if (currentStage > maxStages) {
        showStoryComplete();
        return;
    }

    // Find the current stage in the story tree
    const stage = storyTree.stages.find(s => s.stageNumber === currentStage);
    if (!stage) {
        document.getElementById("story-text").innerText = "Error: Story stage not found.";
        return;
    }

    document.getElementById("story-text").innerText = stage.text;
    const choicesDiv = document.getElementById("choices");
    choicesDiv.innerHTML = "";
    document.getElementById("restart").style.display = "none";

    if (!stage.choices || stage.choices.length === 0) {
        choicesDiv.innerHTML = `
            <p>No choices available. Story ends here.</p>
            <button onclick="startGame()">Start New Game</button>
        `;
        return;
    }

    let choices = stage.choices;
    choices.sort(() => Math.random() - 0.5);

    choices.forEach(choice => {
        const button = document.createElement("button");
        button.innerText = choice.text;
        button.onclick = () => {
            score += choice.points;
            document.getElementById("score").innerText = "Ethical Score: " + score;
            
            // Check if this choice pushed the score below the minimum
            if (score <= minimumScore) {
                showGameOver();
                return;
            }
            
            currentStage = choice.nextStage;
            showStory();
        };
        choicesDiv.appendChild(button);
    });
}

window.onload = startGame;
