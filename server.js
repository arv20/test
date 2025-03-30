require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors({
  origin: '*'  // Allow all origins for development
}));
app.use(express.json());

// Add logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Serve static files from the root directory
app.use(express.static(__dirname));

// Handle the /generate POST request
app.post("/generate", async (req, res) => {
    console.log("Received /generate request");
    try {
        // Check if API key is configured
        if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your_groq_api_key_here') {
            console.error("Groq API key is not properly set in .env file");
            return res.status(500).json({ 
                error: "Groq API key is not configured properly", 
                details: "Please update the .env file with your actual Groq API key"
            });
        }

        const prompt = `You are a JSON generator for an AI ethics choose-your-own-adventure game. Generate a complete story with 15 stages.
        
        IMPORTANT: Your response must be ONLY a valid JSON object with no additional text or formatting.
        
        Required JSON structure:
        {
            "stages": [
                {
                    "stageNumber": 1,
                    "text": "Brief dilemma description",
                    "choices": [
                        {
                            "text": "Choice description",
                            "points": 0,
                            "nextStage": 2,
                            "nextContext": "Brief outcome"
                        }
                    ]
                }
            ]
        }

        Rules:
        1. Use ONLY double quotes for strings (no single quotes)
        2. Escape any quotes within text using backslash
        3. Keep text brief and concise
        4. Ensure all numbers are integers
        5. Each stage must have 3-4 choices
        6. Each choice must point to a valid next stage
        7. Points should be integers between -10 and 10
        8. Do not include any text before or after the JSON
        9. Do not use line breaks within text fields
        10. Keep the total response under 4000 characters

        Example of valid text:
        "text": "You discover an AI system making biased decisions. What do you do?",
        "choices": [
            {
                "text": "Report the bias to management",
                "points": 5,
                "nextStage": 2,
                "nextContext": "Management investigates"
            }
        ]`;

        console.log("Making request to Groq API...");
        try {
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    model: "llama3-70b-8192",
                    messages: [{
                        role: "user",
                        content: prompt
                    }],
                    temperature: 0.5,
                    max_tokens: 4000,
                    response_format: { type: "json_object" }
                })
            });

            const data = await response.json();
            console.log("Raw API response:", JSON.stringify(data, null, 2));

            if (!response.ok) {
                // Return a more detailed error message for API issues
                console.error("API error:", data);
                return res.status(response.status).json({ 
                    error: "Groq API error",
                    details: data.error && data.error.message ? data.error.message : "Unknown API error",
                    apiError: data.error || "Unknown error"
                });
            }

            // Ensure the response has the expected structure
            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                console.error("Unexpected API response structure:", data);
                return res.status(500).json({ 
                    error: "Unexpected API response structure",
                    details: "The API response did not contain the expected data structure"
                });
            }

            // Get the content from the message
            const content = data.choices[0].message.content.trim();
            console.log("Message content:", content);

            try {
                // Try to parse the content as JSON
                const parsedContent = JSON.parse(content);
                console.log("Parsed content:", JSON.stringify(parsedContent, null, 2));
                
                // Validate the parsed content has the required structure
                if (!parsedContent.stages || !Array.isArray(parsedContent.stages)) {
                    console.error("Invalid parsed content structure:", parsedContent);
                    return res.status(500).json({ 
                        error: "Invalid story format",
                        details: "Response must contain a 'stages' array",
                        receivedContent: parsedContent
                    });
                }

                // Validate each stage has the required fields
                for (let i = 0; i < parsedContent.stages.length; i++) {
                    const stage = parsedContent.stages[i];
                    if (!stage.stageNumber || !stage.text || !stage.choices || !Array.isArray(stage.choices)) {
                        console.error(`Invalid stage structure at index ${i}:`, stage);
                        return res.status(500).json({ 
                            error: "Invalid stage format",
                            details: `Stage ${i + 1} is missing required fields`,
                            invalidStage: stage
                        });
                    }
                }

                // Send the parsed content
                res.json(parsedContent);
            } catch (parseError) {
                console.error("Failed to parse story content:", parseError);
                console.error("Raw content that failed to parse:", content);
                
                // Try to clean the content before parsing
                try {
                    const cleanedContent = content
                        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
                        .replace(/\n/g, ' ') // Replace newlines with spaces
                        .replace(/\r/g, '') // Remove carriage returns
                        .replace(/\t/g, ' ') // Replace tabs with spaces
                        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
                        .trim();
                    
                    const parsedContent = JSON.parse(cleanedContent);
                    res.json(parsedContent);
                } catch (cleanError) {
                    res.status(500).json({ 
                        error: "Failed to parse story content",
                        details: parseError.message,
                        rawContent: content
                    });
                }
            }
        } catch (fetchError) {
            console.error("Fetch error:", fetchError);
            return res.status(500).json({ 
                error: "Failed to connect to Groq API",
                details: fetchError.message
            });
        }
    } catch (error) {
        console.error("Server error:", error);
        res.status(500).json({ 
            error: "Server error",
            details: error.message
        });
    }
});

// Serve index.html when visiting the root URL
app.get("/", (req, res) => {
    console.log("Serving index.html");
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Try different ports if 3000 is in use
function startServer(port) {
    const server = app.listen(port)
        .on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`Port ${port} is busy, trying ${port + 1}`);
                startServer(port + 1);
            } else {
                console.error('Server error:', err);
            }
        })
        .on('listening', () => {
            const actualPort = server.address().port;
            console.log(`Server running on port ${actualPort}`);
            console.log(`Open http://localhost:${actualPort} in your browser`);
            
            // Verify API key is properly set
            const keyStatus = process.env.GROQ_API_KEY 
                ? (process.env.GROQ_API_KEY === 'your_groq_api_key_here' 
                    ? "WARNING: Default value detected - update with actual key" 
                    : "Configured") 
                : "Not configured";
            console.log("Groq API Key status:", keyStatus);
        });
}

// Start the server on port 3000 (or next available)
startServer(3000);
